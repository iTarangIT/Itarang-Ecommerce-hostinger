import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';

/**
 * Pushing sold units to Hostinger, against the local `itarang_dev` database.
 *
 * The endpoint this drives sets an ABSOLUTE quantity, offers no
 * compare-and-swap and accepts no idempotency key. So the property under test
 * throughout is not "does it decrement" — that part is easy — but "can it ever
 * decrement twice". Every scenario below exists because a naive
 * `order paid -> send decrement` gets it wrong:
 *
 *   timeout then retry, write landed      would decrement twice
 *   timeout then retry, write lost        would silently lose the deduction
 *   merchant edits hPanel mid-flight      would clobber a restock
 *   duplicate webhook                     would enqueue twice
 *   two drains at once                    would both read 5 and both write 4
 *
 * The three tests to read first are "settles without a second write after a
 * timeout that actually landed", "stops and alerts when hPanel changed
 * underneath it", and "two purchases of the same variant each decrement once".
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
      ? '\n  [skipped] Inventory push tests write real rows and DATABASE_URL is remote. ' +
          'Set DB_ALLOW_REMOTE_TESTS=true to run them anyway.\n'
      : '\n  [skipped] Inventory push tests need DATABASE_URL pointing at a local itarang_dev.\n',
  );
}

/* --------------------------------------------------------------- doubles */

const readVariantInventory = vi.fn();
const setVariantInventory = vi.fn();
const pushEnabled = { value: true };

class FakeAdminError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly path: string,
    readonly indeterminate: boolean,
  ) {
    super(message);
    this.name = 'HostingerAdminError';
  }
}

vi.mock('@/lib/commerce/hostinger/admin-client', () => ({
  HostingerAdminError: FakeAdminError,
  readVariantInventory: (...args: unknown[]) => readVariantInventory(...args),
  setVariantInventory: (...args: unknown[]) => setVariantInventory(...args),
  inventoryPushEnabled: () => pushEnabled.value,
}));

/* -------------------------------------------------------------- fixtures */

/**
 * Cleanup marker. Must be unique across the whole suite — every integration
 * test here deletes its own rows by one of these, and two files sharing a
 * number means one silently deletes the other's fixtures mid-run.
 * Taken: 33 place-order, 55 analytics, 66 enqueue, 77 reconciliation,
 * 88 webhook, 99 checkout.
 */
const PHONE = '9000000044';
const VARIANT = 'variant_push_test';
const PRODUCT = 'prod_push_test';

/** Live stock the fake Hostinger reports. */
function live(quantity: number, managed = true) {
  readVariantInventory.mockResolvedValue([{ variantId: VARIANT, quantity, managed }]);
}

/**
 * A paid order holding a consumed, unreconciled reservation, plus its job.
 *
 * Built directly rather than through `placeOrder` so the test controls the
 * exact ledger state under examination. Scoped to one phone number so cleanup
 * can delete precisely these rows, matching every other integration test here.
 */
async function seedJob(units = 1, variant = VARIANT): Promise<{ orderId: number; jobId: number }> {
  const [order] = await query<{ id: number }>(
    `INSERT INTO orders
       (order_number, status, payment_status, customer_name, customer_phone,
        shipping_address, subtotal, total, payment_method, is_test)
     VALUES ('ITG-PUSH-' || substr(md5(random()::text), 1, 8), 'confirmed', 'paid',
             'Push Test', $1, '{}'::jsonb, 100000, 100000, 'razorpay-test', true)
     RETURNING id`,
    [PHONE],
  );

  await query(
    `INSERT INTO order_items
       (order_id, product_id, variant_id, sku, title, unit_mrp, unit_price, quantity, line_total)
     VALUES ($1, $2, $3, 'SKU-PUSH', 'Push Test', 100000, 100000, $4, 100000)`,
    [order.id, PRODUCT, variant, units],
  );

  const [reservation] = await query<{ id: string }>(
    `INSERT INTO stock_reservations (variant_id, order_id, quantity, state, expires_at)
     VALUES ($1, $2, $3, 'consumed', now() + interval '1 hour')
     RETURNING id`,
    [variant, order.id, units],
  );

  const [job] = await query<{ id: number }>(
    `INSERT INTO inventory_sync_jobs
       (order_id, variant_id, hostinger_product_id, units, reservation_ids)
     VALUES ($1, $2, $3, $4, ARRAY[$5]::bigint[])
     RETURNING id`,
    [order.id, variant, PRODUCT, units, reservation.id],
  );

  return { orderId: order.id, jobId: job.id };
}

