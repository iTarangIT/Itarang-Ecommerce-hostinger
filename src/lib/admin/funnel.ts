import { query } from '@/lib/db/pool';

/**
 * Customer funnel reporting.
 *
 * Three decisions shape every query here, and the first two are inherited from
 * `admin/analytics.ts` on purpose so the two screens can never disagree.
 *
 * **Boundaries are computed in PostgreSQL.** `resolveRange` is imported rather
 * than reimplemented — India is UTC+5:30, and a JavaScript boundary would put
 * everything between 00:00 and 05:30 IST in the wrong day.
 *
 * **Cash on delivery is excluded**, exactly as it is from revenue and
 * fulfilment. COD is out of scope for this phase, and letting one screen count
 * it while another does not would make the two impossible to reconcile.
 *
 * **Sessions are the unit, not events.** A shopper who views five products has
 * viewed products once for funnel purposes; counting raw events would inflate
 * every stage in proportion to how engaged the visitor was, which is precisely
 * backwards. Every stage below counts `DISTINCT session_id`.
 *
 * The funnel has two halves and they are sourced differently, deliberately:
 *
 *   - the first five stages come from `funnel_events`, which is the only record
 *     of them;
 *   - the last three are **derived** from `payment_attempts`, `payments` and
 *     `order_events` — the authoritative record of money and state. A browser
 *     can never write those, so no beacon can invent a sale.
 *
 * The two halves are joined by `order_attribution`, which maps an order back to
 * the anonymous session that produced it. Orders placed before tracking existed
 * have no attribution row and are invisible to the session funnel — so
 * `attributionCoverage()` reports exactly how many, rather than letting the
 * funnel quietly under-report.
 */

/** COD is out of scope for this phase — see the note above. */
const EXCLUDE_COD = `o.payment_method <> 'cod'`;

/**
 * A captured payment. `signature_verified` is part of the predicate for the
 * same reason it is in `analytics.ts`: an unverified row is not evidence that
 * money moved.
 */
const CAPTURED = `p.status = 'paid' AND p.signature_verified`;

