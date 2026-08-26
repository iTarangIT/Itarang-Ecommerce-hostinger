import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { PRODUCTS } from '@/lib/commerce/mock/products';
import type { Product } from '@/lib/commerce/types';

/**
 * Order placement against the local `itarang_dev` database.
 *
 * Two invariants live here that nothing else can check.
 *
 * **The displayed price cannot become the charged price.** `expectedTotal` is
 * whatever the browser had on screen. It exists so a price that moved between
 * the quote and the submit is caught and shown to the shopper rather than
 * charged silently — and it must never price anything. The tests below prove
 * both halves: that a drift is refused, and that when the shopper accepts, the
 * row written carries the *server's* figure and not the client's.
 *
 * **A single-use coupon is single-use.** `coupon_redemptions` existed from the
 * first migration and nothing ever wrote to it, so FIRST5 — a first-order
 * discount — could be redeemed on every order forever.
 */

function targetsRemote(): boolean {
  const raw = process.env.DATABASE_URL;
  if (!raw) return false;
  try {
    return !isLocalHost(inspectDatabaseUrl(raw).host);
  } catch {
    return false;
  }
}

const REMOTE = targetsRemote();
const CONFIGURED =
  Boolean(process.env.DATABASE_URL) && (!REMOTE || process.env.DB_ALLOW_REMOTE_TESTS === 'true');

if (!CONFIGURED) {
  console.warn(
    REMOTE
      ? '\n  [skipped] Placement integration tests write real rows and DATABASE_URL is remote. ' +
          'Set DB_ALLOW_REMOTE_TESTS=true to run them anyway.\n'
      : '\n  [skipped] Placement integration tests need DATABASE_URL pointing at a local ' +
          'itarang_dev database. See README → Database.\n',
  );
}

/**
 * The catalogue the code under test reads, swappable mid-test.
 *
 * Repricing this between the two quote reads is the whole point: it reproduces
 * a merchant editing a price in hPanel while somebody is at checkout.
 */
let catalogue: Product[] = [];

vi.mock('@/lib/catalog/collections', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog/collections')>();
  return { ...actual, allProducts: async () => catalogue };
});

const PHONE = '9000000033';
let userId: number;

/** A deep-ish clone so repricing one test's catalogue cannot leak into another. */
function freshCatalogue(): Product[] {
  return PRODUCTS.slice(0, 4).map((product) => ({
    ...product,
    variants: product.variants.map((variant) => ({
      ...variant,
      price: { ...variant.price },
    })),
  }));
}

function reprice(variantId: string, selling: number) {
  for (const product of catalogue) {
    for (const variant of product.variants) {
      if (variant.id === variantId) {
        variant.price = { ...variant.price, selling, mrp: Math.max(variant.price.mrp, selling) };
      }
    }
  }
}

