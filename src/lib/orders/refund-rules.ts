import type { Paise } from '@/lib/commerce/types';
import type { Order, RefundRecord } from './types';

/**
 * When an order may be cancelled and refunded from the admin order page (R-12).
 *
 * Kept free of the database so the rules can be tested on their own; the
 * cap itself is enforced again under a row lock in `beginRefund`, because a
 * page rendered a minute ago is not evidence of what has been refunded since.
 *
 * D-08: any admin may refund, up to the amount paid on that order. Only online
 * payments — a cash-on-delivery order is refunded by bank transfer, outside
 * the gateway — and only before dispatch: once the battery is on a truck the
 * question is a return, not a cancellation.
 */

export type RefundRefusal =
  | 'not_paid'
  | 'cash_on_delivery'
  | 'dispatched'
  | 'nothing_left'
  | 'other_gateway';

export const REFUND_REFUSAL_MESSAGES: Record<RefundRefusal, string> = {
  not_paid: 'Only an order whose payment has been received can be refunded.',
  cash_on_delivery:
    'A cash-on-delivery order is refunded by bank transfer, not through the payment gateway.',
  dispatched:
    'This order has been dispatched. Handle it as a return once the product is back with us.',
  nothing_left: 'The full amount paid on this order has already been refunded.',
  other_gateway:
    'This order was paid through a different payment gateway from the one this server runs, so it cannot be refunded from here.',
};

/** Paise still refundable: what was paid, less refunds pending or processed. */
export function refundableAmount(order: Order, refunds: RefundRecord[]): Paise {
  if (order.paymentStatus !== 'paid') return 0;
  const taken = refunds
    .filter((refund) => refund.status !== 'failed')
    .reduce((sum, refund) => sum + refund.amount, 0);
  return Math.max(0, order.amounts.total - taken);
}

export function refundRefusal(
  order: Order,
  refunds: RefundRecord[],
  providerId: string,
): RefundRefusal | null {
  if (order.paymentMethod === 'cod') return 'cash_on_delivery';
  if (order.paymentStatus === 'refunded') return 'nothing_left';
  if (order.paymentStatus !== 'paid') return 'not_paid';
  if (order.status === 'shipped' || order.status === 'delivered') return 'dispatched';
  if (order.paymentMethod !== providerId) return 'other_gateway';
  if (refundableAmount(order, refunds) <= 0) return 'nothing_left';
  return null;
}

/**
 * "1,234.50" or "1234.5" rupees → paise. Null for anything that is not a
 * positive amount with at most two decimals, so a typo is refused rather than
 * rounded into a different refund.
 */
export function rupeesToPaise(input: string): Paise | null {
  const cleaned = input.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ''] = cleaned.split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(paise) && paise > 0 ? paise : null;
}

/** The customer-facing line for an order's refunds, or null when there are none. */
export function refundSummary(refunds: RefundRecord[]): {
  state: 'pending' | 'processed';
  amount: Paise;
} | null {
  const live = refunds.filter((refund) => refund.status !== 'failed');
  if (live.length === 0) return null;
  return {
    state: live.every((refund) => refund.status === 'processed') ? 'processed' : 'pending',
    amount: live.reduce((sum, refund) => sum + refund.amount, 0),
  };
}