export const FUNNEL_STAGES = [
  'visit',
  'product_view',
  'buy_now',
  'add_to_cart',
  'checkout_intent',
  'signed_in',
  'begin_checkout',
  'payment_initiated',
  'payment_completed',
  'order_placed',
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export const STAGE_LABELS: Record<FunnelStage, string> = {
  visit: 'Visitors',
  product_view: 'Product views',
  buy_now: 'Buy Now',
  add_to_cart: 'Cart',
  checkout_intent: 'Login wall',
  signed_in: 'Signed in',
  begin_checkout: 'Checkout',
  payment_initiated: 'Payment initiated',
  payment_completed: 'Payment completed',
  order_placed: 'Orders',
};

/** Where each stage's number actually comes from, shown on screen. */
export const STAGE_SOURCES: Record<FunnelStage, string> = {
  visit: 'funnel_events',
  product_view: 'funnel_events',
  buy_now: 'funnel_events',
  add_to_cart: 'funnel_events',
  checkout_intent: 'funnel_events (server-written)',
  signed_in: 'funnel_events + visitor_identities',
  begin_checkout: 'funnel_events (server-written)',
  payment_initiated: 'payment_attempts',
  payment_completed: 'payments (captured, verified)',
  order_placed: 'order_events',
};

export type FunnelCounts = Record<FunnelStage, number>;

/**
 * Which population a funnel is being asked about.
 *
 * Segmentation is *state at the time*, not state now: `anonymous` means the
 * event was written while nobody was signed in, which is the only thing that
 * was actually true when it happened. "Did this visitor ever become a customer"
 * is a different question, asked by `anonymousConversion()` — conflating the two
 * would let a purchase retroactively rewrite the browsing that preceded it.
 *
 * The two segments do not partition sessions, and are not meant to: a session
 * that begins signed-out and ends signed-in appears in both, because it genuinely
 * was both.
 */
export type FunnelSegment = 'all' | 'anonymous' | 'registered';

export const FUNNEL_SEGMENTS = ['all', 'anonymous', 'registered'] as const;

export function isFunnelSegment(value: unknown): value is FunnelSegment {
  return typeof value === 'string' && (FUNNEL_SEGMENTS as readonly string[]).includes(value);
}

export const SEGMENT_LABELS: Record<FunnelSegment, string> = {
  all: 'Everyone',
  anonymous: 'Anonymous',
  registered: 'Registered',
};

/**
 * Sessions reaching each stage inside the window.
 *
 * One pass over `funnel_events` for the browsing stages, then one pass per
 * derived stage. Each derived query buckets by `orders.created_at` rather than
 * by when the payment landed, because the session being counted happened when
 * the order was placed — this is a funnel, not a revenue report, and
 * `analytics.ts` deliberately answers the revenue question the other way.
 */
export async function funnelCounts(
  from: Date,
  to: Date,
  segment: FunnelSegment = 'all',
): Promise<FunnelCounts> {
  return stageCounts(from, to, segment, 'session_id');
}

/**
 * The same funnel, counting people instead of visits.
 *
 * A session funnel asks "how good is one visit"; this asks "how many people
 * eventually convert". The difference is not cosmetic: a shopper who browses on
 * Monday and buys on Friday spans two sessions, so the session funnel scores
 * that journey as two failures where it is really one success. Neither unit is
 * wrong — they answer different questions, which is why the screen shows both.
 *
 * Deliberately a second function rather than a second field on `FunnelCounts`:
 * `conversions()` and every existing caller take `Record<FunnelStage, number>`,
 * and widening that shape would have rippled through the registered funnel this
 * change is required to leave alone.
 */
export async function funnelVisitorCounts(
  from: Date,
  to: Date,
  segment: FunnelSegment = 'all',
): Promise<FunnelCounts> {
  return stageCounts(from, to, segment, 'visitor_id');
}

/**
 * One funnel, one counting unit, one segment.
 *
 * `unit` is interpolated rather than parameterised because it is a column name,
 * not a value — and it is a union of two literals, so nothing reaches the SQL
 * that did not come from this file.
 *
 * With `segment: 'all'` and `unit: 'session_id'` every statement below is
 * textually what shipped, which is what makes the existing funnel's numbers
 * provably unchanged. The one exception is `signed_in`, corrected below.
 */
async function stageCounts(
  from: Date,
  to: Date,
  segment: FunnelSegment,
  unit: 'session_id' | 'visitor_id',
): Promise<FunnelCounts> {
  const counts = Object.fromEntries(FUNNEL_STAGES.map((stage) => [stage, 0])) as FunnelCounts;

  // `all` runs the statement that shipped, character for character. The two
  // segmented forms are separate statements rather than a fragment spliced into
  // this one, so there is no way for a segment to perturb the default funnel.
  const browsing = await query<{ event: string; n: number }>(
    segment === 'all'
      ? `SELECT event::text AS event, count(DISTINCT ${unit})::int AS n
           FROM funnel_events
          WHERE occurred_at >= $1 AND occurred_at < $2
          GROUP BY event`
      : // Anonymous is state at the time — `user_id` is what was true when the
        // event was written, and no later sign-in may rewrite it. Registered is
        // resolved through `visitor_identities`, matching how every other query
        // in this file decides whose events these are.
        //
        // The two overlap on purpose. Someone who browsed signed-out and then
        // created an account appears in both, because that is precisely what
        // they are: an anonymous visitor who converted. A partition would have
        // to pick one truth and discard the other.
        `SELECT f.event::text AS event, count(DISTINCT f.${unit})::int AS n
           FROM funnel_events f
           LEFT JOIN visitor_identities vi ON vi.visitor_id = f.visitor_id
          WHERE f.occurred_at >= $1 AND f.occurred_at < $2
            AND ${
              segment === 'anonymous'
                ? 'f.user_id IS NULL'
                : 'COALESCE(f.user_id, vi.user_id) IS NOT NULL'
            }
          GROUP BY f.event`,
    [from, to],
  );

  for (const row of browsing) {
    if ((FUNNEL_STAGES as readonly string[]).includes(row.event)) {
      counts[row.event as FunnelStage] = row.n;
    }
  }

  // Nobody signed in is anonymous, and no order is placed without an account —
  // there is no guest checkout. So for the anonymous segment the four stages
  // below are zero by definition, not by absence of data, and asking the
  // database would be a round trip to learn what the schema already guarantees.
  //
  // This is the whole shape of the anonymous funnel: it ends at the login wall.
  if (segment === 'anonymous') return counts;

  const [signedIn, initiated, completed, placed] = await Promise.all([
    // Resolved through `visitor_identities`, like every other identity query in
    // this file. It previously asked only for `user_id IS NOT NULL`, which is
    // the id stamped at write time — so a session that browsed signed-out and
    // then signed in was never counted here, and the anonymous-to-registered
    // step read far lower than it was. That was the one stage measuring exactly
    // the population this screen exists to explain.
    query<{ n: number }>(
      `SELECT count(DISTINCT f.${unit})::int AS n
         FROM funnel_events f
         LEFT JOIN visitor_identities vi ON vi.visitor_id = f.visitor_id
        WHERE f.occurred_at >= $1 AND f.occurred_at < $2
          AND COALESCE(f.user_id, vi.user_id) IS NOT NULL`,
      [from, to],
    ),
    query<{ n: number }>(
      `SELECT count(DISTINCT a.${unit})::int AS n
         FROM order_attribution a
         JOIN orders o ON o.id = a.order_id
        WHERE o.created_at >= $1 AND o.created_at < $2
          AND ${EXCLUDE_COD}
          AND EXISTS (SELECT 1 FROM payment_attempts pa WHERE pa.order_id = o.id)`,
      [from, to],
    ),
    query<{ n: number }>(
      `SELECT count(DISTINCT a.${unit})::int AS n
         FROM order_attribution a
         JOIN orders o ON o.id = a.order_id
        WHERE o.created_at >= $1 AND o.created_at < $2
          AND ${EXCLUDE_COD}
          AND EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND ${CAPTURED})`,
      [from, to],
    ),
    query<{ n: number }>(
      `SELECT count(DISTINCT a.${unit})::int AS n
         FROM order_attribution a
         JOIN orders o ON o.id = a.order_id
        WHERE o.created_at >= $1 AND o.created_at < $2
          AND ${EXCLUDE_COD}
          AND EXISTS (
                SELECT 1 FROM order_events e
                 WHERE e.order_id = o.id AND e.to_status = 'confirmed'
              )`,
      [from, to],
    ),
  ]);

  counts.signed_in = signedIn[0]?.n ?? 0;
  counts.payment_initiated = initiated[0]?.n ?? 0;
  counts.payment_completed = completed[0]?.n ?? 0;
  counts.order_placed = placed[0]?.n ?? 0;

  return counts;
}

export interface Conversion {
  from: FunnelStage;
  to: FunnelStage;
  label: string;
  /** 0–1, or null when the denominator is zero. */
  rate: number | null;
}

/**
 * The four conversions an admin actually acts on.
 *
 * Deliberately not every adjacent pair: a wall of nine ratios hides the ones
 * that matter. Each of these has an obvious response if it drops.
 */
export function conversions(counts: FunnelCounts): Conversion[] {
  const ratio = (a: number, b: number) => (b === 0 ? null : a / b);

  return [
    {
      from: 'product_view',
      to: 'add_to_cart',
      label: 'Product view → Cart',
      rate: ratio(counts.add_to_cart, counts.product_view),
    },
    {
      from: 'add_to_cart',
      to: 'begin_checkout',
      label: 'Cart → Checkout',
      rate: ratio(counts.begin_checkout, counts.add_to_cart),
    },
    {
      from: 'begin_checkout',
      to: 'payment_initiated',
      label: 'Checkout → Payment',
      rate: ratio(counts.payment_initiated, counts.begin_checkout),
    },
    {
      from: 'payment_initiated',
      to: 'order_placed',
      label: 'Payment → Order',
      rate: ratio(counts.order_placed, counts.payment_initiated),
    },
  ];
}

export interface AttributionCoverage {
  /** Prepaid orders placed in the window. */
  orders: number;
  /** How many of those can be traced back to a browsing session. */
  attributed: number;
}

/**
 * How much of the order side the session funnel can actually see.
 *
 * Without this the last three stages would silently under-report every order
 * placed before tracking shipped, and the screen would look like a conversion
 * collapse rather than a gap in coverage.
 */
export async function attributionCoverage(from: Date, to: Date): Promise<AttributionCoverage> {
  const rows = await query<{ orders: number; attributed: number }>(
    `SELECT count(*)::int AS orders,
            count(a.order_id)::int AS attributed
       FROM orders o
       LEFT JOIN order_attribution a ON a.order_id = o.id
      WHERE o.created_at >= $1 AND o.created_at < $2
        AND ${EXCLUDE_COD}`,
    [from, to],
  );
  return { orders: rows[0]?.orders ?? 0, attributed: rows[0]?.attributed ?? 0 };
}

export interface BeaconCoverage {
  /** Prepaid orders in the window that carry an attribution row. */
  attributed: number;
  /** How many of those visitors ever produced a browsing event at all. */
  withBrowsing: number;
}

/**
 * How much of the *top* of the funnel is actually observable.
 *
 * `attributionCoverage` answers whether an order can be traced to a session.
 * This answers something harsher: whether that visitor was ever seen browsing.
 *
 * The visitor cookie is minted by `/api/events`, which only a beacon calls — so
 * a shopper whose ad blocker eats `sendBeacon`, who has JavaScript off, or who
 * left before the effect ran is invisible until they reach a server-written
 * stage. Their order appears at the bottom of the funnel with nothing above it,
 * which reads as a catastrophic conversion rate rather than as a blind spot.
 *
 * Reporting the size of the blind spot is the honest fix, and the same one
 * `attributionCoverage` already chose. Closing it would need request-level
 * logging in middleware, which cannot reach the database from the Edge runtime
 * — so it would seat a cookie without ever recording a visit, and buy nothing.
 */
export async function beaconCoverage(from: Date, to: Date): Promise<BeaconCoverage> {
  const rows = await query<{ attributed: number; with_browsing: number }>(
    `SELECT count(*)::int AS attributed,
            count(*) FILTER (
              WHERE EXISTS (
                SELECT 1 FROM funnel_events f WHERE f.visitor_id = a.visitor_id
              )
            )::int AS with_browsing
       FROM order_attribution a
       JOIN orders o ON o.id = a.order_id
      WHERE o.created_at >= $1 AND o.created_at < $2
        AND ${EXCLUDE_COD}
        AND a.visitor_id IS NOT NULL`,
    [from, to],
  );
  return {
    attributed: rows[0]?.attributed ?? 0,
    withBrowsing: rows[0]?.with_browsing ?? 0,
  };
}

export interface AnonymousConversion {
  /** Distinct visitors who browsed signed-out inside the window. */
  visitors: number;
  /** …who reached the login wall. */
  reachedWall: number;
  /** …who now belong to an account. */
  registered: number;
  /** …whose visitor id is attached to a captured order. */
  purchased: number;
}

/**
 * What became of the people who arrived without an account.
 *
 * This is the question the stage table cannot answer. The anonymous funnel ends
 * at the login wall by construction — there is no guest checkout — so every
 * anonymous journey either stops there or continues under a different identity.
 * Following it across that boundary means counting *visitors*, not sessions:
 * registering is precisely the act of starting a new session.
 *
 * The denominator is deliberately "browsed signed-out in this window", not
 * "never had an account". Somebody who signs out, browses, and signs back in is
 * an anonymous visitor for as long as that is what the events say they were.
 */
export async function anonymousConversion(from: Date, to: Date): Promise<AnonymousConversion> {
  const rows = await query<{
    visitors: number;
    reached_wall: number;
    registered: number;
    purchased: number;
  }>(
    `WITH anon AS (
       -- One row per visitor who wrote at least one signed-out event here.
       SELECT DISTINCT f.visitor_id
         FROM funnel_events f
        WHERE f.occurred_at >= $1 AND f.occurred_at < $2
          AND f.user_id IS NULL
     )
     SELECT count(*)::int AS visitors,
            count(*) FILTER (
              WHERE EXISTS (
                SELECT 1 FROM funnel_events w
                 WHERE w.visitor_id = anon.visitor_id
                   AND w.event = 'checkout_intent'
                   AND w.occurred_at >= $1 AND w.occurred_at < $2
              )
            )::int AS reached_wall,
            count(*) FILTER (
              WHERE EXISTS (
                SELECT 1 FROM visitor_identities vi WHERE vi.visitor_id = anon.visitor_id
              )
            )::int AS registered,
            count(*) FILTER (
              WHERE EXISTS (
                SELECT 1
                  FROM order_attribution a
                  JOIN orders o ON o.id = a.order_id
                 WHERE a.visitor_id = anon.visitor_id
                   AND ${EXCLUDE_COD}
                   AND EXISTS (
                         SELECT 1 FROM payments p
                          WHERE p.order_id = o.id AND ${CAPTURED}
                       )
              )
            )::int AS purchased
       FROM anon`,
    [from, to],
  );

  const row = rows[0];
  return {
    visitors: row?.visitors ?? 0,
    reachedWall: row?.reached_wall ?? 0,
    registered: row?.registered ?? 0,
    purchased: row?.purchased ?? 0,
  };
}

export interface AnonymousVisitorRow {
  /** The full uuid. Never render it whole — see `shortVisitor`. */
  visitorId: string;
  sessions: number;
  views: number;
  cartAdds: number;
  reachedWall: boolean;
  /** True once this visitor belongs to an account. */
  converted: boolean;
  lastSeen: string;
}

/**
 * A short, non-reversible-looking handle for one anonymous visitor.
 *
 * Four hex characters is enough to tell two rows apart on a screen and far too
 * little to correlate back to a live cookie, so a screenshot or an exported
 * table cannot be turned into a way of following a specific person around.
 */
export function shortVisitor(visitorId: string): string {
  return visitorId.slice(0, 4);
}

/**
 * Anonymous visitors active in the window, busiest first.
 *
 * The point of listing them individually is to be able to read a single odd
 * journey — a visitor who viewed eleven products and never reached the cart is
 * a question worth asking. The point of listing *nothing but behaviour* is that
 * an unregistered person has told us nothing about themselves and this table
 * must not become a way of accumulating a profile anyway. There is no e-mail
 * here, no IP, no user-agent, and no name, because `funnel_events` holds none
 * of them and this function joins nothing that does.
 */
export async function anonymousVisitors(
  from: Date,
  to: Date,
  limit = 50,
): Promise<AnonymousVisitorRow[]> {
  const capped = Math.min(Math.max(1, Math.floor(limit)), 200);

  return (
    await query<{
      visitor_id: string;
      sessions: number;
      views: number;
      cart_adds: number;
      reached_wall: boolean;
      converted: boolean;
      last_seen: Date;
    }>(
      `SELECT f.visitor_id,
              count(DISTINCT f.session_id)::int                            AS sessions,
              count(*) FILTER (WHERE f.event = 'product_view')::int        AS views,
              count(*) FILTER (WHERE f.event = 'add_to_cart')::int         AS cart_adds,
              bool_or(f.event = 'checkout_intent')                         AS reached_wall,
              EXISTS (
                SELECT 1 FROM visitor_identities vi WHERE vi.visitor_id = f.visitor_id
              )                                                            AS converted,
              max(f.occurred_at)                                           AS last_seen
         FROM funnel_events f
        WHERE f.occurred_at >= $1 AND f.occurred_at < $2
          AND f.user_id IS NULL
        GROUP BY f.visitor_id
        ORDER BY bool_or(f.event = 'checkout_intent') DESC,
                 count(*) FILTER (WHERE f.event = 'add_to_cart') DESC,
                 max(f.occurred_at) DESC
        LIMIT ${capped}`,
      [from, to],
    )
  ).map((row) => ({
    visitorId: row.visitor_id,
    sessions: row.sessions,
    views: row.views,
    cartAdds: row.cart_adds,
    reachedWall: row.reached_wall,
    converted: row.converted,
    lastSeen: row.last_seen.toISOString(),
  }));
}

export interface AnonymousVisitorDetail {
  visitorId: string;
  sessions: number;
  converted: boolean;
  timeline: Array<{ at: string; kind: string; detail: string; sessionId: string }>;
}

/**
 * One anonymous visitor's journey.
 *
 * Behaviour only, and `session_id` is carried so the reader can see where one
 * visit ended and the next began — which is the whole reason to look at a single
 * visitor rather than an aggregate. Whether this visitor later became a customer
 * is reported as a boolean and nothing more: naming the account here would turn
 * a behavioural record into a personal one, and `customerDetail` is already the
 * right screen for that question.
 */
export async function anonymousVisitorDetail(
  visitorId: string,
  limit = 200,
): Promise<AnonymousVisitorDetail | null> {
  const capped = Math.min(Math.max(1, Math.floor(limit)), 500);

  const rows = await query<{
    at: Date;
    kind: string;
    detail: string | null;
    session_id: string;
  }>(
    `SELECT f.occurred_at AS at,
            f.event::text AS kind,
            COALESCE(f.product_id, '') AS detail,
            f.session_id
       FROM funnel_events f
      WHERE f.visitor_id = $1::uuid
      ORDER BY f.occurred_at DESC
      LIMIT ${capped}`,
    [visitorId],
  );

  if (rows.length === 0) return null;

  const [flags] = await query<{ converted: boolean }>(
    `SELECT EXISTS (
              SELECT 1 FROM visitor_identities vi WHERE vi.visitor_id = $1::uuid
            ) AS converted`,
    [visitorId],
  );

  return {
    visitorId,
    sessions: new Set(rows.map((row) => row.session_id)).size,
    converted: flags?.converted ?? false,
    timeline: rows.map((row) => ({
      at: row.at.toISOString(),
      kind: row.kind,
      detail: row.detail ?? '',
      sessionId: row.session_id,
    })),
  };
}

export interface ProductFunnelRow {
  productId: string;
  views: number;
  buyNows: number;
  cartAdds: number;
  /** Distinct paid orders containing this product. */
  purchases: number;
  units: number;
  /** Views → purchases, or null when nothing was viewed. */
  conversion: number | null;
}

/**
 * Per-product funnel.
 *
 * Views and cart adds come from browsing events; purchases come from
 * `order_items`, which is the authoritative record of what was actually bought
 * and needs no attribution row to be correct. The two are joined by product id
 * — the same unconstrained Hostinger id both sides already store.
 */
export async function productFunnel(
  from: Date,
  to: Date,
  limit = 50,
): Promise<ProductFunnelRow[]> {
  const capped = Math.min(Math.max(1, Math.floor(limit)), 200);

  const [browsing, purchased] = await Promise.all([
    query<{ product_id: string; views: number; buy_nows: number; cart_adds: number }>(
      `SELECT product_id,
              count(DISTINCT session_id) FILTER (WHERE event = 'product_view')::int AS views,
              count(DISTINCT session_id) FILTER (WHERE event = 'buy_now')::int      AS buy_nows,
              count(DISTINCT session_id) FILTER (WHERE event = 'add_to_cart')::int  AS cart_adds
         FROM funnel_events
        WHERE product_id IS NOT NULL
          AND occurred_at >= $1 AND occurred_at < $2
        GROUP BY product_id`,
      [from, to],
    ),
    query<{ product_id: string; purchases: number; units: number }>(
      `SELECT oi.product_id,
              count(DISTINCT o.id)::int AS purchases,
              COALESCE(sum(oi.quantity), 0)::int AS units
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
        WHERE o.created_at >= $1 AND o.created_at < $2
          AND ${EXCLUDE_COD}
          AND EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND ${CAPTURED})
        GROUP BY oi.product_id`,
      [from, to],
    ),
  ]);

  const rows = new Map<string, ProductFunnelRow>();

  for (const row of browsing) {
    rows.set(row.product_id, {
      productId: row.product_id,
      views: row.views,
      buyNows: row.buy_nows,
      cartAdds: row.cart_adds,
      purchases: 0,
      units: 0,
      conversion: null,
    });
  }

  // A product can sell without a recorded view — an order placed before
  // tracking shipped, or a shopper who arrived straight from a link.
  for (const row of purchased) {
    const existing = rows.get(row.product_id) ?? {
      productId: row.product_id,
      views: 0,
      buyNows: 0,
      cartAdds: 0,
      purchases: 0,
      units: 0,
      conversion: null,
    };
    existing.purchases = row.purchases;
    existing.units = row.units;
    rows.set(row.product_id, existing);
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      conversion: row.views === 0 ? null : row.purchases / row.views,
    }))
    .sort((a, b) => b.views - a.views || b.purchases - a.purchases)
    .slice(0, capped);
}

