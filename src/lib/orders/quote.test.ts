import { beforeEach, describe, expect, it } from 'vitest';
import { calculateTotals } from '@/lib/store/totals';
import type { CartItem } from '@/lib/store/types';
import { validateCoupon } from '@/lib/offers/coupons';

/**
 * Pricing rules.
 *
 * `calculateTotals` is the single implementation used by both the cart UI and
 * the server quote, so these tests pin the behaviour that decides what a
 * shopper is actually charged.
 */

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'variant-1',
    productId: 'product-1',
    slug: 'test-product',
    title: 'Test product',
    image: '/art/inverter-1-front.svg',
    price: { mrp: 120000, selling: 100000 },
    quantity: 1,
    maxQuantity: 10,
    category: 'inverters',
    installationIncluded: true,
    ...overrides,
  };
}

describe('totals', () => {
  it('sums line totals and product savings', () => {
    const totals = calculateTotals([item({ quantity: 2 })], null);
    expect(totals.subtotal).toBe(200000);
    expect(totals.mrpTotal).toBe(240000);
    expect(totals.productSavings).toBe(40000);
    expect(totals.itemCount).toBe(2);
  });

  it('charges delivery below the free-shipping threshold', () => {
    const totals = calculateTotals([item()], null);
    expect(totals.shipping).toBe(39900);
    expect(totals.total).toBe(139900);
  });

  it('waives delivery at and above the threshold', () => {
    // ₹4,999 exactly.
    const totals = calculateTotals([item({ price: { mrp: 600000, selling: 499900 } })], null);
    expect(totals.shipping).toBe(0);
    expect(totals.total).toBe(499900);
  });

  it('applies a coupon before deciding on free delivery', () => {
    const line = item({ price: { mrp: 600000, selling: 520000 } });
    const totals = calculateTotals([line], {
      code: 'TEST',
      label: 'Test',
      discount: 50000,
    });
    // 520000 − 50000 = 470000, which is below the threshold, so delivery applies.
    expect(totals.couponDiscount).toBe(50000);
    expect(totals.shipping).toBe(39900);
    expect(totals.total).toBe(509900);
  });

  it('honours a free-shipping coupon regardless of cart value', () => {
    const totals = calculateTotals([item()], {
      code: 'FREESHIP',
      label: 'Free delivery',
      discount: 0,
      freeShipping: true,
    });
    expect(totals.shipping).toBe(0);
  });

  it('never lets a coupon exceed the subtotal', () => {
    const totals = calculateTotals([item()], {
      code: 'HUGE',
      label: 'Too big',
      discount: 999999999,
    });
    expect(totals.couponDiscount).toBe(100000);
    expect(totals.total).toBeGreaterThanOrEqual(0);
  });

  it('adds the COD fee only when one is supplied', () => {
    const without = calculateTotals([item()], null);
    const with_ = calculateTotals([item()], null, 5000);
    expect(without.codFee).toBe(0);
    expect(with_.codFee).toBe(5000);
    expect(with_.total).toBe(without.total + 5000);
  });

  it('never charges a COD fee on an empty cart', () => {
    const totals = calculateTotals([], null, 5000);
    expect(totals.codFee).toBe(0);
    expect(totals.total).toBe(0);
  });

  it('extracts GST from the inclusive total', () => {
    const totals = calculateTotals([item({ price: { mrp: 118000, selling: 118000 } })], null);
    // 118000 inclusive of 18% → 18000 tax component.
    expect(totals.gstIncluded).toBe(Math.round(totals.total - totals.total / 1.18));
  });

  it('produces integer paise for every amount', () => {
    const totals = calculateTotals([item({ quantity: 3 })], {
      code: 'X',
      label: 'X',
      discount: 33333,
    });
    for (const [key, value] of Object.entries(totals)) {
      expect(Number.isInteger(value), `${key} is not an integer`).toBe(true);
    }
  });
});

describe('coupon rules are enforced server-side', () => {
  let cart: CartItem[];

  beforeEach(() => {
    cart = [item({ category: 'combos', price: { mrp: 2500000, selling: 2100000 } })];
  });

  it('accepts a valid category-scoped coupon', () => {
    const result = validateCoupon('COMBO1500', cart);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.coupon.discount).toBe(150000);
  });

  it('rejects a coupon for the wrong category', () => {
    const result = validateCoupon('COMBO1500', [item({ category: 'inverters' })]);
    expect(result.ok).toBe(false);
  });

  it('rejects a coupon below its minimum cart value', () => {
    const result = validateCoupon('COMBO1500', [
      item({ category: 'combos', price: { mrp: 100000, selling: 90000 } }),
    ]);
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown code and an empty cart', () => {
    expect(validateCoupon('NOPE', cart).ok).toBe(false);
    expect(validateCoupon('COMBO1500', []).ok).toBe(false);
  });

  it('is case-insensitive and trims input', () => {
    expect(validateCoupon('  combo1500 ', cart).ok).toBe(true);
  });
});
