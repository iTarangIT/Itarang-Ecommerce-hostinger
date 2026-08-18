import type { OrderStatus, PaymentStatus } from './types';

/**
 * Order and payment state machines.
 *
 * Transitions are enumerated rather than inferred, so an impossible move — a
 * delivered order returning to pending, or a failed payment becoming paid
 * without going through the gateway again — is rejected rather than silently
 * accepted. Every accepted transition is recorded in `order_events`.
 */

const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  // Terminal.
  delivered: [],
  cancelled: [],
};

const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  // A gateway may authorise first or capture directly.
  pending: ['authorized', 'paid', 'failed'],
  authorized: ['paid', 'failed'],
  paid: ['refunded'],
  // A failed payment can be retried and then succeed.
  failed: ['pending', 'authorized', 'paid'],
  refunded: [],
};

export class InvalidTransitionError extends Error {
  constructor(kind: string, from: string, to: string) {
    super(`Invalid ${kind} transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) throw new InvalidTransitionError('order', from, to);
}

export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransitionPayment(from, to)) throw new InvalidTransitionError('payment', from, to);
}

/** Transitions a merchant may apply by hand from the admin list. */
export function nextOrderStatuses(from: OrderStatus): readonly OrderStatus[] {
  return ORDER_TRANSITIONS[from];
}

/**
 * Webhooks arrive out of order and more than once, so a later event must never
 * drag the payment backwards. Rank decides whether an incoming state is an
 * advance on what we already hold.
 */
const PAYMENT_RANK: Record<PaymentStatus, number> = {
  pending: 0,
  failed: 1,
  authorized: 2,
  paid: 3,
  refunded: 4,
};

export function isPaymentAdvance(current: PaymentStatus, incoming: PaymentStatus): boolean {
  return PAYMENT_RANK[incoming] > PAYMENT_RANK[current];
}

/** The order status implied by a payment reaching `paid`. */
export function orderStatusForPayment(
  paymentStatus: PaymentStatus,
  current: OrderStatus,
): OrderStatus {
  if (paymentStatus === 'paid' && current === 'pending_payment') return 'confirmed';
  return current;
}