describe.skipIf(!CONFIGURED)('order placement', () => {
  let placeOrder: typeof import('./place-order').placeOrder;
  let buildQuote: typeof import('./quote').buildQuote;
  let variantId: string;

  beforeAll(async () => {
    // The mock payment provider is local-only and makes no network call. Set
    // before the modules are imported, because env is cached on first read.
    process.env.PAYMENT_PROVIDER = 'mock';
    const { resetEnvCache } = await import('@/lib/env');
    resetEnvCache();

    ({ placeOrder } = await import('./place-order'));
    ({ buildQuote } = await import('./quote'));

    const rows = await query<{ id: number }>(
      `INSERT INTO users (email, password_hash, role)
       VALUES ('placement-test@itarang.test', 'scrypt.aa.bb', 'customer')
       ON CONFLICT (email) DO UPDATE SET role = 'customer'
       RETURNING id`,
    );
    userId = rows[0].id;
  });

  beforeEach(async () => {
    await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
    catalogue = freshCatalogue();
    variantId = catalogue[0].variants[0].id;
  });

  afterAll(async () => {
    await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
    await query(`DELETE FROM users WHERE email = 'placement-test@itarang.test'`);
    await closePool();
  });

  function input(overrides: Record<string, unknown> = {}) {
    return {
      userId,
      lines: [{ variantId, quantity: 1 }],
      contact: { name: 'Drift Buyer', phone: PHONE, email: undefined },
      address: {
        line1: '1 Test Street',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411001',
      },
      paymentMethod: 'mock' as const,
      idempotencyKey: `drift-${Math.random().toString(36).slice(2)}`,
      ...overrides,
    };
  }

  describe('price drift between the quote and the submit', () => {
    it('refuses an order whose price moved, and creates nothing', async () => {
      const shown = await buildQuote({ lines: [{ variantId, quantity: 1 }] });

      // The merchant edits the price while the shopper is filling in the form.
      reprice(variantId, shown.totals.total + 500_00);

      const result = await placeOrder(input({ expectedTotal: shown.totals.total }));

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe('price_changed');

      const rows = await query(`SELECT id FROM orders WHERE customer_phone = $1`, [PHONE]);
      expect(rows, 'a refused order must not be written').toHaveLength(0);
    });

    it('reports both figures so the shopper can see the change', async () => {
      const shown = await buildQuote({ lines: [{ variantId, quantity: 1 }] });
      reprice(variantId, shown.totals.total + 500_00);

      const result = await placeOrder(input({ expectedTotal: shown.totals.total }));

      expect(result.ok).toBe(false);
      if (result.ok || result.code !== 'price_changed') return;
      expect(result.expectedTotal).toBe(shown.totals.total);
      expect(result.total).toBeGreaterThan(shown.totals.total);
      expect(result.issues.some((issue) => issue.code === 'price_changed')).toBe(true);
    });

    it('charges the server figure, not the client one, once accepted', async () => {
      const shown = await buildQuote({ lines: [{ variantId, quantity: 1 }] });
      const raised = shown.totals.total + 500_00;
      reprice(variantId, raised);

      const result = await placeOrder(
        input({ expectedTotal: shown.totals.total, acceptPriceChange: true }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // This is the guarantee: the stored total is the catalogue's, never the
      // number the browser sent.
      expect(result.order.amounts.total).not.toBe(shown.totals.total);

      const rows = await query<{ total: number }>(
        `SELECT total FROM orders WHERE order_number = $1`,
        [result.order.orderNumber],
      );
      expect(Number(rows[0].total)).toBe(result.order.amounts.total);
    });

    it('cannot be used to pay less than the catalogue price', async () => {
      // The attack the advisory field would enable if it were ever trusted:
      // claim a low total and hope it is charged.
      const honest = await buildQuote({ lines: [{ variantId, quantity: 1 }] });

      const result = await placeOrder(
        input({ expectedTotal: 1, acceptPriceChange: true }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.order.amounts.total).toBe(honest.totals.total);
      expect(result.order.amounts.total).not.toBe(1);
    });

    it('places normally when the price has not moved', async () => {
      const shown = await buildQuote({ lines: [{ variantId, quantity: 1 }] });

      const result = await placeOrder(input({ expectedTotal: shown.totals.total }));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.order.amounts.total).toBe(shown.totals.total);
    });

    it('places normally when the client declares nothing', async () => {
      // The field is optional, so an older client keeps working.
      const result = await placeOrder(input());
      expect(result.ok).toBe(true);
    });
  });

  describe('single-use coupons', () => {
    it('accepts FIRST5 once and refuses it on the next order', async () => {
      const first = await placeOrder(input({ couponCode: 'FIRST5' }));
      expect(first.ok, 'the first use should be accepted').toBe(true);
      if (!first.ok) return;
      expect(first.order.amounts.couponDiscount).toBeGreaterThan(0);

      const redemptions = await query(
        `SELECT id FROM coupon_redemptions WHERE code = 'FIRST5' AND phone = $1`,
        [PHONE],
      );
      expect(redemptions, 'the redemption must be recorded').toHaveLength(1);

      const second = await placeOrder(input({ couponCode: 'FIRST5' }));
      expect(second.ok).toBe(false);
      if (second.ok || second.code !== 'invalid_quote') return;
      expect(second.issues.some((issue) => issue.code === 'coupon_invalid')).toBe(true);
    });

    it('does not record a redemption for an order that was refused', async () => {
      const shown = await buildQuote({ lines: [{ variantId, quantity: 1 }] });
      reprice(variantId, shown.totals.total + 500_00);

      await placeOrder(input({ couponCode: 'FIRST5', expectedTotal: shown.totals.total }));

      const redemptions = await query(
        `SELECT id FROM coupon_redemptions WHERE code = 'FIRST5' AND phone = $1`,
        [PHONE],
      );
      expect(redemptions).toHaveLength(0);
    });

    it('leaves multi-use coupons alone', async () => {
      // FREESHIP has no per-customer limit and must stay reusable.
      const first = await placeOrder(input({ couponCode: 'FREESHIP' }));
      const second = await placeOrder(input({ couponCode: 'FREESHIP' }));

      expect(first.ok).toBe(true);
      expect(second.ok, 'FREESHIP must not be treated as single-use').toBe(true);
    });
  });
});