async function jobState(id: number) {
  const [row] = await query<{
    state: string;
    attempts: number;
    expected_before: number | null;
    expected_after: number | null;
    last_error: string | null;
  }>(
    `SELECT state, attempts, expected_before, expected_after, last_error
       FROM inventory_sync_jobs WHERE id = $1`,
    [id],
  );
  return row;
}

async function reconciledCount(orderId: number): Promise<number> {
  const [row] = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM stock_reservations
      WHERE order_id = $1 AND reconciled_at IS NOT NULL`,
    [orderId],
  );
  return row?.n ?? 0;
}

async function baselineFor(variant = VARIANT): Promise<number | null> {
  const [row] = await query<{ hostinger_quantity: number }>(
    `SELECT hostinger_quantity FROM inventory_baseline WHERE variant_id = $1`,
    [variant],
  );
  return row?.hostinger_quantity ?? null;
}

async function cleanup(): Promise<void> {
  // Scoped: only rows this suite created. Orders cascade to items,
  // reservations and jobs.
  await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
  await query(`DELETE FROM inventory_baseline WHERE variant_id LIKE 'variant_push_test%'`);
  // Scoped to this suite's own variants: a blanket delete by kind would wipe a
  // genuine drift alert raised by a real sale.
  await query(`DELETE FROM catalogue_alerts WHERE kind = 'inventory_drift' AND subject LIKE 'variant_push_test%'`);
}

describe.runIf(CONFIGURED)('inventory push', () => {
  let drainInventoryQueue: typeof import('./inventory-push').drainInventoryQueue;

  beforeEach(async () => {
    vi.clearAllMocks();
    pushEnabled.value = true;
    ({ drainInventoryQueue } = await import('./inventory-push'));
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await closePool();
  });

  /* ------------------------------------------------------- happy path */

  it('decrements by the units sold and settles the ledger', async () => {
    const { orderId, jobId } = await seedJob(1);
    live(5);
    setVariantInventory.mockResolvedValue(4);

    const outcome = await drainInventoryQueue();

    expect(outcome.applied).toBe(1);
    expect(setVariantInventory).toHaveBeenCalledWith(PRODUCT, VARIANT, 4);
    expect((await jobState(jobId)).state).toBe('applied');
    // The sale stops counting against the local baseline, which is the whole
    // point of `reconciled_at`.
    expect(await reconciledCount(orderId)).toBe(1);
    expect(await baselineFor()).toBe(4);
  });

  it('handles a multi-unit purchase in one write', async () => {
    const { jobId } = await seedJob(3);
    live(10);
    setVariantInventory.mockResolvedValue(7);

    await drainInventoryQueue();

    expect(setVariantInventory).toHaveBeenCalledWith(PRODUCT, VARIANT, 7);
    expect((await jobState(jobId)).state).toBe('applied');
  });

  it('never asks Hostinger for a negative quantity', async () => {
    await seedJob(5);
    live(2); // upstream already lower than we sold
    setVariantInventory.mockResolvedValue(0);

    await drainInventoryQueue();

    expect(setVariantInventory).toHaveBeenCalledWith(PRODUCT, VARIANT, 0);
  });

  /* ------------------------------------------- already applied / retry */

  it('is a no-op once the job is applied', async () => {
    const { jobId } = await seedJob(1);
    live(5);
    setVariantInventory.mockResolvedValue(4);

    await drainInventoryQueue();
    setVariantInventory.mockClear();

    // A second drain — an admin pressing the button again, or another webhook.
    const second = await drainInventoryQueue();

    expect(second.claimed).toBe(0);
    expect(setVariantInventory).not.toHaveBeenCalled();
    expect((await jobState(jobId)).state).toBe('applied');
  });

  it('settles without a second write after a timeout that actually landed', async () => {
    // THE case this whole design exists for. The PATCH timed out, so the
    // outcome was unknown — but it had in fact applied.
    const { orderId, jobId } = await seedJob(1);
    live(5);
    setVariantInventory.mockRejectedValueOnce(
      new FakeAdminError('socket hang up', null, 'variants/batch', true),
    );

    await drainInventoryQueue();

    let state = await jobState(jobId);
    expect(state.state).toBe('pending');
    expect(state.attempts).toBe(1);
    // Recorded before the request went out, which is what makes the next line
    // decidable rather than a guess.
    expect(state.expected_before).toBe(5);
    expect(state.expected_after).toBe(4);
    expect(state.last_error).toContain('indeterminate');

    // Retry: Hostinger now reports 4, so the write did land.
    live(4);
    setVariantInventory.mockClear();
    const outcome = await drainInventoryQueue();

    expect(outcome.alreadyApplied).toBe(1);
    expect(setVariantInventory).not.toHaveBeenCalled(); // <- no double decrement
    state = await jobState(jobId);
    expect(state.state).toBe('applied');
    expect(await reconciledCount(orderId)).toBe(1);
    expect(await baselineFor()).toBe(4);
  });

  it('re-sends after a timeout that did not land', async () => {
    const { jobId } = await seedJob(1);
    live(5);
    setVariantInventory.mockRejectedValueOnce(
      new FakeAdminError('timed out', null, 'variants/batch', true),
    );

    await drainInventoryQueue();
    expect((await jobState(jobId)).state).toBe('pending');

    // Still 5 upstream, so the write was lost and re-sending is correct.
    live(5);
    setVariantInventory.mockResolvedValue(4);
    const outcome = await drainInventoryQueue();

    expect(outcome.applied).toBe(1);
    expect(setVariantInventory).toHaveBeenCalledWith(PRODUCT, VARIANT, 4);
    expect((await jobState(jobId)).state).toBe('applied');
  });

  /* --------------------------------------------------------- drift */

  it('stops and alerts when hPanel changed underneath it', async () => {
    const { orderId, jobId } = await seedJob(1);
    live(5);
    setVariantInventory.mockRejectedValueOnce(
      new FakeAdminError('timed out', null, 'variants/batch', true),
    );
    await drainInventoryQueue();

    // The merchant restocked to 20 while the job was in flight. 20 is neither
    // the before (5) nor the after (4), so nothing here can be inferred.
    live(20);
    setVariantInventory.mockClear();
    const outcome = await drainInventoryQueue();

    expect(outcome.drift).toBe(1);
    expect(setVariantInventory).not.toHaveBeenCalled();
    expect((await jobState(jobId)).state).toBe('drift');
    // Not settled: the units are still owed upstream.
    expect(await reconciledCount(orderId)).toBe(0);

    const [alert] = await query<{ subject: string }>(
      `SELECT subject FROM catalogue_alerts WHERE kind = 'inventory_drift' AND resolved_at IS NULL`,
    );
    expect(alert?.subject).toBe(VARIANT);
  });

  it('treats a write that reports the wrong number as drift', async () => {
    const { jobId } = await seedJob(1);
    live(5);
    // 200 OK, but the body says something other than what we asked for.
    setVariantInventory.mockResolvedValue(9);

    const outcome = await drainInventoryQueue();

    expect(outcome.drift).toBe(1);
    expect((await jobState(jobId)).state).toBe('drift');
    // The baseline must not record a number Hostinger does not have.
    expect(await baselineFor()).toBeNull();
  });

  /* ----------------------------------------------- hostinger failure */

  it('retries a read failure without writing anything', async () => {
    const { jobId } = await seedJob(1);
    readVariantInventory.mockRejectedValue(new FakeAdminError('503', 503, 'variants', false));

    const outcome = await drainInventoryQueue();

    expect(outcome.applied).toBe(0);
    expect(setVariantInventory).not.toHaveBeenCalled();
    const state = await jobState(jobId);
    expect(state.state).toBe('pending');
    expect(state.attempts).toBe(1);
    // Nothing was attempted, so there is nothing to verify against later.
    expect(state.expected_after).toBeNull();
  });

  it('retries a rejected write', async () => {
    const { jobId } = await seedJob(1);
    live(5);
    setVariantInventory.mockRejectedValue(
      new FakeAdminError('500 Internal Server Error', 500, 'variants/batch', false),
    );

    await drainInventoryQueue();

    const state = await jobState(jobId);
    expect(state.state).toBe('pending');
    expect(state.attempts).toBe(1);
  });

  it('gives up after repeated failures and leaves the job for a human', async () => {
    const { orderId, jobId } = await seedJob(1);
    live(5);
    setVariantInventory.mockRejectedValue(
      new FakeAdminError('500', 500, 'variants/batch', false),
    );

    for (let attempt = 0; attempt < 6; attempt += 1) await drainInventoryQueue();

    const state = await jobState(jobId);
    expect(state.state).toBe('failed');
    expect(state.attempts).toBe(5);
    // Never silently settled: the units are still owed.
    expect(await reconciledCount(orderId)).toBe(0);
  });

  /* --------------------------------------------------------- skips */

  it('skips a variant that no longer exists upstream', async () => {
    const { jobId } = await seedJob(1);
    readVariantInventory.mockResolvedValue([]); // product recreated in hPanel

    const outcome = await drainInventoryQueue();

    expect(outcome.skipped).toBe(1);
    expect(setVariantInventory).not.toHaveBeenCalled();
    expect((await jobState(jobId)).state).toBe('skipped');
  });

  it('skips a variant that does not track inventory upstream', async () => {
    const { jobId } = await seedJob(1);
    live(5, false);

    const outcome = await drainInventoryQueue();

    expect(outcome.skipped).toBe(1);
    expect(setVariantInventory).not.toHaveBeenCalled();
    expect((await jobState(jobId)).state).toBe('skipped');
  });

  it('does nothing at all when the push is switched off', async () => {
    const { jobId } = await seedJob(1);
    pushEnabled.value = false;

    const outcome = await drainInventoryQueue();

    expect(outcome.claimed).toBe(0);
    expect(readVariantInventory).not.toHaveBeenCalled();
    // The job survives, so switching the feature on later settles the backlog.
    expect((await jobState(jobId)).state).toBe('pending');
  });

  /* ------------------------------------------ concurrency / duplicates */

  it('refuses a duplicate job for the same order and variant', async () => {
    const { orderId } = await seedJob(1);

    // What a redelivered webhook would attempt.
    await query(
      `INSERT INTO inventory_sync_jobs
         (order_id, variant_id, hostinger_product_id, units, reservation_ids)
       VALUES ($1, $2, $3, 1, ARRAY[]::bigint[])
       ON CONFLICT (order_id, variant_id) DO NOTHING`,
      [orderId, VARIANT, PRODUCT],
    );

    const [row] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM inventory_sync_jobs WHERE order_id = $1`,
      [orderId],
    );
    expect(row.n).toBe(1);
  });

  it('decrements once per purchase when two customers buy the same variant', async () => {
    await seedJob(1);
    await seedJob(1);

    // Both jobs drain in one pass. Each must read the quantity the previous one
    // left behind, not the value both started from.
    let stock = 5;
    readVariantInventory.mockImplementation(async () => [
      { variantId: VARIANT, quantity: stock, managed: true },
    ]);
    setVariantInventory.mockImplementation(async (_p: string, _v: string, q: number) => {
      stock = q;
      return q;
    });

    const outcome = await drainInventoryQueue();

    expect(outcome.applied).toBe(2);
    expect(setVariantInventory).toHaveBeenNthCalledWith(1, PRODUCT, VARIANT, 4);
    expect(setVariantInventory).toHaveBeenNthCalledWith(2, PRODUCT, VARIANT, 3);
    // Two units sold, two units gone. Not one.
    expect(stock).toBe(3);
    expect(await baselineFor()).toBe(3);
  });

  it('keeps separate variants independent', async () => {
    await seedJob(1, VARIANT);
    await seedJob(2, `${VARIANT}_b`);

    readVariantInventory.mockImplementation(async (_product: string) => [
      { variantId: VARIANT, quantity: 5, managed: true },
      { variantId: `${VARIANT}_b`, quantity: 9, managed: true },
    ]);
    setVariantInventory.mockImplementation(async (_p: string, _v: string, q: number) => q);

    const outcome = await drainInventoryQueue();

    expect(outcome.applied).toBe(2);
    expect(setVariantInventory).toHaveBeenCalledWith(PRODUCT, VARIANT, 4);
    expect(setVariantInventory).toHaveBeenCalledWith(PRODUCT, `${VARIANT}_b`, 7);
  });
});
