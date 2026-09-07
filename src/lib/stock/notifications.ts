import type { PoolClient } from 'pg';
import { query, queryOne } from '@/lib/db/pool';

/**
 * Who is waiting for a product to come back, and what has been sent to them.
 *
 * Three sources of "interested", and they are not equivalent:
 *
 *   **A Notify Me request** is an opt-in. The customer typed their address into
 *   a form headed "tell me when this is back". Mailing them is what they asked
 *   for.
 *
 *   **A wishlist entry** is a saved product. The customer told us they want it;
 *   they did not tell us they want mail about it.
 *
 *   **An add-to-cart** is stronger intent still, and is read from
 *   `funnel_events` — an analytics table — because there is no cart table: the
 *   cart lives in the browser's `localStorage`.
 *
 * All three are shown to the administrator, labelled, because knowing that
 * eleven people put a sold-out battery in their cart is exactly the operational
 * fact the business asked for. Only the first is an opt-in, and **whether the
 * other two may be emailed is a business decision, not a technical one** — it
 * is flagged in the console beside them and nothing here decides it. Neither is
 * ever subscribed automatically, and a search or a page view creates no
 * interest of any kind.
 */

export type InterestSource = 'notify-me' | 'wishlist' | 'cart';

export interface InterestedCustomer {
  email: string;
  source: InterestSource;
  /** When the interest was recorded. ISO. */
  since: string;
  /** Null for a guest who left only an address. */
  userId: number | null;
  /** Whether this address has already been told about the latest restock. */
  notified: boolean;
}

export interface NotifyRequestInput {
  productId: string;
  sku: string;
  email: string;
  userId: number | null;
}

/** Addresses are stored and compared lower-cased; the unique index agrees. */
function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Record a Notify Me request.
 *
 * Idempotent by the unique index: asking twice updates the existing row rather
 * than creating a second, and re-asking after cancelling clears the
 * cancellation — which is what a person pressing the button again means.
 *
 * Returns whether this was a new request, so the UI can say "you are on the
 * list" rather than "added" the second time.
 */
export async function requestStockNotification(
  input: NotifyRequestInput,
): Promise<{ alreadyRequested: boolean }> {
  const email = normaliseEmail(input.email);

  const row = await queryOne<{ inserted: boolean }>(
    `INSERT INTO stock_notification_requests (product_id, sku, user_id, email)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (product_id, sku, lower(email)) DO UPDATE
        SET cancelled_at = NULL,
            user_id = COALESCE(EXCLUDED.user_id, stock_notification_requests.user_id)
     RETURNING (xmax = 0) AS inserted`,
    [input.productId, input.sku, input.userId, email],
  );

  return { alreadyRequested: row?.inserted === false };
}

export async function cancelStockNotification(
  productId: string,
  sku: string,
  email: string,
): Promise<void> {
  await query(
    `UPDATE stock_notification_requests
        SET cancelled_at = now()
      WHERE product_id = $1 AND sku = $2 AND lower(email) = $3 AND cancelled_at IS NULL`,
    [productId, sku, normaliseEmail(email)],
  );
}

/** Is this address already on the list for this variant? */
export async function hasStockNotification(
  productId: string,
  sku: string,
  email: string,
): Promise<boolean> {
  const row = await queryOne<{ id: number }>(
    `SELECT id FROM stock_notification_requests
      WHERE product_id = $1 AND sku = $2 AND lower(email) = $3 AND cancelled_at IS NULL`,
    [productId, sku, normaliseEmail(email)],
  );
  return row !== null;
}

/**
 * Everyone with a recorded interest in a product, by source.
 *
 * De-duplicated by address with the strongest signal winning, so somebody who
 * both saved a product and asked to be notified appears once, as an opt-in.
 * `latestTransitionId` marks who has already been told about that restock.
 */
