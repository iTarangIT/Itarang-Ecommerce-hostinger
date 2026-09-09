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
 *
 * **The list is who is still waiting.** Somebody who has been mailed about this
 * product leaves it, and that is enforced twice over rather than shown as a
 * flag beside their name:
 *
 *   A **notify-me request** is spent when it is fulfilled — `notified_at` is
 *   stamped and the request stops being live, exactly as a cancellation does.
 *   Asking again re-opens it.
 *
 *   A **wishlist or cart** entry has no request row to spend, so those are
 *   excluded by their `stock_notification_sends` row for the current restock.
 *
 * The point of both is the same: an administrator working down a list must not
 * be able to mail the same person about the same restock twice, and must not be
 * shown a list that grows a permanent tail of people already dealt with.
 */

export type InterestSource = 'notify-me' | 'wishlist' | 'cart';

export interface InterestedCustomer {
  email: string;
  source: InterestSource;
  /** When the interest was recorded. ISO. */
  since: string;
  /** Null for a guest who left only an address. */
  userId: number | null;
}

export interface InterestedCustomers {
  /** Everybody who may still be told. Nobody here has been mailed. */
  waiting: InterestedCustomer[];
  /**
   * How many were left out because they have already been told about this
   * restock.
   *
   * A count rather than a list: the addresses are of no use to an administrator
   * who cannot mail them again, but "and eleven others were already told" is
   * the difference between an empty list that looks broken and one that is
   * simply finished.
   */
  alreadyNotified: number;
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

  /**
   * The prior state is read in its own CTE, not from `RETURNING`.
   *
   * `RETURNING` on an upsert reports the row *after* the SET clause has run, so
   * asking it whether `notified_at` was null would always answer yes — the SET
   * has just made it so. Both branches of this statement see the same snapshot,
   * so `prior` is the state before the write, which is the question being
   * asked: was this person already waiting?
   */
  const row = await queryOne<{ was_live: boolean }>(
    `WITH prior AS (
       SELECT 1
         FROM stock_notification_requests
        WHERE product_id = $1 AND sku = $2 AND lower(email) = $4
          AND cancelled_at IS NULL
          AND notified_at IS NULL
     ),
     upsert AS (
       INSERT INTO stock_notification_requests (product_id, sku, user_id, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (product_id, sku, lower(email)) DO UPDATE
          -- Both timestamps cleared: pressing the button is a statement that
          -- this person wants the next message, whether they last cancelled or
          -- were last told. A spent request that stayed spent would silently
          -- drop somebody who explicitly asked again.
          SET cancelled_at = NULL,
              notified_at = NULL,
              user_id = COALESCE(EXCLUDED.user_id, stock_notification_requests.user_id)
       RETURNING id
     )
     SELECT EXISTS (SELECT 1 FROM prior) AS was_live FROM upsert`,
    [input.productId, input.sku, input.userId, email],
  );

