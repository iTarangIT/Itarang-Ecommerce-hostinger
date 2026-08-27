import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { PostgresOrderRepository } from './postgres-repository';

/**
 * The transactional outbox: enqueueing the Hostinger push when payment lands.
 *
 * `inventory-push.integration.test.ts` covers what happens to a job once it
 * exists. This covers the other half — that a job exists exactly when it should
 * and never twice:
 *
 *   - it is written in the SAME transaction as `payment_status = 'paid'`, so a
 *     sale can never be recorded without the deduction being owed;
 *   - a redelivered webhook, which `applyPaymentStatus` already no-ops on rank,
 *     cannot produce a second job;
 *   - the job settles exactly the reservation rows it counted, not everything
 *     that happens to be consumed for that variant later.
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
      ? '\n  [skipped] Inventory enqueue tests write real rows and DATABASE_URL is remote. ' +
          'Set DB_ALLOW_REMOTE_TESTS=true to run them anyway.\n'
      : '\n  [skipped] Inventory enqueue tests need DATABASE_URL pointing at a local ' +
          'itarang_dev.\n',
  );
}

const PHONE = '9000000066';
const VARIANT = 'variant_enqueue_test';
const PRODUCT = 'prod_enqueue_test';

/** An unpaid order with an active reservation, ready to be paid. */
async function seedPendingOrder(units = 1): Promise<number> {
  const [order] = await query<{ id: number }>(
    `INSERT INTO orders
       (order_number, status, payment_status, customer_name, customer_phone,
        shipping_address, subtotal, total, payment_method, is_test)
     VALUES ('ITG-ENQ-' || substr(md5(random()::text), 1, 8), 'pending_payment', 'pending',
             'Enqueue Test', $1, '{}'::jsonb, 100000, 100000, 'razorpay-test', true)
     RETURNING id`,
    [PHONE],
  );

  await query(
    `INSERT INTO order_items
       (order_id, product_id, variant_id, sku, title, unit_mrp, unit_price, quantity, line_total)
     VALUES ($1, $2, $3, 'SKU-ENQ', 'Enqueue Test', 100000, 100000, $4, 100000)`,
    [order.id, PRODUCT, VARIANT, units],
  );

  await query(
    `INSERT INTO stock_reservations (variant_id, order_id, quantity, state, expires_at)
     VALUES ($1, $2, $3, 'active', now() + interval '1 hour')`,
    [VARIANT, order.id, units],
  );

  return order.id;
}

async function jobsFor(orderId: number) {
  return query<{
    variant_id: string;
    hostinger_product_id: string;
    units: number;
    state: string;
    reservation_ids: string[];
  }>(
    `SELECT variant_id, hostinger_product_id, units, state, reservation_ids
       FROM inventory_sync_jobs WHERE order_id = $1 ORDER BY variant_id`,
    [orderId],
  );
}

async function cleanup(): Promise<void> {
  await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
}

describe.runIf(CONFIGURED)('inventory enqueue', () => {
  const repository = new PostgresOrderRepository();

  beforeEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await closePool();
  });

  it('enqueues a push when payment is captured', async () => {
    const orderId = await seedPendingOrder(2);

    await repository.applyPaymentStatus(orderId, 'paid', 'webhook', 'payment.captured');

    const jobs = await jobsFor(orderId);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      variant_id: VARIANT,
      hostinger_product_id: PRODUCT,
      units: 2,
      state: 'pending',
    });
    // The job names the exact reservation rows it counted, so settling it
    // cannot sweep up a later sale of the same variant.
    expect(jobs[0].reservation_ids).toHaveLength(1);
  });

  it('does not enqueue for a payment that is not a capture', async () => {
    const orderId = await seedPendingOrder(1);

    await repository.applyPaymentStatus(orderId, 'authorized', 'webhook', 'payment.authorized');
    expect(await jobsFor(orderId)).toHaveLength(0);

    await repository.applyPaymentStatus(orderId, 'failed', 'webhook', 'payment.failed');
    expect(await jobsFor(orderId)).toHaveLength(0);
  });

  it('enqueues nothing twice when the webhook is redelivered', async () => {
    const orderId = await seedPendingOrder(1);

    await repository.applyPaymentStatus(orderId, 'paid', 'webhook', 'payment.captured');
    // The gateway states plainly that events may arrive more than once.
    await repository.applyPaymentStatus(orderId, 'paid', 'webhook', 'payment.captured');
    await repository.applyPaymentStatus(orderId, 'paid', 'webhook', 'order.paid');

    const jobs = await jobsFor(orderId);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].units).toBe(1);
  });

  it('ignores a stale authorized arriving after capture', async () => {
    const orderId = await seedPendingOrder(1);

    await repository.applyPaymentStatus(orderId, 'paid', 'webhook', 'payment.captured');
    // Out-of-order delivery: rank-monotonic, so this changes nothing.
    await repository.applyPaymentStatus(orderId, 'authorized', 'webhook', 'payment.authorized');

    const jobs = await jobsFor(orderId);
    expect(jobs).toHaveLength(1);

    const [order] = await query<{ payment_status: string }>(
      `SELECT payment_status FROM orders WHERE id = $1`,
      [orderId],
    );
    expect(order.payment_status).toBe('paid');
  });

  it('keeps separate orders for the same variant as separate jobs', async () => {
    const first = await seedPendingOrder(1);
    const second = await seedPendingOrder(1);

    await repository.applyPaymentStatus(first, 'paid', 'webhook', 'payment.captured');
    await repository.applyPaymentStatus(second, 'paid', 'webhook', 'payment.captured');

    // Two customers, two deductions owed. Collapsing them would lose a unit.
    expect(await jobsFor(first)).toHaveLength(1);
    expect(await jobsFor(second)).toHaveLength(1);
  });

  it('consumes the reservation in the same transaction as the job', async () => {
    const orderId = await seedPendingOrder(1);

    await repository.applyPaymentStatus(orderId, 'paid', 'webhook', 'payment.captured');

    const [reservation] = await query<{ state: string; reconciled_at: Date | null }>(
      `SELECT state, reconciled_at FROM stock_reservations WHERE order_id = $1`,
      [orderId],
    );
    expect(reservation.state).toBe('consumed');
    // Not yet reconciled: the units are sold but not yet deducted upstream,
    // which is exactly what `reconciled_at IS NULL` means.
    expect(reservation.reconciled_at).toBeNull();
    expect(await jobsFor(orderId)).toHaveLength(1);
  });

  it('does not enqueue when the order has no matching item', async () => {
    // A reservation with no order_items row cannot name a Hostinger product,
    // so there is nothing addressable to push.
    const orderId = await seedPendingOrder(1);
    await query(`DELETE FROM order_items WHERE order_id = $1`, [orderId]);

    await repository.applyPaymentStatus(orderId, 'paid', 'webhook', 'payment.captured');

    expect(await jobsFor(orderId)).toHaveLength(0);
  });
});
