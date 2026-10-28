import { describe, expect, it } from 'vitest';
import { calculateTotals } from '@/lib/store/totals';
import type { CartItem } from '@/lib/store/types';
import { COUPONS, COUPONS_ENABLED, UPI_DISCOUNT, validateCoupon } from '@/lib/offers/coupons';

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

  it('delivers free on every order (D-03)', () => {
    const totals = calculateTotals([item()], null);
    expect(totals.shipping).toBe(0);
    expect(totals.total).toBe(100000);
    expect(totals.amountToFreeShipping).toBe(0);
  });

  it('keeps delivery free after a coupon', () => {
    const line = item({ price: { mrp: 600000, selling: 520000 } });
    const totals = calculateTotals([line], {
      code: 'TEST',
      label: 'Test',
      discount: 50000,
    });
    expect(totals.couponDiscount).toBe(50000);
    expect(totals.shipping).toBe(0);
    expect(totals.total).toBe(470000);
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

/**
 * The master switch, which is on with the business's two codes.
 *
 * Asserted rather than assumed: turning it off again is a deliberate act, and
 * this test failing is how somebody learns they have made one.
 */
describe('the coupon master switch', () => {
  it('is on, and carries exactly the two WELCOME codes', () => {
    expect(COUPONS_ENABLED).toBe(true);
    expect(COUPONS.map((rule) => rule.code).sort()).toEqual(['WELCOME1000', 'WELCOME2000']);
  });
});

/**
 * The rules behind the codes. Each is scoped to one subcategory, so the tests
 * use the subcategories the business named: home inverter batteries for
 * WELCOME1000, 3-wheeler batteries for WELCOME2000.
 */
describe('coupon rules are enforced server-side', () => {
  const homeBattery = item({
    category: 'batteries',
    subcategory: 'home-inverter',
    price: { mrp: 3500000, selling: 3000000 },
  });
  const rickshawBattery = item({
    category: 'batteries',
    subcategory: 'ev-3-wheeler',
    price: { mrp: 9000000, selling: 8500000 },
  });
  const scooterBattery = item({
    category: 'batteries',
    subcategory: 'ev-2-wheeler',
    price: { mrp: 4500000, selling: 4100000 },
  });

  it('WELCOME1000 takes ₹1,000 off a cart with a home inverter battery', () => {
    const result = validateCoupon('WELCOME1000', [homeBattery]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.coupon.discount).toBe(100000);
  });

  it('WELCOME2000 takes ₹2,000 off a cart with a 3-wheeler battery', () => {
    const result = validateCoupon('WELCOME2000', [rickshawBattery]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.coupon.discount).toBe(200000);
  });

  it('refuses each code on the other line, and on 2-wheeler packs', () => {
    expect(validateCoupon('WELCOME1000', [rickshawBattery]).ok).toBe(false);
    expect(validateCoupon('WELCOME2000', [homeBattery]).ok).toBe(false);
    expect(validateCoupon('WELCOME1000', [scooterBattery]).ok).toBe(false);
    expect(validateCoupon('WELCOME2000', [scooterBattery]).ok).toBe(false);
  });

  it('applies to a mixed cart that contains a qualifying product', () => {
    expect(validateCoupon('WELCOME2000', [scooterBattery, rickshawBattery]).ok).toBe(true);
  });

  it('refuses a line whose subcategory is unknown — an old saved cart', () => {
    const legacy = item({ category: 'batteries', subcategory: undefined });
    expect(validateCoupon('WELCOME1000', [legacy]).ok).toBe(false);
  });

  it('rejects an unknown code and an empty cart', () => {
    expect(validateCoupon('NOPE', [homeBattery]).ok).toBe(false);
    expect(validateCoupon('WELCOME1000', []).ok).toBe(false);
  });

  it('is case-insensitive and trims input', () => {
    expect(validateCoupon('  welcome1000 ', [homeBattery]).ok).toBe(true);
  });

  it('is one use per customer, enforced at order placement', () => {
    for (const rule of COUPONS) expect(rule.oncePerCustomer).toBe(true);
  });
});

describe('the UPI discount', () => {
  it('is ₹200', () => {
    expect(UPI_DISCOUNT).toBe(20000);
  });

  it('comes off the total after the coupon, and counts as a saving', () => {
    const cart = [item({ price: { mrp: 3500000, selling: 3000000 } })];
    const coupon = { code: 'WELCOME1000', label: 'x', discount: 100000 };
    const totals = calculateTotals(cart, coupon, 0, UPI_DISCOUNT);
    expect(totals.couponDiscount).toBe(100000);
    expect(totals.paymentDiscount).toBe(20000);
    expect(totals.total).toBe(3000000 - 100000 - 20000);
    expect(totals.totalSavings).toBe(500000 + 100000 + 20000);
  });

  it('never takes the total below the delivery charge on a tiny cart', () => {
    const totals = calculateTotals([item({ price: { mrp: 10000, selling: 10000 } })], null, 0, 20000);
    expect(totals.paymentDiscount).toBe(10000);
    expect(totals.total).toBe(totals.shipping);
  });

  it('is zero on an empty cart', () => {
    expect(calculateTotals([], null, 0, UPI_DISCOUNT).paymentDiscount).toBe(0);
  });
});