  // "Already on the list" means a live request existed. A row that had been
  // cancelled, or already fulfilled and closed, is a fresh sign-up as far as
  // the person pressing the button is concerned.
  return { alreadyRequested: row?.was_live === true };
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

/**
 * Is this address already on the list for this variant?
 *
 * A fulfilled request answers **no**. The customer asked for one message, we
 * sent it, and they are no longer waiting for anything — telling them they are
 * still on a list would be wrong, and would hide the control they need to press
 * to be told about the next restock.
 */
export async function hasStockNotification(
  productId: string,
  sku: string,
  email: string,
): Promise<boolean> {
  const row = await queryOne<{ id: number }>(
    `SELECT id FROM stock_notification_requests
      WHERE product_id = $1 AND sku = $2 AND lower(email) = $3
        AND cancelled_at IS NULL
        AND notified_at IS NULL`,
    [productId, sku, normaliseEmail(email)],
  );
  return row !== null;
}

/**
 * Everyone still waiting for a product, by source, plus a count of those who
 * are not waiting any more because they have been told.
 *
 * De-duplicated by address with the strongest signal winning, so somebody who
 * both saved a product and asked to be notified appears once, as an opt-in.
 *
 * `latestTransitionId` is what "already told" is measured against. It is
 * nullable because a product that has never come back has no restock to have
 * been told about, and in that case nobody is excluded.
 *
 * The exclusion is deliberately done in SQL rather than by filtering the
 * result in TypeScript: `alreadyNotified` has to be the number of people the
 * query left out, and computing it from a list that has already had them
 * removed is not possible.
 */
export async function interestedCustomers(
  productId: string,
  latestTransitionId: number | null,
): Promise<InterestedCustomers> {
  const rows = await query<{
    email: string;
    source: InterestSource;
    since: Date;
    user_id: number | null;
    notified: boolean;
  }>(
    `WITH requests AS (
       -- A null notified_at is the request-side half of "still waiting". A
       -- fulfilled opt-in is spent, exactly as a cancelled one is.
       SELECT lower(r.email) AS email,
              'notify-me'::text AS source,
              r.created_at AS since,
              r.user_id
         FROM stock_notification_requests r
        WHERE r.product_id = $1
          AND r.cancelled_at IS NULL
          AND r.notified_at IS NULL
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
     -- Everyone is returned with a flag rather than filtered here, so the
     -- caller can both list the waiting and count the told from one pass. The
     -- wishlist and cart sources have no request row to spend, so this join is
     -- the only thing that takes them off the list once they have been mailed.
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

  return {
    waiting: rows
      .filter((row) => !row.notified)
      .map((row) => ({
        email: row.email,
        source: row.source,
        since: row.since.toISOString(),
        userId: row.user_id,
      })),
    alreadyNotified: rows.filter((row) => row.notified).length,
  };
}

/**
 * How many people are waiting, for the admin list and the internal alert.
 *
 * "Waiting" excludes fulfilled requests as well as cancelled ones, so the badge
 * beside an out-of-stock product counts people an administrator can still act
 * on rather than everybody who ever asked.
 */
export async function interestedCountsBySku(): Promise<Map<string, number>> {
  const rows = await query<{ product_id: string; count: number }>(
    `SELECT product_id, count(*)::int AS count
       FROM stock_notification_requests
      WHERE cancelled_at IS NULL AND notified_at IS NULL
      GROUP BY product_id`,
  );
  return new Map(rows.map((row) => [row.product_id, row.count]));
}

export async function notifyMeCountFor(productId: string): Promise<number> {
  const row = await queryOne<{ count: number }>(
    `SELECT count(*)::int AS count
       FROM stock_notification_requests
      WHERE product_id = $1 AND cancelled_at IS NULL AND notified_at IS NULL`,
    [productId],
  );
  return row?.count ?? 0;
}

/**
 * Spend the notify-me requests that were just mailed.
 *
 * Called **after** the mail is away, not before, and that is the opposite
 * ordering to `claimNotificationSends` on purpose. The claim is the
 * duplicate-send guard and has to be pessimistic — better a lost notification
 * than two. This is bookkeeping on a message that has already been delivered,
 * and stamping it before the send would remove somebody from the list on the
 * strength of an SMTP call that had not happened yet.
 *
 * Only rows that are still live are touched, so a request the customer
 * re-opened between the send and this call is not silently spent by it.
 *
 * Returns how many requests were closed. Addresses with no request row — a
 * wishlist or cart entry the administrator chose to include — close nothing
 * here; those leave the list by way of `stock_notification_sends`.
 */
export async function markRequestsNotified(
  productId: string,
  emails: readonly string[],
): Promise<number> {
  if (emails.length === 0) return 0;

  const rows = await query<{ id: number }>(
    `UPDATE stock_notification_requests
        SET notified_at = now()
      WHERE product_id = $1
        AND lower(email) = ANY($2::text[])
        AND cancelled_at IS NULL
        AND notified_at IS NULL
      RETURNING id`,
    [productId, emails.map(normaliseEmail)],
  );

  return rows.length;
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
