import { revalidateTag } from 'next/cache';
import { query, transaction } from '@/lib/db/pool';
import { invalidateCatalogueSnapshot } from '@/lib/commerce/health';
import {
  HostingerAdminError,
  inventoryPushEnabled,
  readVariantInventory,
  setVariantInventory,
} from '@/lib/commerce/hostinger/admin-client';

/**
 * Push sold units back to Hostinger.
 *
 * The trigger is `payment_status → paid`, established by the webhook and
 * nowhere else. Jobs are enqueued inside that same transaction (see
 * `postgres-repository.applyPaymentStatus`), so a job cannot exist without the
 * payment and the payment cannot commit without the job. There is no window.
 *
 * The push itself runs *outside* that transaction, here. Holding a row lock
 * across a 15-second network call would be bad on its own; worse, a Hostinger
 * failure would roll back a payment we have already accepted.
 *
 * **Why this is not "order paid, send decrement".** The endpoint sets an
 * absolute quantity, offers no compare-and-swap, and accepts no idempotency
 * key. A request that times out has an unknown outcome, and a naive retry
 * would decrement twice. So every attempt records what it expects the stock to
 * be before and after, *before* sending anything:
 *
 *     live == expected_after   the previous attempt landed  -> stamp only
 *     live == expected_before  it did not land              -> safe to send
 *     neither                  hPanel changed underneath us -> stop, alert
 *
 * That is what makes a retry after a timeout safe, and it is the single most
 * important property in this file.
 *
 * Restocking is deliberately absent. A refund does not prove saleable stock
 * came back — the unit may be damaged, lost, or never shipped — so cancelled
 * and refunded orders raise an alert for a human instead of silently inflating
 * the merchant's stock.
 */

/** Give up after this many attempts and leave the job for a human. */
const MAX_ATTEMPTS = 5;

export interface PushOutcome {
  claimed: number;
  applied: number;
  alreadyApplied: number;
  drift: number;
  failed: number;
  skipped: number;
}

interface JobRow {
  id: number;
  order_id: number;
  variant_id: string;
  hostinger_product_id: string;
  units: number;
  reservation_ids: string[] | number[];
  expected_before: number | null;
  expected_after: number | null;
  attempts: number;
}

/**
 * Settle a job: stamp its reservations, mirror the new baseline, mark applied.
 *
 * One transaction, because the three have to agree. Stamping without updating
 * the baseline would leave the ledger subtracting units Hostinger has already
 * deducted — the exact double-count `0006` was written to end.
 */
async function settle(job: JobRow, quantity: number): Promise<void> {
  await transaction(async (client) => {
    await client.query(
      `UPDATE stock_reservations SET reconciled_at = now()
        WHERE id = ANY($1::bigint[]) AND reconciled_at IS NULL`,
      [job.reservation_ids],
    );

    await client.query(
      `INSERT INTO inventory_baseline (variant_id, hostinger_quantity, synced_at)
       VALUES ($1, $2, now())
       ON CONFLICT (variant_id)
       DO UPDATE SET hostinger_quantity = EXCLUDED.hostinger_quantity, synced_at = now()`,
      [job.variant_id, Math.max(0, quantity)],
    );

    await client.query(
      `UPDATE inventory_sync_jobs
          SET state = 'applied', applied_at = now(), last_error = NULL
        WHERE id = $1`,
      [job.id],
    );
  });
}

async function markDrift(job: JobRow, live: number, note: string): Promise<void> {
  await query(`UPDATE inventory_sync_jobs SET state = 'drift', last_error = $2 WHERE id = $1`, [
    job.id,
    note,
  ]);

  // Surfaced on the same admin banner as duplicate SKUs, so there is one place
  // to look rather than a log nobody reads.
  await query(
    `INSERT INTO catalogue_alerts (kind, subject, detail)
     VALUES ('inventory_drift', $1, $2::jsonb)
     ON CONFLICT (kind, subject) DO UPDATE
       SET detail = EXCLUDED.detail, last_seen_at = now(), resolved_at = NULL`,
    [
      job.variant_id,
      JSON.stringify({
        variantId: job.variant_id,
        productId: job.hostinger_product_id,
        orderId: job.order_id,
        units: job.units,
        expectedBefore: job.expected_before,
        expectedAfter: job.expected_after,
        liveQuantity: live,
        note,
      }),
    ],
  );
}