export async function interestedCustomers(
  productId: string,
  latestTransitionId: number | null,
): Promise<InterestedCustomer[]> {
  const rows = await query<{
    email: string;
    source: InterestSource;
    since: Date;
    user_id: number | null;
    notified: boolean;
  }>(
    `WITH requests AS (
       SELECT lower(r.email) AS email,
              'notify-me'::text AS source,
              r.created_at AS since,
              r.user_id
         FROM stock_notification_requests r
        WHERE r.product_id = $1 AND r.cancelled_at IS NULL
     ),
     saved AS (
       SELECT lower(u.email) AS email,
              'wishlist'::text AS source,
              w.created_at AS since,
              u.id AS user_id
         FROM wishlist_items w
         JOIN users u ON u.id = w.user_id
        WHERE w.product_id = $1
     ),
     carted AS (
       -- The nearest thing to "it is in their cart": the cart itself is
       -- browser-local, so this is the server-side record that they added it.
       -- DISTINCT ON because the same person adding twice is one interested
       -- customer, not two.
       SELECT DISTINCT ON (u.id)
              lower(u.email) AS email,
              'cart'::text AS source,
              f.occurred_at AS since,
              u.id AS user_id
         FROM funnel_events f
         JOIN users u ON u.id = f.user_id
        WHERE f.product_id = $1 AND f.event = 'add_to_cart' AND f.user_id IS NOT NULL
        ORDER BY u.id, f.occurred_at DESC
     ),
     combined AS (
       SELECT * FROM requests
       UNION ALL SELECT * FROM saved
       UNION ALL SELECT * FROM carted
     ),
     ranked AS (
       -- One row per address, keeping the strongest signal. An explicit request
       -- outranks a wishlist entry, which outranks an add-to-cart.
       SELECT DISTINCT ON (email) email, source, since, user_id
         FROM combined
        ORDER BY email,
                 CASE source WHEN 'notify-me' THEN 0 WHEN 'wishlist' THEN 1 ELSE 2 END,
                 since DESC
     )
     SELECT ranked.email,
            ranked.source,
            ranked.since,
            ranked.user_id,
            ($2::bigint IS NOT NULL AND s.email IS NOT NULL) AS notified
       FROM ranked
       LEFT JOIN stock_notification_sends s
              ON s.transition_id = $2::bigint AND lower(s.email) = ranked.email
      ORDER BY CASE ranked.source WHEN 'notify-me' THEN 0 WHEN 'wishlist' THEN 1 ELSE 2 END,
               ranked.since DESC`,
    [productId, latestTransitionId],
  );

  return rows.map((row) => ({
    email: row.email,
    source: row.source,
    since: row.since.toISOString(),
    userId: row.user_id,
    notified: row.notified,
  }));
}

/** How many people are waiting, for the admin list and the internal alert. */
export async function interestedCountsBySku(): Promise<Map<string, number>> {
  const rows = await query<{ product_id: string; count: number }>(
    `SELECT product_id, count(*)::int AS count
       FROM stock_notification_requests
      WHERE cancelled_at IS NULL
      GROUP BY product_id`,
  );
  return new Map(rows.map((row) => [row.product_id, row.count]));
}

export async function notifyMeCountFor(productId: string): Promise<number> {
  const row = await queryOne<{ count: number }>(
    `SELECT count(*)::int AS count
       FROM stock_notification_requests
      WHERE product_id = $1 AND cancelled_at IS NULL`,
    [productId],
  );
  return row?.count ?? 0;
}

/**
 * Claim the right to email an address about one restock.
 *
 * **This is the duplicate-send guard, and it is a write rather than a check.**
 * The primary key on `(transition_id, email)` makes a second row impossible, so
 * `ON CONFLICT DO NOTHING` returning nothing means somebody else already has
 * the claim — a double-clicked button, a retried action, two administrators at
 * once. The caller mails only the addresses whose insert took.
 *
 * Claiming *before* sending means a crash mid-send loses a notification rather
 * than sending it twice. That is the right way round: a customer who misses one
 * mail is inconvenienced, and one who gets four is being spammed by us.
 */
export async function claimNotificationSends(
  transitionId: number,
  emails: readonly string[],
  actor: string,
  client?: PoolClient,
): Promise<string[]> {
  if (emails.length === 0) return [];

  const sql = `INSERT INTO stock_notification_sends (transition_id, email, sent_by)
               SELECT $1, lower(candidate), $3
                 FROM unnest($2::text[]) AS candidate
               ON CONFLICT (transition_id, email) DO NOTHING
               RETURNING email`;
  const params = [transitionId, emails.map(normaliseEmail), actor];

  if (client) {
    const result = await client.query<{ email: string }>(sql, params);
    return result.rows.map((row) => row.email);
  }
  return (await query<{ email: string }>(sql, params)).map((row) => row.email);
}

/** Undo a claim whose email did not go out, so it can be retried. */
export async function releaseNotificationSend(
  transitionId: number,
  email: string,
): Promise<void> {
  await query(
    `DELETE FROM stock_notification_sends WHERE transition_id = $1 AND email = $2`,
    [transitionId, normaliseEmail(email)],
  );
}
