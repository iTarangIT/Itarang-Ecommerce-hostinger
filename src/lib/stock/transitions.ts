import type { PoolClient } from 'pg';
import { query, queryOne } from '@/lib/db/pool';

/**
 * Stock crossing zero, in both directions.
 *
 * **A row is written only where a variant actually crossed**, which is what
 * makes the "do not alert again while it stays out of stock" rule structural
 * rather than a de-duplication check with a cooldown window. Staying at zero
 * produces nothing, because nothing crossed.
 *
 * Recording happens inside the same transaction as the stock change, so a
 * transition cannot exist for a change that rolled back and a change cannot
 * commit without its transition. Sending happens strictly afterwards — see
 * `dispatchPendingStockAlerts` — because mail must never be inside a payment
 * transaction: a mail server timeout would roll back a captured payment.
 *
 * There are exactly two write paths, matching the two places
 * `product_variants.stock` changes:
 *
 *   `lib/orders/postgres-repository.ts` — a sale consumes the last unit.
 *   `lib/products/postgres-repository.ts` — an administrator edits the count.
 *
 * Nothing here stores a quantity. `product_variants.stock` remains the only
 * record of how many units exist; this table records that it crossed.
 */

export type TransitionDirection = 'out-of-stock' | 'back-in-stock';
export type TransitionSource = 'order' | 'admin';

export interface StockTransitionInput {
  productId: string;
  sku: string;
  direction: TransitionDirection;
  source: TransitionSource;
}

/**
 * Which way, if any, a stock change crossed zero.
 *
 * `null` for a change that did not cross — 5 to 3, or 0 to 0 — and for an
 * untracked variant, where `stock IS NULL` means "not counted" rather than
 * zero, a distinction `0012_product_catalogue.sql` is explicit about. Treating
 * untracked as zero here would alert the business that seven products had gone
 * out of stock the first time anybody edited one.
 */
export function transitionBetween(
  before: number | null,
  after: number | null,
): TransitionDirection | null {
  if (before === null || after === null) return null;
  if (before > 0 && after <= 0) return 'out-of-stock';
  if (before <= 0 && after > 0) return 'back-in-stock';
  return null;
}

/** Record transitions inside the caller's transaction. Returns the new ids. */
export async function recordStockTransitions(
  client: PoolClient,
  transitions: readonly StockTransitionInput[],
): Promise<number[]> {
  const ids: number[] = [];
  for (const transition of transitions) {
    const result = await client.query<{ id: number }>(
      `INSERT INTO stock_transitions (product_id, sku, direction, source)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [transition.productId, transition.sku, transition.direction, transition.source],
    );
    const id = result.rows[0]?.id;
    if (id !== undefined) ids.push(id);
  }
  return ids;
}

export interface PendingAlert {
  id: number;
  productId: string;
  sku: string;
  source: TransitionSource;
}

/**
 * Out-of-stock transitions whose internal alert has not been sent.
 *
 * Only `out-of-stock`: the business asked to be told when something sells out,
 * and a restock is something they did themselves.
 */
export async function pendingStockAlerts(limit = 50): Promise<PendingAlert[]> {
  const rows = await query<{
    id: number;
    product_id: string;
    sku: string;
    source: TransitionSource;
  }>(
    `SELECT id, product_id, sku, source
       FROM stock_transitions
      WHERE direction = 'out-of-stock' AND alert_sent_at IS NULL
      ORDER BY occurred_at
      LIMIT $1`,
    [limit],
  );

  return rows.map((row) => ({
    id: row.id,
    productId: row.product_id,
    sku: row.sku,
    source: row.source,
  }));
}

/**
 * Claim an alert before sending it.
 *
 * The `AND alert_sent_at IS NULL` in the UPDATE is the concurrency guard: two
 * processes reaching the same pending row both run the statement, and exactly
 * one of them updates a row. Only that one sends. Claiming before sending means
 * a crash mid-send loses an alert rather than repeating it — the same trade
 * `claimNotificationSends` makes, for the same reason.
 */
export async function claimStockAlert(transitionId: number): Promise<boolean> {
  const row = await queryOne<{ id: number }>(
    `UPDATE stock_transitions
        SET alert_sent_at = now()
      WHERE id = $1 AND alert_sent_at IS NULL
      RETURNING id`,
    [transitionId],
  );
  return row !== null;
}

/** Hand an alert back after a failed send, so the next pass retries it. */
export async function releaseStockAlert(transitionId: number): Promise<void> {
  await query('UPDATE stock_transitions SET alert_sent_at = NULL WHERE id = $1', [transitionId]);
}

/**
 * The most recent restock of a product, which is the event customers are
 * notified about. `null` when it has never come back.
 */
export async function latestRestock(
  productId: string,
): Promise<{ id: number; occurredAt: string } | null> {
  const row = await queryOne<{ id: number; occurred_at: Date }>(
    `SELECT id, occurred_at
       FROM stock_transitions
      WHERE product_id = $1 AND direction = 'back-in-stock'
      ORDER BY occurred_at DESC
      LIMIT 1`,
    [productId],
  );
  return row ? { id: row.id, occurredAt: row.occurred_at.toISOString() } : null;
}

export interface TransitionRow {
  id: number;
  productId: string;
  sku: string;
  direction: TransitionDirection;
  source: TransitionSource;
  occurredAt: string;
  alertSentAt: string | null;
}

/** Recent history for one product, shown on the admin panel. */
export async function transitionsFor(productId: string, limit = 20): Promise<TransitionRow[]> {
  const rows = await query<{
    id: number;
    product_id: string;
    sku: string;
    direction: TransitionDirection;
    source: TransitionSource;
    occurred_at: Date;
    alert_sent_at: Date | null;
  }>(
    `SELECT id, product_id, sku, direction, source, occurred_at, alert_sent_at
       FROM stock_transitions
      WHERE product_id = $1
      ORDER BY occurred_at DESC
      LIMIT $2`,
    [productId, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    productId: row.product_id,
    sku: row.sku,
    direction: row.direction,
    source: row.source,
    occurredAt: row.occurred_at.toISOString(),
    alertSentAt: row.alert_sent_at ? row.alert_sent_at.toISOString() : null,
  }));
}
