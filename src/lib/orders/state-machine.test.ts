import { describe, expect, it } from 'vitest';
import {
  InvalidTransitionError,
  assertOrderTransition,
  assertPaymentTransition,
  canTransitionOrder,
  canTransitionPayment,
  isPaymentAdvance,
  nextOrderStatuses,
  orderStatusForPayment,
} from './state-machine';

describe('order status transitions', () => {
  it('follows the fulfilment path', () => {
    expect(canTransitionOrder('pending_payment', 'confirmed')).toBe(true);
    expect(canTransitionOrder('confirmed', 'packed')).toBe(true);
    expect(canTransitionOrder('packed', 'shipped')).toBe(true);
    expect(canTransitionOrder('shipped', 'delivered')).toBe(true);
  });

  it('refuses to move backwards', () => {
    expect(canTransitionOrder('delivered', 'shipped')).toBe(false);
    expect(canTransitionOrder('shipped', 'packed')).toBe(false);
    expect(canTransitionOrder('confirmed', 'pending_payment')).toBe(false);
  });

  it('refuses to skip fulfilment steps', () => {
    expect(canTransitionOrder('confirmed', 'delivered')).toBe(false);
    expect(canTransitionOrder('pending_payment', 'shipped')).toBe(false);
  });

  it('treats delivered and cancelled as terminal', () => {
    expect(nextOrderStatuses('delivered')).toHaveLength(0);
    expect(nextOrderStatuses('cancelled')).toHaveLength(0);
    expect(canTransitionOrder('delivered', 'cancelled')).toBe(false);
  });

  it('allows cancellation up to dispatch but not after', () => {
    expect(canTransitionOrder('pending_payment', 'cancelled')).toBe(true);
    expect(canTransitionOrder('packed', 'cancelled')).toBe(true);
    expect(canTransitionOrder('shipped', 'cancelled')).toBe(false);
  });

  it('throws on an illegal transition', () => {
    expect(() => assertOrderTransition('delivered', 'packed')).toThrow(InvalidTransitionError);
    expect(() => assertOrderTransition('pending_payment', 'confirmed')).not.toThrow();
  });
});

describe('payment status transitions', () => {
  it('allows direct capture and authorise-then-capture', () => {
    expect(canTransitionPayment('pending', 'paid')).toBe(true);
    expect(canTransitionPayment('pending', 'authorized')).toBe(true);
    expect(canTransitionPayment('authorized', 'paid')).toBe(true);
  });

  it('allows retry after failure', () => {
    expect(canTransitionPayment('failed', 'pending')).toBe(true);
    expect(canTransitionPayment('failed', 'paid')).toBe(true);
  });

  it('refuses to un-refund or re-pay a refunded payment', () => {
    expect(canTransitionPayment('refunded', 'paid')).toBe(false);
    expect(canTransitionPayment('paid', 'failed')).toBe(false);
    expect(() => assertPaymentTransition('refunded', 'paid')).toThrow(InvalidTransitionError);
  });
});

describe('out-of-order webhook handling', () => {
  it('treats a later state as an advance', () => {
    expect(isPaymentAdvance('pending', 'paid')).toBe(true);
    expect(isPaymentAdvance('authorized', 'paid')).toBe(true);
  });

  it('ignores an earlier state arriving late', () => {
    // Razorpay warns payment.authorized may arrive after payment.captured.
    expect(isPaymentAdvance('paid', 'authorized')).toBe(false);
    expect(isPaymentAdvance('paid', 'pending')).toBe(false);
    expect(isPaymentAdvance('paid', 'failed')).toBe(false);
  });

  it('ignores a duplicate of the current state', () => {
    expect(isPaymentAdvance('paid', 'paid')).toBe(false);
  });
});

describe('orderStatusForPayment', () => {
  it('confirms an unpaid order once payment lands', () => {
    expect(orderStatusForPayment('paid', 'pending_payment')).toBe('confirmed');
  });

  it('never drags a fulfilled order backwards', () => {
    expect(orderStatusForPayment('paid', 'shipped')).toBe('shipped');
    expect(orderStatusForPayment('paid', 'delivered')).toBe('delivered');
  });

  it('leaves the order alone while payment is incomplete', () => {
    expect(orderStatusForPayment('failed', 'pending_payment')).toBe('pending_payment');
    expect(orderStatusForPayment('authorized', 'pending_payment')).toBe('pending_payment');
  });
});