export interface CustomerActivityRow {
  userId: number;
  email: string;
  fullName: string | null;
  views: number;
  cartAdds: number;
  checkouts: number;
  orders: number;
  paidOrders: number;
  /** Paise. */
  paidValue: number;
  lastSeen: string | null;
}

/**
 * Customers with activity in the window, busiest first.
 *
 * Anonymous sessions are included through `visitor_identities`: once a shopper
 * signs in, the browsing that led there belongs to them, even though the events
 * themselves still carry the null `user_id` they had at the time.
 */
export async function customerActivity(
  from: Date,
  to: Date,
  limit = 50,
): Promise<CustomerActivityRow[]> {
  const capped = Math.min(Math.max(1, Math.floor(limit)), 200);

  return (
    await query<{
      user_id: number;
      email: string;
      full_name: string | null;
      views: number;
      cart_adds: number;
      checkouts: number;
      orders: number;
      paid_orders: number;
      paid_value: string | number;
      last_seen: Date | null;
    }>(
      `WITH identified AS (
         -- Events belonging to a person: either stamped at write time, or
         -- claimed later by signing in from the same browser.
         --
         -- Columns are listed rather than using f.*, which would carry a second
         -- user_id alongside the coalesced one and make every downstream
         -- reference ambiguous.
         SELECT COALESCE(f.user_id, vi.user_id) AS user_id,
                f.event,
                f.session_id,
                f.occurred_at
           FROM funnel_events f
           LEFT JOIN visitor_identities vi ON vi.visitor_id = f.visitor_id
          WHERE f.occurred_at >= $1 AND f.occurred_at < $2
       ),
       browsing AS (
         SELECT user_id,
                count(*) FILTER (WHERE event = 'product_view')::int   AS views,
                count(*) FILTER (WHERE event = 'add_to_cart')::int    AS cart_adds,
                count(DISTINCT session_id)
                  FILTER (WHERE event = 'begin_checkout')::int        AS checkouts,
                max(occurred_at)                                      AS last_seen
           FROM identified
          WHERE user_id IS NOT NULL
          GROUP BY user_id
       ),
       ordering AS (
         SELECT o.user_id,
                count(*)::int AS orders,
                count(*) FILTER (
                  WHERE EXISTS (
                    SELECT 1 FROM payments p WHERE p.order_id = o.id AND ${CAPTURED}
                  )
                )::int AS paid_orders,
                COALESCE(sum(o.total) FILTER (
                  WHERE EXISTS (
                    SELECT 1 FROM payments p WHERE p.order_id = o.id AND ${CAPTURED}
                  )
                ), 0)::bigint AS paid_value
           FROM orders o
          WHERE o.created_at >= $1 AND o.created_at < $2
            AND ${EXCLUDE_COD}
            AND o.user_id IS NOT NULL
          GROUP BY o.user_id
       )
       SELECT u.id AS user_id, u.email, u.full_name,
              COALESCE(b.views, 0)       AS views,
              COALESCE(b.cart_adds, 0)   AS cart_adds,
              COALESCE(b.checkouts, 0)   AS checkouts,
              COALESCE(g.orders, 0)      AS orders,
              COALESCE(g.paid_orders, 0) AS paid_orders,
              COALESCE(g.paid_value, 0)  AS paid_value,
              b.last_seen
         FROM users u
         LEFT JOIN browsing b ON b.user_id = u.id
         LEFT JOIN ordering g ON g.user_id = u.id
        WHERE b.user_id IS NOT NULL OR g.user_id IS NOT NULL
        ORDER BY COALESCE(g.paid_orders, 0) DESC,
                 COALESCE(b.views, 0) DESC,
                 u.id
        LIMIT ${capped}`,
      [from, to],
    )
  ).map((row) => ({
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
    views: row.views,
    cartAdds: row.cart_adds,
    checkouts: row.checkouts,
    orders: row.orders,
    paidOrders: row.paid_orders,
    paidValue: Number(row.paid_value),
    lastSeen: row.last_seen ? row.last_seen.toISOString() : null,
  }));
}