async function markRetryable(job: JobRow, message: string): Promise<'failed' | 'pending'> {
  const attempts = job.attempts + 1;
  const exhausted = attempts >= MAX_ATTEMPTS;

  await query(
    `UPDATE inventory_sync_jobs
        SET state = $2, attempts = $3, last_error = $4
      WHERE id = $1`,
    [job.id, exhausted ? 'failed' : 'pending', attempts, message.slice(0, 500)],
  );

  return exhausted ? 'failed' : 'pending';
}

/**
 * Process one claimed job.
 *
 * Split out so each branch of the protocol is readable on its own, and so the
 * tests can drive a single job without going through the queue.
 */
async function pushOne(job: JobRow, outcome: PushOutcome): Promise<void> {
  let live: number;
  let managed: boolean;

  try {
    const variants = await readVariantInventory(job.hostinger_product_id);
    const match = variants.find((variant) => variant.variantId === job.variant_id);

    if (!match) {
      // The variant is gone upstream — the product was deleted or recreated.
      // There is nothing to deduct from, and retrying forever would be noise.
      await query(
        `UPDATE inventory_sync_jobs
            SET state = 'skipped', last_error = 'variant no longer exists upstream'
          WHERE id = $1`,
        [job.id],
      );
      outcome.skipped += 1;
      return;
    }

    live = match.quantity;
    managed = match.managed;
  } catch (error) {
    // A read failure is always safe to retry: nothing was written.
    const status = await markRetryable(job, (error as Error).message);
    if (status === 'failed') outcome.failed += 1;
    return;
  }

  if (!managed) {
    await query(
      `UPDATE inventory_sync_jobs
          SET state = 'skipped', last_error = 'variant does not track inventory upstream'
        WHERE id = $1`,
      [job.id],
    );
    outcome.skipped += 1;
    return;
  }

  /* ------------------------------------------- the idempotency decision */

  if (job.expected_after !== null) {
    // A previous attempt already sent a write and did not get to confirm it.
    if (live === job.expected_after) {
      // It landed. Stamping without re-sending is the whole point.
      await settle(job, live);
      outcome.alreadyApplied += 1;
      return;
    }

    if (live !== job.expected_before) {
      // Neither the before nor the after value: somebody changed the stock in
      // hPanel while this job was in flight. Guessing here would either
      // double-decrement or clobber a restock, so it stops.
      await markDrift(
        job,
        live,
        `live quantity ${live} matches neither expected_before ` +
          `(${job.expected_before}) nor expected_after (${job.expected_after})`,
      );
      outcome.drift += 1;
      return;
    }
    // live === expected_before: the write never landed. Fall through and send.
  }

  const target = Math.max(0, live - job.units);

  // Persisted BEFORE the request. If the process dies mid-flight, the next
  // attempt can still tell what was attempted.
  await query(
    `UPDATE inventory_sync_jobs
        SET state = 'in_flight', expected_before = $2, expected_after = $3
      WHERE id = $1`,
    [job.id, live, target],
  );

  const refreshed: JobRow = { ...job, expected_before: live, expected_after: target };

  try {
    const confirmed = await setVariantInventory(
      job.hostinger_product_id,
      job.variant_id,
      target,
    );

    if (confirmed !== null && confirmed !== target) {
      // A 200 that did not produce the number we asked for. Trusting the status
      // code over the body would leave our baseline describing a stock level
      // Hostinger does not have.
      await markDrift(
        refreshed,
        confirmed,
        `Hostinger accepted the write but reported ${confirmed}, expected ${target}`,
      );
      outcome.drift += 1;
      return;
    }

    await settle(refreshed, target);
    outcome.applied += 1;
  } catch (error) {
    const failure = error as HostingerAdminError;

    // `indeterminate` means a timeout or socket error on the PATCH: the write
    // may have landed. The job goes back to pending with expected_after
    // recorded, and the next attempt resolves it by reading rather than by
    // assuming. This is the case that would otherwise double-decrement.
    const status = await markRetryable(
      refreshed,
      failure.indeterminate
        ? `indeterminate: ${failure.message}`
        : failure.message ?? 'unknown error',
    );
    if (status === 'failed') outcome.failed += 1;
  }
}

