import { describe, expect, it } from 'vitest';
import { refundRefusal, refundSummary, refundableAmount, rupeesToPaise } from './refund-rules';
import type { Order, RefundRecord } from './types';

function order(overrides: Partial<Order> = {}): Order {
  return {
    status: 'confirmed',
    paymentStatus: 'paid',
    paymentMethod: 'razorpay',
    amounts: { total: 1_000_000 },
    ...overrides,
  } as Order;
}

function refund(amount: number, status: RefundRecord['status']): RefundRecord {
  return { amount, status } as RefundRecord;
}

describe('refundableAmount', () => {
  it('is the amount paid less pending and processed refunds', () => {
    expect(refundableAmount(order(), [])).toBe(1_000_000);
    expect(refundableAmount(order(), [refund(300_000, 'processed'), refund(200_000, 'pending')])).toBe(500_000);
  });

  it('does not count a refund the gateway refused', () => {
    expect(refundableAmount(order(), [refund(1_000_000, 'failed')])).toBe(1_000_000);
  });

  it('is zero for an order that was never paid', () => {
    expect(refundableAmount(order({ paymentStatus: 'pending' }), [])).toBe(0);
  });
});

describe('refundRefusal', () => {
  it('allows a paid, unshipped online order', () => {
    expect(refundRefusal(order(), [], 'razorpay')).toBeNull();
    expect(refundRefusal(order({ status: 'packed' }), [], 'razorpay')).toBeNull();
  });

  it('allows refunding the remainder of an order already cancelled', () => {
    expect(refundRefusal(order({ status: 'cancelled' }), [refund(400_000, 'processed')], 'razorpay')).toBeNull();
  });

  it('refuses once the order is dispatched', () => {
    expect(refundRefusal(order({ status: 'shipped' }), [], 'razorpay')).toBe('dispatched');
    expect(refundRefusal(order({ status: 'delivered' }), [], 'razorpay')).toBe('dispatched');
  });

  it('refuses a second refund above what was paid', () => {
    expect(refundRefusal(order(), [refund(1_000_000, 'pending')], 'razorpay')).toBe('nothing_left');
    expect(refundRefusal(order({ paymentStatus: 'refunded' }), [], 'razorpay')).toBe('nothing_left');
  });

  it('refuses cash on delivery, unpaid orders and another gateway', () => {
    expect(refundRefusal(order({ paymentMethod: 'cod' }), [], 'razorpay')).toBe('cash_on_delivery');
    expect(refundRefusal(order({ paymentStatus: 'pending' }), [], 'razorpay')).toBe('not_paid');
    expect(refundRefusal(order({ paymentMethod: 'razorpay' }), [], 'mock')).toBe('other_gateway');
  });
});

describe('rupeesToPaise', () => {
  it('reads rupees with up to two decimals', () => {
    expect(rupeesToPaise('1')).toBe(100);
    expect(rupeesToPaise('4999.5')).toBe(499_950);
    expect(rupeesToPaise('₹ 12,499.00')).toBe(1_249_900);
  });

  it('refuses anything it would have to guess at', () => {
    for (const input of ['', '0', '-5', '1.234', 'abc', '1e3', '10.']) {
      expect(rupeesToPaise(input), input).toBeNull();
    }
  });
});

describe('refundSummary', () => {
  it('is null without a live refund', () => {
    expect(refundSummary([])).toBeNull();
    expect(refundSummary([refund(100, 'failed')])).toBeNull();
  });

  it('reads processed only when every live refund is processed', () => {
    expect(refundSummary([refund(100, 'processed'), refund(50, 'pending')])).toEqual({ state: 'pending', amount: 150 });
    expect(refundSummary([refund(100, 'processed'), refund(9, 'failed')])).toEqual({ state: 'processed', amount: 100 });
  });
});