export interface CustomerTimelineEntry {
  at: string;
  kind: string;
  detail: string;
  /** Set for entries that point at an order. */
  orderNumber: string | null;
}

export interface CustomerDetail {
  userId: number;
  email: string;
  fullName: string | null;
  phone: string | null;
  createdAt: string;
  timeline: CustomerTimelineEntry[];
}

/**
 * One customer's journey, newest first.
 *
 * Browsing and commerce are unioned into a single ordered timeline because
 * that is the question being asked — "what did this person do" — and reading it
 * from two tables side by side would leave the admin interleaving timestamps by
 * hand.
 *
 * PII discipline: `funnel_events` itself holds no personal data. The name,
 * e-mail and phone below come from `users`, joined here and nowhere else, and
 * this function is only ever called from a page under the admin layout.
 */
export async function customerDetail(
  userId: number,
  limit = 200,
): Promise<CustomerDetail | null> {
  const capped = Math.min(Math.max(1, Math.floor(limit)), 500);

  const [person] = await query<{
    id: number;
    email: string;
    full_name: string | null;
    phone: string | null;
    created_at: Date;
  }>(`SELECT id, email, full_name, phone, created_at FROM users WHERE id = $1`, [userId]);

  if (!person) return null;

  const rows = await query<{
    at: Date;
    kind: string;
    detail: string | null;
    order_number: string | null;
  }>(
    `(
       SELECT f.occurred_at AS at,
              f.event::text  AS kind,
              COALESCE(f.product_id, '') AS detail,
              NULL::text AS order_number
         FROM funnel_events f
         LEFT JOIN visitor_identities vi ON vi.visitor_id = f.visitor_id
        WHERE COALESCE(f.user_id, vi.user_id) = $1
     )
     UNION ALL
     (
       SELECT o.created_at AS at,
              'order_created' AS kind,
              o.status::text  AS detail,
              o.order_number
         FROM orders o
        WHERE o.user_id = $1 AND ${EXCLUDE_COD}
     )
     UNION ALL
     (
       SELECT p.created_at AS at,
              'payment_' || p.status::text AS kind,
              p.provider AS detail,
              o.order_number
         FROM payments p
         JOIN orders o ON o.id = p.order_id
        WHERE o.user_id = $1 AND ${EXCLUDE_COD}
     )
     ORDER BY at DESC
     LIMIT ${capped}`,
    [userId],
  );

  return {
    userId: person.id,
    email: person.email,
    fullName: person.full_name,
    phone: person.phone,
    createdAt: person.created_at.toISOString(),
    timeline: rows.map((row) => ({
      at: row.at.toISOString(),
      kind: row.kind,
      detail: row.detail ?? '',
      orderNumber: row.order_number,
    })),
  };
}