/**
 * Drain the queue.
 *
 * Claims are serialised per variant by an advisory lock, so two concurrent
 * drains — a webhook and an admin button, say — can never both be doing a
 * read-modify-write on the same variant. `FOR UPDATE SKIP LOCKED` lets them
 * work on *different* variants in parallel without blocking each other.
 */
export async function drainInventoryQueue(limit = 25): Promise<PushOutcome> {
  const outcome: PushOutcome = {
    claimed: 0,
    applied: 0,
    alreadyApplied: 0,
    drift: 0,
    failed: 0,
    skipped: 0,
  };

  if (!inventoryPushEnabled()) return outcome;

  const capped = Math.min(Math.max(1, Math.floor(limit)), 100);

  const jobs = await query<JobRow>(
    `SELECT id, order_id, variant_id, hostinger_product_id, units,
            reservation_ids, expected_before, expected_after, attempts
       FROM inventory_sync_jobs
      WHERE state IN ('pending', 'in_flight')
        AND attempts < $1
      ORDER BY created_at
      LIMIT $2
      FOR UPDATE SKIP LOCKED`,
    [MAX_ATTEMPTS, capped],
  );

  for (const job of jobs) {
    // One in-flight read-modify-write per variant across the whole application.
    // Without this, two drains could both read 5, both write 4, and lose a unit.
    const [lock] = await query<{ locked: boolean }>(
      `SELECT pg_try_advisory_lock(hashtext($1)) AS locked`,
      [`inventory:${job.variant_id}`],
    );
    if (!lock?.locked) continue;

    outcome.claimed += 1;
    try {
      await pushOne(job, outcome);
    } catch (error) {
      // Nothing above should throw, but a job must never take the drain down.
      await markRetryable(job, `unhandled: ${(error as Error).message}`).catch(() => {});
      console.error(`[inventory] job ${job.id} failed: ${(error as Error).message}`);
    } finally {
      await query(`SELECT pg_advisory_unlock(hashtext($1))`, [`inventory:${job.variant_id}`]);
    }
  }

  // Let the storefront see the number we just changed.
  //
  // Without this the catalogue snapshot keeps serving the pre-sale figure for
  // up to `HOSTINGER_CATALOG_REVALIDATE` seconds (300 by default), so a shopper
  // could be shown 5 units of something that now has 4. Overselling is still
  // impossible — order creation locks `inventory_baseline` and takes
  // `min(stored, live)`, and the baseline was just updated — but showing stale
  // availability is its own defect, and this is the moment we know it is wrong.
  //
  // Guarded: `revalidateTag` is only callable from a Server Action or Route
  // Handler, and the queue can also be drained from a script. Failing to
  // invalidate must never fail a push that has already succeeded upstream.
  if (outcome.applied > 0 || outcome.alreadyApplied > 0) {
    try {
      revalidateTag('catalog');
      invalidateCatalogueSnapshot();
    } catch (error) {
      console.warn(`[inventory] could not refresh the catalogue: ${(error as Error).message}`);
    }
  }

  return outcome;
}

export interface AttentionRow {
  id: number;
  orderId: number;
  variantId: string;
  units: number;
  state: string;
  attempts: number;
  lastError: string | null;
  updatedAt: string;
}

/** Jobs a human needs to look at, for the admin panel. */
export async function inventoryPushAttention(): Promise<AttentionRow[]> {
  const rows = await query<{
    id: number;
    order_id: number;
    variant_id: string;
    units: number;
    state: string;
    attempts: number;
    last_error: string | null;
    updated_at: Date;
  }>(
    `SELECT id, order_id, variant_id, units, state, attempts, last_error, updated_at
       FROM inventory_sync_jobs
      WHERE state IN ('drift', 'failed')
      ORDER BY updated_at DESC
      LIMIT 50`,
  );

  return rows.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    variantId: row.variant_id,
    units: row.units,
    state: row.state,
    attempts: row.attempts,
    lastError: row.last_error,
    updatedAt: row.updated_at.toISOString(),
  }));
}

/** Queue depth, for the admin panel. */
export async function inventoryPushPending(): Promise<number> {
  const rows = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM inventory_sync_jobs WHERE state IN ('pending', 'in_flight')`,
  );
  return rows[0]?.n ?? 0;
}
