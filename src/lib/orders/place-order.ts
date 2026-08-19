import { env } from '@/lib/env';
import { paymentProvider, type PaymentIntent } from '@/lib/payments';
import { stateCode } from '@/lib/checkout/validation';
import type { AddressInput, ContactInput } from '@/lib/checkout/validation';
import { buildQuote, type QuoteIssue, type QuoteResult } from './quote';
import { generateOrderNumber } from './numbering';
import { orders } from './postgres-repository';
import type { Order, PaymentMethod } from './types';

/**
 * Order placement.
 *
 * Shared by the COD and online payment routes so both take exactly the same
 * path: quote → validate → reserve → persist → (payment intent). The only
 * divergence is that COD never asks for a payment intent.
 *
 * The quote is rebuilt here rather than trusted from the client, so the amount
 * stored on the order is always the server's own figure.
 */

export interface PlaceOrderInput {
  /**
   * The authenticated customer placing the order. Required.
   *
   * `orders.user_id` is nullable in the schema so that guest orders placed
   * before accounts existed remain valid, but no *new* order may be
   * ownerless — that invariant lives here, and the routes return 401 rather
   * than reaching this function without it.
   */
  userId: number;
  lines: Array<{ variantId: string; quantity: number }>;
  contact: ContactInput;
  address: AddressInput;
  couponCode?: string;
  gstin?: string;
  paymentMethod: PaymentMethod;
  idempotencyKey?: string;
}

export type PlaceOrderResult =
  | { ok: true; order: Order; intent: PaymentIntent | null; reused: boolean }
  | { ok: false; code: 'invalid_quote'; issues: QuoteIssue[]; quote: QuoteResult }
  | { ok: false; code: 'insufficient_stock'; variantId: string; available: number }
  | { ok: false; code: 'cod_limit'; message: string };

/** Unpaid COD orders a single phone number may hold at once. */
const MAX_OPEN_COD_ORDERS = 3;

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const config = env();
  const repository = orders();

  const quote = await buildQuote({
    lines: input.lines,
    couponCode: input.couponCode,
    pincode: input.address.pincode,
    paymentMethod: input.paymentMethod,
  });

  if (!quote.placeable) {
    return { ok: false, code: 'invalid_quote', issues: quote.issues, quote };
  }

  /* ------------------------------------------------------- COD limits */

  if (input.paymentMethod === 'cod') {
    const stats = await repository.customerStats(input.contact.phone);
    if (stats.unpaidCodOrders >= MAX_OPEN_COD_ORDERS) {
      return {
        ok: false,
        code: 'cod_limit',
        message:
          `There are already ${stats.unpaidCodOrders} cash-on-delivery orders open for this ` +
          'number. Please complete or cancel one before placing another.',
      };
    }
  }

  /* --------------------------------------------------- build the order */

  // COD is confirmed immediately; an online order waits for payment.
  const isCod = input.paymentMethod === 'cod';
  const provider = isCod ? null : paymentProvider();

  const newOrder = {
    orderNumber: generateOrderNumber(),
    contact: {
      name: input.contact.name,
      phone: input.contact.phone,
      email: input.contact.email || undefined,
    },
    shippingAddress: {
      line1: input.address.line1,
      line2: input.address.line2 || undefined,
      landmark: input.address.landmark || undefined,
      city: input.address.city,
      state: input.address.state,
      pincode: input.address.pincode,
    },
    amounts: {
      subtotal: quote.totals.subtotal,
      productSavings: quote.totals.productSavings,
      couponCode: quote.coupon?.code,
      couponDiscount: quote.totals.couponDiscount,
      shipping: quote.totals.shipping,
      codFee: quote.totals.codFee,
      total: quote.totals.total,
      gstAmount: quote.totals.gstIncluded,
      gstRate: 0.18,
    },
    items: quote.orderItems,
    userId: input.userId,
    // Derived from the provider that will actually run, never from the request
    // body. A client could previously post `paymentMethod: 'razorpay-test'` to
    // a mock build and get an order row labelled razorpay-test whose payment
    // rows all said 'mock' — the order's own record of how it was paid
    // disagreeing with the payments attached to it.
    paymentMethod: isCod ? ('cod' as const) : provider!.id,
    // Nothing in this build takes real money, and the flag records that
    // permanently rather than leaving it to be inferred later.
    isTest: true,
    status: isCod ? ('confirmed' as const) : ('pending_payment' as const),
    paymentStatus: 'pending' as const,
    placeOfSupply: stateCode(input.address.state),
    buyerGstin: input.gstin || undefined,
    sellerGstin: config.SELLER_GSTIN || undefined,
    idempotencyKey: input.idempotencyKey,
  };

  // `maxQuantity` on a quote line is the variant's live stock, read from the
  // catalogue moments ago — the figure the repository checks against.
  const availableByVariant = Object.fromEntries(
    quote.items.map((item) => [item.id, item.maxQuantity]),
  );

  const created = await repository.createOrder({
    order: newOrder,
    reservations: quote.items.map((item) => ({ variantId: item.id, quantity: item.quantity })),
    availableByVariant,
    reservationTtlMinutes: config.RESERVATION_TTL_MINUTES,
  });

  if (!created.ok) {
    return { ok: false, code: 'insufficient_stock', variantId: created.variantId, available: created.available };
  }

  const order = created.order;

  // A repeated submit returns the original order untouched — no second
  // reservation, no second payment intent.
  if (created.reused) {
    return { ok: true, order, intent: null, reused: true };
  }

  /* ------------------------------------------------------------- COD */

  if (isCod) {
    // The sale is committed the moment a COD order is confirmed.
    await repository.consumeReservations(order.id);
    return { ok: true, order, intent: null, reused: false };
  }

  /* ---------------------------------------------------------- online */

  const intent = await provider!.createIntent(order);
  await repository.setGatewayOrderId(order.id, intent.gatewayOrderId, provider!.id);

  return {
    ok: true,
    order: { ...order, gatewayOrderId: intent.gatewayOrderId },
    intent,
    reused: false,
  };
}
