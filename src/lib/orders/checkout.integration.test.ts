import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { PostgresOrderRepository } from './postgres-repository';
import { generateOrderNumber } from './numbering';
import type { NewOrder } from './types';

/**
 * Checkout integration tests against the local `itarang_dev` database.
 *
 * These need a live connection, so they are skipped when `DATABASE_URL` is not
 * configured — and skipped loudly, because a silently-absent integration suite
 * is worse than none at all.
 *
 *   npm run db:create && npm run db:migrate
 *   npm run test
 *
 * The guard in `src/lib/db/guard.ts` still applies: these cannot run against
 * anything but a local `itarang_dev`.
 */

/**
 * These tests write real rows. Against a remote database that means seeding
 * live order data with test buyers, so the remote case has to be asked for
 * explicitly — the more so because `vitest.setup.ts` resolves a duplicated
 * `DATABASE_URL` differently from the application, and "which database is this
 * pointing at?" is not a question a destructive suite should get wrong.
 */
function targetsRemote(): boolean {
  // Decided by the URL this runner actually resolved, not by DB_ALLOW_REMOTE —
  // that flag can be set for the application while vitest still resolves a
  // local URL, and a wrong answer here would skip a suite that could run.
  const raw = process.env.DATABASE_URL;
  if (!raw) return false;
  try {
    return !isLocalHost(inspectDatabaseUrl(raw).host);
  } catch {
    return false;
  }
}

const REMOTE = targetsRemote();
const REMOTE_TESTS_ALLOWED = process.env.DB_ALLOW_REMOTE_TESTS === 'true';

const CONFIGURED = Boolean(process.env.DATABASE_URL) && (!REMOTE || REMOTE_TESTS_ALLOWED);

if (!CONFIGURED) {
  console.warn(
    REMOTE
      ? '\n  [skipped] Checkout integration tests write real rows and DATABASE_URL is ' +
          'remote. Set DB_ALLOW_REMOTE_TESTS=true to run them anyway.\n'
      : '\n  [skipped] Checkout integration tests need DATABASE_URL pointing at a local ' +
          'itarang_dev database. See README → Database.\n',
  );
}

const VARIANT = 'test-variant-alpha';

function draftOrder(overrides: Partial<NewOrder> = {}): NewOrder {
  return {
    orderNumber: generateOrderNumber(),
    contact: { name: 'Integration Buyer', phone: '9000000099' },
    shippingAddress: {
      line1: '1 Test Street',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
    },
    amounts: {
      subtotal: 100000,
      productSavings: 0,
      couponDiscount: 0,
      shipping: 39900,
      codFee: 0,
      total: 139900,
      gstAmount: 21341,
      gstRate: 0.18,
    },
    items: [
      {
        productId: 'test-product',
        variantId: VARIANT,
        sku: 'TEST-SKU',
        title: 'Test product',
        unitMrp: 120000,
        unitPrice: 100000,
        quantity: 1,
        lineTotal: 100000,
        taxRate: 0.18,
        installationIncluded: true,
      },
    ],
    paymentMethod: 'cod',
    isTest: true,
    status: 'confirmed',
    paymentStatus: 'pending',
    ...overrides,
  };
}

