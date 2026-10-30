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

/**
 * How long a refund takes to reach the customer, in working days, as Razorpay
 * states it on the payment: the refund is processed in 3–5 working days, and
 * the bank or card issuer credits it within 5–7 working days after that.
 */
export const REFUND_PROCESSING_WORKING_DAYS = { min: 3, max: 5 } as const;
export const BANK_CREDIT_WORKING_DAYS = { min: 5, max: 7 } as const;

const IST_OFFSET_MS = 330 * 60_000;

/**
 * `days` working days (Monday to Friday) after `iso`, counted on the Indian
 * calendar date, returned as midday India time so any formatter shows that
 * day. Bank holidays are not known here; the range already allows for them.
 */
export function addWorkingDays(iso: string, days: number): string {
  const day = new Date(new Date(iso).getTime() + IST_OFFSET_MS);
  day.setUTCHours(12, 0, 0, 0);
  let left = days;
  while (left > 0) {
    day.setUTCDate(day.getUTCDate() + 1);
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return new Date(day.getTime() - IST_OFFSET_MS).toISOString();
}

/** One refund as the customer is told about it: what, when, and when to expect it. */
export interface CustomerRefund {
  amount: Paise;
  /** The gateway's refund id — what a bank asks for when tracing a credit. */
  reference?: string;
  state: 'pending' | 'processed';
  startedAt: string;
  processedAt?: string;
  /** The window in which the money should reach the original payment method. */
  creditFrom: string;
  creditBy: string;
}

/**
 * Each refund on an order, oldest first, with the date window the customer
 * should see the money in. A failed refund is left out: nothing is on its way,
 * and the team is alerted to retry it.
 */
export function customerRefunds(refunds: RefundRecord[]): CustomerRefund[] {
  return refunds
    .filter((refund) => refund.status !== 'failed')
    .map((refund) => {
      const processed = refund.status === 'processed';
      // A processed refund counts from the day it was processed; a pending
      // one has the processing time still ahead of it.
      const from = processed ? (refund.processedAt ?? refund.createdAt) : refund.createdAt;
      const lead = processed ? { min: 0, max: 0 } : REFUND_PROCESSING_WORKING_DAYS;
      return {
        amount: refund.amount,
        reference: refund.gatewayRefundId,
        state: processed ? 'processed' : 'pending',
        startedAt: refund.createdAt,
        processedAt: processed ? from : undefined,
        creditFrom: addWorkingDays(from, lead.min + BANK_CREDIT_WORKING_DAYS.min),
        creditBy: addWorkingDays(from, lead.max + BANK_CREDIT_WORKING_DAYS.max),
      };
    });
}
