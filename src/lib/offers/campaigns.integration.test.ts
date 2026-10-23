import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { PRODUCTS } from '@/lib/commerce/mock/products';
import { COUPONS_ENABLED } from '@/lib/offers/coupons';
import type { Product } from '@/lib/commerce/types';
import { campaignInputSchema, createCampaign } from './campaign-store';

/**
 * Configurable campaigns, end to end through `placeOrder` against the local
 * `itarang_dev` database: the discount charged is the one the rules allow, and
 * every rule an admin can set refuses the order it should.
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

let catalogue: Product[] = [];

vi.mock('@/lib/catalog/collections', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog/collections')>();
  return { ...actual, allProducts: async () => catalogue };
});

vi.mock('@/lib/commerce', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/commerce')>();
  return { ...actual, activeProviderName: () => 'db' };
});

const PHONE = '9000000044';
const EMAIL = 'campaign-test@itarang.test';
const PREFIX = 'ZZTEST';

async function campaign(patch: Record<string, unknown>) {
  const input = campaignInputSchema.parse({
    name: 'Test campaign',
    label: 'Test offer',
    kind: 'flat',
    amount: '500',
    isActive: true,
    showOnSite: false,
    firstOrderOnly: false,
    ...patch,
  });
  const result = await createCampaign(input, 'campaigns.integration.test');
  if (!result.ok) throw new Error(result.error);
  return input.code;
}

describe.skipIf(!CONFIGURED || !COUPONS_ENABLED)('campaigns at checkout', () => {
  let placeOrder: typeof import('@/lib/orders/place-order').placeOrder;
  let userId: number;
  let variantId: string;

  beforeAll(async () => {
    process.env.PAYMENT_PROVIDER = 'mock';
    const { resetEnvCache } = await import('@/lib/env');
    resetEnvCache();
    ({ placeOrder } = await import('@/lib/orders/place-order'));

    const rows = await query<{ id: number }>(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, 'scrypt.aa.bb', 'customer')
       ON CONFLICT (email) DO UPDATE SET role = 'customer', customer_type = NULL
       RETURNING id`,
      [EMAIL],
    );
    userId = rows[0]!.id;
  });

  beforeEach(async () => {
    await query(`DELETE FROM orders WHERE customer_phone = $1 OR user_id = $2`, [PHONE, userId]);
    await query(`DELETE FROM campaigns WHERE code LIKE $1`, [`${PREFIX}%`]);
    await query(`UPDATE users SET customer_type = NULL WHERE id = $1`, [userId]);
    catalogue = PRODUCTS.slice(0, 4).map((product) => ({
      ...product,
      variants: product.variants.map((variant) => ({ ...variant, price: { ...variant.price } })),
    }));
    variantId = catalogue[0]!.variants[0]!.id;
  });

  afterAll(async () => {
    await query(`DELETE FROM orders WHERE customer_phone = $1 OR user_id = $2`, [PHONE, userId]);
    await query(`DELETE FROM campaigns WHERE code LIKE $1`, [`${PREFIX}%`]);
    await query(`DELETE FROM users WHERE email = $1`, [EMAIL]);
    await closePool();
  });

  function input(overrides: Record<string, unknown> = {}) {
    return {
      userId,
      lines: [{ variantId, quantity: 1 }],
      contact: { name: 'Campaign Buyer', phone: PHONE, email: undefined },
      address: { line1: '1 Test Street', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
      paymentMethod: 'mock' as const,
      idempotencyKey: `campaign-${Math.random().toString(36).slice(2)}`,
      ...overrides,
    };
  }

  const refusal = (result: Awaited<ReturnType<typeof placeOrder>>) =>
    !result.ok && result.code === 'invalid_quote'
      ? result.issues.find((issue) => issue.code === 'coupon_invalid')?.message
      : undefined;

  it('charges a percentage campaign correctly, capped by its maximum', async () => {
    const code = await campaign({ code: `${PREFIX}PCT`, kind: 'percent', amount: '10', maxDiscount: '250' });
    const selling = catalogue[0]!.variants[0]!.price.selling;

    const result = await placeOrder(input({ couponCode: code }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.amounts.couponCode).toBe(code);
    expect(result.order.amounts.couponDiscount).toBe(Math.min(Math.round(selling * 0.1), 25_000));
    expect(result.order.amounts.total).toBe(
      result.order.amounts.subtotal - result.order.amounts.couponDiscount + result.order.amounts.shipping,
    );
  });

  it('refuses a paused campaign and one that has not started', async () => {
    const paused = await campaign({ code: `${PREFIX}OFF`, isActive: false });
    expect(refusal(await placeOrder(input({ couponCode: paused })))).toMatch(/not active/);

    const later = await campaign({ code: `${PREFIX}LATER`, startsAt: '2099-01-01T00:00' });
    expect(refusal(await placeOrder(input({ couponCode: later })))).toMatch(/starts on/);
  });

  it('first order only: allowed once, refused after a confirmed order', async () => {
    const code = await campaign({ code: `${PREFIX}FIRST`, firstOrderOnly: true });

    const first = await placeOrder(input({ couponCode: code }));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    await query(`UPDATE orders SET status = 'confirmed', payment_status = 'paid' WHERE id = $1`, [first.order.id]);

    expect(refusal(await placeOrder(input({ couponCode: code })))).toMatch(/first order/);
  });

  it('restricts by delivery state', async () => {
    const code = await campaign({ code: `${PREFIX}HR`, states: 'Haryana' });
    expect(refusal(await placeOrder(input({ couponCode: code })))).toMatch(/Haryana/);

    const haryana = await placeOrder(
      input({
        couponCode: code,
        address: { line1: '1 Test Street', city: 'Gurugram', state: 'Haryana', pincode: '122001' },
      }),
    );
    expect(haryana.ok).toBe(true);
  });

  it('restricts by customer type and by phone', async () => {
    const dealers = await campaign({ code: `${PREFIX}DEALER`, customerTypes: 'dealer' });
    expect(refusal(await placeOrder(input({ couponCode: dealers })))).toMatch(/not available/);
    await query(`UPDATE users SET customer_type = 'dealer' WHERE id = $1`, [userId]);
    expect((await placeOrder(input({ couponCode: dealers }))).ok).toBe(true);

    const vip = await campaign({ code: `${PREFIX}VIP`, customerPhones: '9111111111' });
    expect(refusal(await placeOrder(input({ couponCode: vip })))).toMatch(/not available/);
  });

  it('gives a once-per-customer code back when its order is cancelled', async () => {
    const code = await campaign({ code: `${PREFIX}ONCE`, maxPerCustomer: '1' });

    const first = await placeOrder(input({ couponCode: code }));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(refusal(await placeOrder(input({ couponCode: code })))).toMatch(/already been used/);

    await query(`UPDATE orders SET status = 'cancelled' WHERE id = $1`, [first.order.id]);
    expect((await placeOrder(input({ couponCode: code }))).ok).toBe(true);
  });

  it('lets only one of two simultaneous orders take the last redemption', async () => {
    const code = await campaign({ code: `${PREFIX}LAST`, maxRedemptionsTotal: '1' });

    const results = await Promise.all([
      placeOrder(input({ couponCode: code })),
      placeOrder(input({ couponCode: code })),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);

    const recorded = await query(`SELECT id FROM coupon_redemptions WHERE code = $1`, [code]);
    expect(recorded).toHaveLength(1);
  });
});