describe.skipIf(!CONFIGURED)('checkout against the local database', () => {
  const repository = new PostgresOrderRepository();

  beforeEach(async () => {
    // Remove only this suite's own rows.
    await query(`DELETE FROM orders WHERE customer_phone = '9000000099'`);
    await query(`DELETE FROM stock_reservations WHERE variant_id = $1`, [VARIANT]);
    await query(`DELETE FROM webhook_events WHERE event_id LIKE 'test_evt_%'`);
    await query(
      `INSERT INTO inventory_baseline (variant_id, hostinger_quantity)
       VALUES ($1, 3)
       ON CONFLICT (variant_id) DO UPDATE SET hostinger_quantity = 3`,
      [VARIANT],
    );
  });

  afterAll(async () => {
    await closePool();
  });

  it('places a COD order, reserves stock and records the event', async () => {
    const result = await repository.createOrder({
      order: draftOrder(),
      reservations: [{ variantId: VARIANT, quantity: 1 }],
      availableByVariant: { [VARIANT]: 3 },
      reservationTtlMinutes: 15,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.order.items).toHaveLength(1);
    expect(result.order.amounts.total).toBe(139900);
    expect(result.order.isTest).toBe(true);

    const reservations = await repository.listReservations(result.order.id);
    expect(reservations).toHaveLength(1);
    expect(reservations[0].state).toBe('active');

    const events = await repository.listEvents(result.order.id);
    expect(events.length).toBeGreaterThan(0);
  });

  it('returns the same order for a repeated idempotency key', async () => {
    const key = `test-key-${Date.now()}`;

    const first = await repository.createOrder({
      order: draftOrder({ idempotencyKey: key }),
      reservations: [{ variantId: VARIANT, quantity: 1 }],
      availableByVariant: { [VARIANT]: 3 },
      reservationTtlMinutes: 15,
    });

    const second = await repository.createOrder({
      order: draftOrder({ idempotencyKey: key }),
      reservations: [{ variantId: VARIANT, quantity: 1 }],
      availableByVariant: { [VARIANT]: 3 },
      reservationTtlMinutes: 15,
    });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(second.reused).toBe(true);
    expect(second.order.id).toBe(first.order.id);

    // Critically: no second reservation was taken.
    const reservations = await repository.listReservations(first.order.id);
    expect(reservations).toHaveLength(1);
  });

  it('refuses to oversell', async () => {
    const result = await repository.createOrder({
      order: draftOrder(),
      reservations: [{ variantId: VARIANT, quantity: 4 }], // baseline is 3
      availableByVariant: { [VARIANT]: 3 },
      reservationTtlMinutes: 15,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('insufficient_stock');
    expect(result.available).toBe(3);
  });

  it('lets only one of two concurrent checkouts take the last unit', async () => {
    await query(`UPDATE inventory_baseline SET hostinger_quantity = 1 WHERE variant_id = $1`, [
      VARIANT,
    ]);

    const attempt = () =>
      repository.createOrder({
        order: draftOrder(),
        reservations: [{ variantId: VARIANT, quantity: 1 }],
        availableByVariant: { [VARIANT]: 1 },
        reservationTtlMinutes: 15,
      });

    const [a, b] = await Promise.all([attempt(), attempt()]);

    const succeeded = [a, b].filter((r) => r.ok);
    const failed = [a, b].filter((r) => !r.ok);

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
  });

  it('ignores an expired reservation when computing availability', async () => {
    const result = await repository.createOrder({
      order: draftOrder(),
      reservations: [{ variantId: VARIANT, quantity: 3 }],
      availableByVariant: { [VARIANT]: 3 },
      reservationTtlMinutes: 15,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect((await repository.availability([VARIANT]))[VARIANT]).toBe(0);

    // Age the reservation past its expiry without running any sweep.
    await query(
      `UPDATE stock_reservations SET expires_at = now() - interval '1 minute'
        WHERE order_id = $1`,
      [result.order.id],
    );

    // Availability recovers on read alone — no scheduler involved.
    expect((await repository.availability([VARIANT]))[VARIANT]).toBe(3);
  });

  it('consumes reservations when payment succeeds', async () => {
    const result = await repository.createOrder({
      order: draftOrder({ status: 'pending_payment', paymentMethod: 'mock' }),
      reservations: [{ variantId: VARIANT, quantity: 1 }],
      availableByVariant: { [VARIANT]: 3 },
      reservationTtlMinutes: 15,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const updated = await repository.applyPaymentStatus(result.order.id, 'paid', 'test');
    expect(updated?.paymentStatus).toBe('paid');
    expect(updated?.status).toBe('confirmed');

    const reservations = await repository.listReservations(result.order.id);
    expect(reservations[0].state).toBe('consumed');
  });

  it('never moves a payment backwards when events arrive out of order', async () => {
    const result = await repository.createOrder({
      order: draftOrder({ status: 'pending_payment', paymentMethod: 'mock' }),
      reservations: [{ variantId: VARIANT, quantity: 1 }],
      availableByVariant: { [VARIANT]: 3 },
      reservationTtlMinutes: 15,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await repository.applyPaymentStatus(result.order.id, 'paid', 'webhook');
    // A late 'authorized' must not undo the capture.
    const after = await repository.applyPaymentStatus(result.order.id, 'authorized', 'webhook');

    expect(after?.paymentStatus).toBe('paid');
  });

  it('treats a duplicate webhook event as a no-op', async () => {
    const eventId = `test_evt_${Date.now()}`;

    const first = await repository.beginWebhookEvent('mock', eventId, 'payment.captured', {});
    const second = await repository.beginWebhookEvent('mock', eventId, 'payment.captured', {});

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('releases reservations when an order is cancelled', async () => {
    const result = await repository.createOrder({
      order: draftOrder({ status: 'pending_payment', paymentMethod: 'mock' }),
      reservations: [{ variantId: VARIANT, quantity: 2 }],
      availableByVariant: { [VARIANT]: 3 },
      reservationTtlMinutes: 15,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await repository.transitionOrderStatus(result.order.id, 'cancelled', 'test');

    const reservations = await repository.listReservations(result.order.id);
    expect(reservations[0].state).toBe('released');
    expect((await repository.availability([VARIANT]))[VARIANT]).toBe(3);
  });

  it('finds an order for the customer only with the right phone number', async () => {
    const result = await repository.createOrder({
      order: draftOrder(),
      reservations: [{ variantId: VARIANT, quantity: 1 }],
      availableByVariant: { [VARIANT]: 3 },
      reservationTtlMinutes: 15,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const found = await repository.findForCustomer(result.order.orderNumber, '9000000099');
    const wrong = await repository.findForCustomer(result.order.orderNumber, '9000000000');

    expect(found?.id).toBe(result.order.id);
    expect(wrong).toBeNull();
  });
});
