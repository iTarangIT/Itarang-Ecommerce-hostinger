import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { PostgresOrderRepository } from './postgres-repository';
import { generateOrderNumber } from './numbering';
import type { NewOrder } from './types';

/**
 * Webhook durability and payment-attempt history.
 *
 * These cover the two failure modes that lose money rather than merely
 * inconveniencing somebody: a payment update dropped between "recorded" and
 * "applied", and a capture arriving for a gateway order that a retry replaced.
 *
 * Same gating as the other database suites.
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
    '\n  [skipped] Webhook integration tests write real rows. Set DB_ALLOW_REMOTE_TESTS=true ' +
      'to run them against a remote database.\n',
  );
}

const VARIANT = 'webhook-suite-variant';
const PHONE = '9000000088';
const PROVIDER = 'mock';

function draftOrder(overrides: Partial<NewOrder> = {}): NewOrder {
  return {
    orderNumber: generateOrderNumber(),
    contact: { name: 'Webhook Buyer', phone: PHONE },
    shippingAddress: { line1: '1 Test Street', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
    amounts: {
      subtotal: 100000,
      productSavings: 0,
      couponDiscount: 0,
      shipping: 0,
      codFee: 0,
      total: 100000,
      gstAmount: 15254,
      gstRate: 0.18,
    },
    items: [
      {
        productId: 'p',
        variantId: VARIANT,
        sku: 'WH-SKU',
        title: 'Webhook product',
        unitMrp: 100000,
        unitPrice: 100000,
        quantity: 1,
        lineTotal: 100000,
        taxRate: 0.18,
        installationIncluded: false,
      },
    ],
    paymentMethod: 'mock',
    isTest: true,
    status: 'pending_payment',
    paymentStatus: 'pending',
    ...overrides,
  };
}

describe.skipIf(!CONFIGURED)('webhook durability', () => {
  const repository = new PostgresOrderRepository();

  beforeEach(async () => {
    await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
    await query(`DELETE FROM webhook_events WHERE event_id LIKE 'whsuite_%'`);
    await query(
      `INSERT INTO inventory_baseline (variant_id, hostinger_quantity) VALUES ($1, 50)
       ON CONFLICT (variant_id) DO UPDATE SET hostinger_quantity = 50`,
      [VARIANT],
    );
  });

  afterAll(async () => {
    await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
    await query(`DELETE FROM webhook_events WHERE event_id LIKE 'whsuite_%'`);
    await query(`DELETE FROM inventory_baseline WHERE variant_id = $1`, [VARIANT]);
    await closePool();
  });

  it('claims an event without marking it processed', async () => {
    const id = `whsuite_${Date.now()}_a`;
    expect(await repository.beginWebhookEvent(PROVIDER, id, 'payment.captured', {})).toBe(true);

    const rows = await query<{ processed_at: Date | null }>(
      `SELECT processed_at FROM webhook_events WHERE event_id = $1`,
      [id],
    );
    // The old behaviour stamped this at insert, which is what made a failure
    // mid-processing unrecoverable.
    expect(rows[0]!.processed_at).toBeNull();
  });

  it('refuses a redelivery of a claimed event', async () => {
    const id = `whsuite_${Date.now()}_b`;
    expect(await repository.beginWebhookEvent(PROVIDER, id, 'payment.captured', {})).toBe(true);
    expect(await repository.beginWebhookEvent(PROVIDER, id, 'payment.captured', {})).toBe(false);
  });

  it('stamps processed_at only on completion', async () => {
    const id = `whsuite_${Date.now()}_c`;
    await repository.beginWebhookEvent(PROVIDER, id, 'payment.captured', {});
    await repository.completeWebhookEvent(PROVIDER, id);

    const rows = await query<{ processed_at: Date | null }>(
      `SELECT processed_at FROM webhook_events WHERE event_id = $1`,
      [id],
    );
    expect(rows[0]!.processed_at).not.toBeNull();
  });

  it('lets the gateway retry after an abandoned claim', async () => {
    const id = `whsuite_${Date.now()}_d`;
    await repository.beginWebhookEvent(PROVIDER, id, 'payment.captured', {});

    // Processing threw; the claim is released.
    await repository.abandonWebhookEvent(PROVIDER, id);

    // The retry must be allowed through, not dismissed as a duplicate.
    expect(await repository.beginWebhookEvent(PROVIDER, id, 'payment.captured', {})).toBe(true);
  });

  it('will not abandon an event that already completed', async () => {
    const id = `whsuite_${Date.now()}_e`;
    await repository.beginWebhookEvent(PROVIDER, id, 'payment.captured', {});
    await repository.completeWebhookEvent(PROVIDER, id);
    await repository.abandonWebhookEvent(PROVIDER, id);

    // Still recorded, so a genuine redelivery is still a no-op.
    expect(await repository.beginWebhookEvent(PROVIDER, id, 'payment.captured', {})).toBe(false);
  });

  it('reports claimed-but-unapplied events as work to be looked at', async () => {
    const id = `whsuite_${Date.now()}_f`;
    await repository.beginWebhookEvent(PROVIDER, id, 'payment.captured', {});
    await query(
      `UPDATE webhook_events SET received_at = now() - interval '1 hour' WHERE event_id = $1`,
      [id],
    );

    const stuck = await repository.unprocessedWebhookEvents(5);
    expect(stuck.map((e) => e.eventId)).toContain(id);

    await repository.completeWebhookEvent(PROVIDER, id);
    expect((await repository.unprocessedWebhookEvents(5)).map((e) => e.eventId)).not.toContain(id);
  });
});

describe.skipIf(!CONFIGURED)('payment attempts', () => {
  const repository = new PostgresOrderRepository();

  beforeEach(async () => {
    await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
    await query(
      `INSERT INTO inventory_baseline (variant_id, hostinger_quantity) VALUES ($1, 50)
       ON CONFLICT (variant_id) DO UPDATE SET hostinger_quantity = 50`,
      [VARIANT],
    );
  });

  afterAll(async () => {
    await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
    await closePool();
  });

  async function newOrder() {
    const result = await repository.createOrder({
      order: draftOrder(),
      reservations: [{ variantId: VARIANT, quantity: 1 }],
      availableByVariant: { [VARIANT]: 50 },
      reservationTtlMinutes: 15,
    });
    if (!result.ok) throw new Error('fixture order could not be created');
    return result.order;
  }

  it('records every gateway order, not just the latest', async () => {
    const order = await newOrder();

    await repository.setGatewayOrderId(order.id, 'gw_attempt_one', PROVIDER);
    await repository.setGatewayOrderId(order.id, 'gw_attempt_two', PROVIDER);

    const attempts = await repository.listPaymentAttempts(order.id);
    expect(attempts.map((a) => a.gatewayOrderId)).toEqual(['gw_attempt_two', 'gw_attempt_one']);
  });

  it('marks the replaced attempt superseded and leaves the newest open', async () => {
    const order = await newOrder();
    await repository.setGatewayOrderId(order.id, 'gw_sup_one', PROVIDER);
    await repository.setGatewayOrderId(order.id, 'gw_sup_two', PROVIDER);

    const attempts = await repository.listPaymentAttempts(order.id);
    expect(attempts.find((a) => a.gatewayOrderId === 'gw_sup_one')!.supersededAt).not.toBeNull();
    expect(attempts.find((a) => a.gatewayOrderId === 'gw_sup_two')!.supersededAt).toBeNull();
  });

  it('still resolves an order from a superseded gateway order id', async () => {
    // The bug this exists for: the shopper paid on the first attempt, a retry
    // overwrote orders.gateway_order_id, and the capture webhook for the first
    // attempt then matched nothing — customer charged, order left unpaid.
    const order = await newOrder();
    await repository.setGatewayOrderId(order.id, 'gw_old_attempt', PROVIDER);
    await repository.setGatewayOrderId(order.id, 'gw_new_attempt', PROVIDER);

    const viaOld = await repository.findByGatewayOrderId('gw_old_attempt');
    const viaNew = await repository.findByGatewayOrderId('gw_new_attempt');

    expect(viaOld?.id).toBe(order.id);
    expect(viaNew?.id).toBe(order.id);
  });

  it('does not resolve a gateway order id we never issued', async () => {
    expect(await repository.findByGatewayOrderId('gw_never_issued')).toBeNull();
  });

  it('is idempotent when the same gateway order is set twice', async () => {
    const order = await newOrder();
    await repository.setGatewayOrderId(order.id, 'gw_same', PROVIDER);
    await repository.setGatewayOrderId(order.id, 'gw_same', PROVIDER);

    const attempts = await repository.listPaymentAttempts(order.id);
    expect(attempts.filter((a) => a.gatewayOrderId === 'gw_same')).toHaveLength(1);
    // Setting the same id again is not a new attempt, so nothing is superseded.
    expect(attempts[0]!.supersededAt).toBeNull();
  });
});

describe.skipIf(!CONFIGURED)('state machine and idempotency under load', () => {
  const repository = new PostgresOrderRepository();

  beforeEach(async () => {
    await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
    await query(
      `INSERT INTO inventory_baseline (variant_id, hostinger_quantity) VALUES ($1, 50)
       ON CONFLICT (variant_id) DO UPDATE SET hostinger_quantity = 50`,
      [VARIANT],
    );
  });

  afterAll(async () => {
    await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
    await closePool();
  });

  async function newOrder(overrides: Partial<NewOrder> = {}) {
    const result = await repository.createOrder({
      order: draftOrder(overrides),
      reservations: [{ variantId: VARIANT, quantity: 1 }],
      availableByVariant: { [VARIANT]: 50 },
      reservationTtlMinutes: 15,
    });
    if (!result.ok) throw new Error('fixture order could not be created');
    return result.order;
  }

  it('refuses a payment transition the model forbids', async () => {
    const order = await newOrder();

    // pending → refunded outranks pending, so the rank gate alone would have
    // let this through. PAYMENT_TRANSITIONS does not allow it.
    const after = await repository.applyPaymentStatus(order.id, 'refunded', 'test');
    expect(after!.paymentStatus).toBe('pending');
  });

  it('allows the transitions the model does permit', async () => {
    const order = await newOrder();

    const paid = await repository.applyPaymentStatus(order.id, 'paid', 'test');
    expect(paid!.paymentStatus).toBe('paid');
    expect(paid!.status).toBe('confirmed');

    const refunded = await repository.applyPaymentStatus(order.id, 'refunded', 'test');
    expect(refunded!.paymentStatus).toBe('refunded');
  });

  it('ignores a stale webhook that would move payment backwards', async () => {
    const order = await newOrder();
    await repository.applyPaymentStatus(order.id, 'paid', 'webhook');

    const late = await repository.applyPaymentStatus(order.id, 'authorized', 'webhook');
    expect(late!.paymentStatus).toBe('paid');
  });

  it('refuses an impossible order transition even when asked directly', async () => {
    const order = await newOrder({ status: 'confirmed' });

    // The admin action validates too, but the repository is the last gate
    // before the write and must not depend on its callers.
    const skipped = await repository.transitionOrderStatus(order.id, 'delivered', 'test');
    expect(skipped!.status).toBe('confirmed');

    const legal = await repository.transitionOrderStatus(order.id, 'packed', 'test');
    expect(legal!.status).toBe('packed');
  });

  it('will not move an order out of a terminal state', async () => {
    const order = await newOrder({ status: 'confirmed' });
    await repository.transitionOrderStatus(order.id, 'cancelled', 'test');

    const attempt = await repository.transitionOrderStatus(order.id, 'packed', 'test');
    expect(attempt!.status).toBe('cancelled');
  });

  it('returns one order, not an error, when the same key races itself', async () => {
    // Two genuinely simultaneous submits: the in-transaction SELECT misses for
    // one of them because the other has not committed, and its INSERT loses on
    // the unique index. That used to surface as an unhandled 500.
    const key = `race-${Date.now()}`;
    const attempt = () =>
      repository.createOrder({
        order: draftOrder({ idempotencyKey: key }),
        reservations: [{ variantId: VARIANT, quantity: 1 }],
        availableByVariant: { [VARIANT]: 50 },
        reservationTtlMinutes: 15,
      });

    const results = await Promise.all([attempt(), attempt(), attempt()]);

    expect(results.every((r) => r.ok)).toBe(true);
    const ids = new Set(results.map((r) => (r.ok ? r.order.id : -1)));
    expect(ids.size).toBe(1);

    // And exactly one reservation, not three.
    const orderId = results.find((r) => r.ok)!.ok
      ? (results[0] as { ok: true; order: { id: number } }).order.id
      : 0;
    const reservations = await repository.listReservations(orderId);
    expect(reservations).toHaveLength(1);
  });
});