/**
 * Which customers reached a given stage for a given product.
 *
 * This is the "who viewed this product / who added it to cart" question stated
 * directly. Anonymous sessions that never signed in are counted but carry no
 * identity — reported as a number rather than being dropped, so the totals
 * still add up.
 */
export async function productAudience(
  productId: string,
  event: 'product_view' | 'add_to_cart' | 'buy_now',
  from: Date,
  to: Date,
  limit = 100,
): Promise<{ customers: Array<{ userId: number; email: string; at: string }>; anonymous: number }> {
  const capped = Math.min(Math.max(1, Math.floor(limit)), 500);

  const [identified, anon] = await Promise.all([
    query<{ user_id: number; email: string; at: Date }>(
      `SELECT COALESCE(f.user_id, vi.user_id) AS user_id, u.email, max(f.occurred_at) AS at
         FROM funnel_events f
         LEFT JOIN visitor_identities vi ON vi.visitor_id = f.visitor_id
         JOIN users u ON u.id = COALESCE(f.user_id, vi.user_id)
        WHERE f.product_id = $1
          AND f.event = $2::funnel_event
          AND f.occurred_at >= $3 AND f.occurred_at < $4
        GROUP BY COALESCE(f.user_id, vi.user_id), u.email
        ORDER BY at DESC
        LIMIT ${capped}`,
      [productId, event, from, to],
    ),
    query<{ n: number }>(
      `SELECT count(DISTINCT f.session_id)::int AS n
         FROM funnel_events f
         LEFT JOIN visitor_identities vi ON vi.visitor_id = f.visitor_id
        WHERE f.product_id = $1
          AND f.event = $2::funnel_event
          AND f.occurred_at >= $3 AND f.occurred_at < $4
          AND COALESCE(f.user_id, vi.user_id) IS NULL`,
      [productId, event, from, to],
    ),
  ]);

  return {
    customers: identified.map((row) => ({
      userId: row.user_id,
      email: row.email,
      at: row.at.toISOString(),
    })),
    anonymous: anon[0]?.n ?? 0,
  };
}
