import { paymentProvider } from '@/lib/payments';
import type { AddressInput, ContactInput } from '@/lib/checkout/validation';
import { placeOrder } from './place-order';
import { orders } from './postgres-repository';
import type { Order } from './types';

/**
 * An order placed by staff for a customer who rang or messaged (R-18).
 *
 * It is an ordinary order in every way that matters — same quote, same stock
 * check, same totals, same webhook, same confirmation mail — with two
 * differences. It names the admin in `placed_by`, and it is paid through a
 * Razorpay payment link sent to the customer's phone rather than a payment
 * window in the admin's browser. Phone and WhatsApp enquiries no longer have
 * to be sent back to the website.
 *
 * The stock is held for as long as the link is open, so the customer is not
 * asked to pay for a battery somebody else bought in the meantime.
 */

/** How long the payment link stays open, and the stock with it. */
export const STAFF_ORDER_HOLD_HOURS = 24;

export async function placeStaffOrder(input: {
  actor: string;
  lines: Array<{ variantId: string; quantity: number }>;
  contact: ContactInput;
  address: AddressInput;
  gstin?: string;
}): Promise<{ ok: true; order: Order; message: string } | { ok: false; message: string }> {
  const provider = paymentProvider();

  const placed = await placeOrder({
    placedBy: input.actor,
    lines: input.lines,
    contact: input.contact,
    address: input.address,
    gstin: input.gstin,
    paymentMethod: provider.id,
    reservationTtlMinutes: STAFF_ORDER_HOLD_HOURS * 60,
    // The customer has not ticked anything; staff placed it on their word.
    acceptTerms: false,
  });

  if (!placed.ok) {
    switch (placed.code) {
      case 'insufficient_stock':
        return { ok: false, message: 'Not enough stock for one of these products. Reduce the quantity or pick another.' };
      case 'invalid_quote':
      case 'price_changed':
        return { ok: false, message: placed.issues.map((issue) => issue.message).join(' ') || 'This order cannot be placed.' };
      case 'cod_limit':
        return { ok: false, message: placed.message };
    }
  }

  const sent = await sendPaymentLink(placed.order, input.actor);
  return { ok: true, order: placed.order, message: sent.message };
}

/**
 * Create the payment link and record it on the order. Also the retry when the
 * first attempt failed — the order exists either way, and a second order for
 * the same customer would hold the stock twice.
 */
export async function sendPaymentLink(
  order: Order,
  actor: string,
): Promise<{ ok: boolean; message: string }> {
  const provider = paymentProvider();

  if (order.status !== 'pending_payment') {
    return { ok: false, message: 'This order is no longer waiting for payment.' };
  }
  if (order.paymentLink) {
    return { ok: false, message: 'A payment link has already been sent for this order.' };
  }
  if (!provider.createPaymentLink) {
    return {
      ok: false,
      message: `Order ${order.orderNumber} placed, but payment links need Razorpay and this server runs the test payment provider. No link was sent.`,
    };
  }

  const expiresAt = new Date(new Date(order.createdAt).getTime() + STAFF_ORDER_HOLD_HOURS * 3600_000);
  // Razorpay refuses an expiry less than 15 minutes away.
  if (expiresAt.getTime() - Date.now() < 20 * 60_000) {
    return { ok: false, message: 'The stock hold on this order has nearly run out. Place a new order instead.' };
  }

  try {
    const link = await provider.createPaymentLink({ order, expiresAt });
    await orders().setPaymentLink(order.id, link, actor);
    return {
      ok: true,
      message: `Order ${order.orderNumber} placed. Razorpay has sent the payment link to ${order.contact.phone}${order.contact.email ? ` and ${order.contact.email}` : ''}: ${link.url}`,
    };
  } catch (error) {
    console.error(`[staff-order] payment link for ${order.orderNumber} failed: ${(error as Error).message}`);
    return {
      ok: false,
      message: `Order ${order.orderNumber} placed, but the payment link could not be created. Try "Send payment link" on the order page.`,
    };
  }
}
