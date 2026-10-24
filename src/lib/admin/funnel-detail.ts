import { query } from '@/lib/db/pool';
import { csvCell } from '@/lib/orders/admin-tracking';
import {
  CAPTURED,
  EXCLUDE_COD,
  FUNNEL_STAGES,
  STAGE_LABELS,
  isFunnelStage,
  shortVisitor,
  type CustomerActivityRow,
  type FunnelCounts,
  type FunnelSegment,
  type FunnelStage,
  type ProductFunnelRow,
} from './funnel';

/**
 * The rows behind every number on the funnel screen.
 *
 * `funnel.ts` answers "how many"; this answers "who". The rule that makes the
 * two trustworthy side by side is that every drill-down here is built from the
 * same predicates the count used, so the number of rows on a detail page is
 * the number that was clicked — not a similar-looking query that drifts.
 *
 * `reachedSql()` restates `stageCounts()` as rows instead of counts: one row per
 * (session, visitor, stage) fact, browsing from `funnel_events` and the money
 * stages from `order_attribution` → `payment_attempts` / `payments` /
 * `order_events`. Grouping those rows by session or by visitor and counting the
 * groups that reached a stage reproduces `funnelCounts()` / `funnelVisitorCounts()`
 * exactly.
 *
 * Identity. A row is resolved to an account through `visitor_identities`, the
 * same way `customerActivity()` attributes signed-out browsing to whoever later
 * signed in from that browser. A visitor who never signed in stays a truncated
 * visitor id and nothing more — `funnel_events` holds no name, e-mail or IP.
 */

/** A drill-down page holds this many rows; the CSV holds all of them. */
export const DETAIL_PAGE_SIZE = 100;

/** Hard ceiling for one CSV, matching the orders export. */
export const DETAIL_EXPORT_LIMIT = 10_000;

export type FunnelUnit = 'session' | 'visitor';

export function isFunnelUnit(value: unknown): value is FunnelUnit {
  return value === 'session' || value === 'visitor';
}

export type DetailSort = 'recent' | 'oldest';

export interface StageDetailFilters {
  /** Name, e-mail, order number or visitor/session id, matched anywhere. */
  q?: string;
  /** Rows resolved to an account, or rows that never were. */
  who?: 'known' | 'anonymous';
  /** Only rows where *this stage* happened on this product. */
  product?: string;
  /**
   * For a conversion card: the stage after this one. With `outcome`, keeps only
   * the rows that went on to reach it, or only the ones that did not.
   */
  next?: FunnelStage;
  outcome?: 'converted' | 'dropped';
  sort?: DetailSort;
}

export function parseStageDetailFilters(
  params: Record<string, string | undefined>,
): StageDetailFilters {
  const q = params.q?.trim().slice(0, 100);
  const product = params.product?.trim().slice(0, 100);
  return {
    q: q || undefined,
    who: params.who === 'known' || params.who === 'anonymous' ? params.who : undefined,
    product: product || undefined,
    next: isFunnelStage(params.next) ? params.next : undefined,
    outcome:
      params.outcome === 'converted' || params.outcome === 'dropped' ? params.outcome : undefined,
    sort: params.sort === 'oldest' ? 'oldest' : undefined,
  };
}

export interface StageDetailRow {
  /** The session id or the visitor id, depending on the unit. */
  key: string;
  visitorId: string | null;
  sessions: number;
  userId: number | null;
  email: string | null;
  fullName: string | null;
  /** Every stage this session/visitor reached in the window, in funnel order. */
  stages: FunnelStage[];
  /** Products viewed, added or bought. */
  products: string[];
  orders: string[];
  /** When this row first reached the stage being drilled into. ISO. */
  stageAt: string;
  firstAt: string;
  lastAt: string;
}

export interface DetailPage<T> {
  rows: T[];
  total: number;
}

/**
 * One row per (session, visitor, stage) fact in the window — `stageCounts()`
 * written out as rows. Uses `$1`/`$2` for the window.
 *
 * Kept in step with `stageCounts()` deliberately: the anonymous segment stops
 * at the login wall (nobody signed out can order), and `signed_in` is derived
 * through `visitor_identities` rather than read off the event.
 */
function reachedSql(segment: FunnelSegment): string {
  const segmentPredicate =
    segment === 'anonymous'
      ? 'AND f.user_id IS NULL'
      : segment === 'registered'
        ? 'AND COALESCE(f.user_id, vi.user_id) IS NOT NULL'
        : '';

  const ev = `ev AS (
       SELECT f.session_id, f.visitor_id, f.event::text AS stage, f.occurred_at AS at,
              f.product_id, COALESCE(f.user_id, vi.user_id) AS user_id
         FROM funnel_events f
         LEFT JOIN visitor_identities vi ON vi.visitor_id = f.visitor_id
        WHERE f.occurred_at >= $1 AND f.occurred_at < $2
          ${segmentPredicate}
     )`;

  if (segment === 'anonymous') {
    return `${ev},
     reached AS (
       SELECT session_id, visitor_id, stage, at, product_id, user_id, NULL::text AS order_number
         FROM ev
     )`;
  }

  return `${ev},
     ord AS (
       SELECT a.session_id, a.visitor_id, o.id AS order_id, o.order_number,
              o.created_at AS at, o.user_id,
              EXISTS (SELECT 1 FROM payment_attempts pa WHERE pa.order_id = o.id) AS initiated,
              EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND ${CAPTURED}) AS completed,
              EXISTS (
                SELECT 1 FROM order_events e
                 WHERE e.order_id = o.id AND e.to_status = 'confirmed'
              ) AS placed
         FROM order_attribution a
         JOIN orders o ON o.id = a.order_id
        WHERE o.created_at >= $1 AND o.created_at < $2
          AND ${EXCLUDE_COD}
     ),
     reached AS (
       SELECT session_id, visitor_id, stage, at, product_id, user_id, NULL::text AS order_number
         FROM ev
       UNION ALL
       SELECT session_id, visitor_id, 'signed_in', at, NULL, user_id, NULL
         FROM ev
        WHERE user_id IS NOT NULL
       UNION ALL
       SELECT o.session_id, o.visitor_id, s.stage, o.at, i.product_id, o.user_id, o.order_number
         FROM ord o
        CROSS JOIN LATERAL (
              VALUES ('payment_initiated', o.initiated),
                     ('payment_completed', o.completed),
                     ('order_placed', o.placed)
            ) AS s(stage, hit)
         LEFT JOIN order_items i ON i.order_id = o.order_id
        WHERE s.hit
     )`;
}

/** `%` and `_` typed into a search box are text, not wildcards. */
function likeTerm(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function stageOrder(stages: string[]): FunnelStage[] {
  return FUNNEL_STAGES.filter((stage) => stages.includes(stage));
}

/**
 * The sessions (or visitors) behind one cell of the stage table.
 *
 * With no filters, `total` equals `funnelCounts()[stage]` for `unit: 'session'`
 * and `funnelVisitorCounts()[stage]` for `unit: 'visitor'`.
 */
export async function stageDetail(
  stage: FunnelStage,
  unit: FunnelUnit,
  segment: FunnelSegment,
  from: Date,
  to: Date,
  filters: StageDetailFilters = {},
  limit = DETAIL_PAGE_SIZE,
  offset = 0,
): Promise<DetailPage<StageDetailRow>> {
  const capped = Math.min(Math.max(1, Math.floor(limit)), DETAIL_EXPORT_LIMIT);
  const skip = Math.max(0, Math.floor(offset));
  // A column name, from a closed union — never a value from the request.
  const column = unit === 'visitor' ? 'visitor_id' : 'session_id';

  const params: unknown[] = [from, to, stage, filters.product ?? ''];
  const where = ['g.hit'];

  if (filters.next && filters.outcome) {
    params.push(filters.next);
    where.push(
      filters.outcome === 'converted'
        ? `$${params.length} = ANY(g.stages)`
        : `NOT ($${params.length} = ANY(g.stages))`,
    );
  }
  if (filters.who === 'known') where.push('g.user_id IS NOT NULL');
  if (filters.who === 'anonymous') where.push('g.user_id IS NULL');
  if (filters.q) {
    params.push(likeTerm(filters.q));
    const n = params.length;
    where.push(`(
      u.email ILIKE '%' || $${n} || '%' OR
      u.full_name ILIKE '%' || $${n} || '%' OR
      g.key::text ILIKE '%' || $${n} || '%' OR
      g.visitor_id ILIKE '%' || $${n} || '%' OR
      EXISTS (SELECT 1 FROM unnest(g.orders) AS x(n) WHERE x.n ILIKE '%' || $${n} || '%')
    )`);
  }

  const rows = await query<{
    key: string;
    visitor_id: string | null;
    sessions: number;
    user_id: number | null;
    email: string | null;
    full_name: string | null;
    stages: string[];
    products: string[] | null;
    orders: string[] | null;
    stage_at: Date;
    first_at: Date;
    last_at: Date;
    total: number;
  }>(
    `WITH ${reachedSql(segment)},
     grouped AS (
       SELECT r.${column} AS key,
              count(DISTINCT r.session_id)::int AS sessions,
              max(r.visitor_id::text) AS visitor_id,
              max(r.user_id) AS user_id,
              array_agg(DISTINCT r.stage) AS stages,
              array_agg(DISTINCT r.product_id) FILTER (WHERE r.product_id IS NOT NULL) AS products,
              array_agg(DISTINCT r.order_number) FILTER (WHERE r.order_number IS NOT NULL) AS orders,
              min(r.at) FILTER (WHERE r.stage = $3) AS stage_at,
              bool_or(r.stage = $3 AND ($4 = '' OR r.product_id = $4)) AS hit,
              min(r.at) AS first_at,
              max(r.at) AS last_at
         FROM reached r
        WHERE r.${column} IS NOT NULL
        GROUP BY r.${column}
     )
     SELECT g.key::text AS key, g.visitor_id, g.sessions, g.user_id, u.email, u.full_name,
            g.stages, g.products, g.orders, g.stage_at, g.first_at, g.last_at,
            count(*) OVER ()::int AS total
       FROM grouped g
       LEFT JOIN users u ON u.id = g.user_id
      WHERE ${where.join(' AND ')}
      ORDER BY g.stage_at ${filters.sort === 'oldest' ? 'ASC' : 'DESC'}, g.key
      LIMIT ${capped} OFFSET ${skip}`,
    params,
  );

  return {
    total: rows[0]?.total ?? (skip > 0 ? await stageDetailTotal(stage, unit, segment, from, to, filters) : 0),
    rows: rows.map((row) => ({
      key: row.key,
      visitorId: row.visitor_id,
      sessions: row.sessions,
      userId: row.user_id,
      email: row.email,
      fullName: row.full_name,
      stages: stageOrder(row.stages),
      products: row.products ?? [],
      orders: row.orders ?? [],
      stageAt: row.stage_at.toISOString(),
      firstAt: row.first_at.toISOString(),
      lastAt: row.last_at.toISOString(),
    })),
  };
}

/** Only reached when a page beyond the last one was asked for. */
async function stageDetailTotal(
  stage: FunnelStage,
  unit: FunnelUnit,
  segment: FunnelSegment,
  from: Date,
  to: Date,
  filters: StageDetailFilters,
): Promise<number> {
  return (await stageDetail(stage, unit, segment, from, to, filters, 1, 0)).total;
}

/* ------------------------------------------------- anonymous → registered */

export type CohortMetric = 'visitors' | 'wall' | 'registered' | 'purchased';

export const COHORT_METRICS: ReadonlyArray<[CohortMetric, string]> = [
  ['visitors', 'Anonymous visitors'],
  ['wall', 'Reached the login wall'],
  ['registered', 'Registered or signed in'],
  ['purchased', 'Placed a paid order'],
];

export function isCohortMetric(value: unknown): value is CohortMetric {
  return COHORT_METRICS.some(([key]) => key === value);
}

export type CohortSort = 'progress' | 'recent' | 'views';

export interface CohortFilters {
  q?: string;
  /** `yes`/`no` narrow on each flag independently of the metric. */
  wall?: 'yes' | 'no';
  registered?: 'yes' | 'no';
  purchased?: 'yes' | 'no';
  sort?: CohortSort;
}

function yesNo(value: string | undefined): 'yes' | 'no' | undefined {
  return value === 'yes' || value === 'no' ? value : undefined;
}

export function parseCohortFilters(params: Record<string, string | undefined>): CohortFilters {
  const q = params.q?.trim().slice(0, 100);
  return {
    q: q || undefined,
    wall: yesNo(params.wall),
    registered: yesNo(params.registered),
    purchased: yesNo(params.purchased),
    sort: params.sort === 'recent' || params.sort === 'views' ? params.sort : undefined,
  };
}

export interface CohortRow {
  visitorId: string;
  sessions: number;
  views: number;
  cartAdds: number;
  reachedWall: boolean;
  /** The account this browser later signed in to, if any. */
  userId: number | null;
  email: string | null;
  fullName: string | null;
  /** Captured prepaid orders attributed to this visitor, at any time. */
  paidOrders: string[];
  firstAt: string;
  lastAt: string;
}

const COHORT_ORDER: Record<CohortSort, string> = {
  progress: `cardinality(c.paid_orders) > 0 DESC, c.user_id IS NOT NULL DESC, c.wall DESC,
             c.cart_adds DESC, c.last_at DESC`,
  recent: 'c.last_at DESC',
  views: 'c.views DESC, c.last_at DESC',
};

/**
 * The visitors behind the anonymous → registered tiles.
 *
 * The population and the three flags are `anonymousConversion()`'s, predicate
 * for predicate, so `metric: 'registered'` lists exactly the people counted in
 * that tile. Like the tile, registration and purchase follow a visitor beyond
 * the window; the login wall does not.
 */
export async function anonymousCohort(
  from: Date,
  to: Date,
  metric: CohortMetric,
  filters: CohortFilters = {},
  limit = DETAIL_PAGE_SIZE,
  offset = 0,
): Promise<DetailPage<CohortRow>> {
  const capped = Math.min(Math.max(1, Math.floor(limit)), DETAIL_EXPORT_LIMIT);
  const skip = Math.max(0, Math.floor(offset));

  const params: unknown[] = [from, to];
  const where: string[] = ['true'];
  const flag = (column: string, value: 'yes' | 'no' | undefined) => {
    if (value) where.push(value === 'yes' ? column : `NOT ${column}`);
  };

  if (metric === 'wall') where.push('c.wall');
  if (metric === 'registered') where.push('c.user_id IS NOT NULL');
  if (metric === 'purchased') where.push('cardinality(c.paid_orders) > 0');
  flag('c.wall', filters.wall);
  flag('(c.user_id IS NOT NULL)', filters.registered);
  flag('(cardinality(c.paid_orders) > 0)', filters.purchased);

  if (filters.q) {
    params.push(likeTerm(filters.q));
    const n = params.length;
    where.push(`(
      c.visitor_id::text ILIKE '%' || $${n} || '%' OR
      u.email ILIKE '%' || $${n} || '%' OR
      u.full_name ILIKE '%' || $${n} || '%' OR
      EXISTS (SELECT 1 FROM unnest(c.paid_orders) AS x(n) WHERE x.n ILIKE '%' || $${n} || '%')
    )`);
  }

  const rows = await query<{
    visitor_id: string;
    sessions: number;
    views: number;
    cart_adds: number;
    wall: boolean;
    user_id: number | null;
    email: string | null;
    full_name: string | null;
    paid_orders: string[];
    first_at: Date;
    last_at: Date;
    total: number;
  }>(
    `WITH anon AS (
       SELECT f.visitor_id,
              count(DISTINCT f.session_id)::int                     AS sessions,
              count(*) FILTER (WHERE f.event = 'product_view')::int AS views,
              count(*) FILTER (WHERE f.event = 'add_to_cart')::int  AS cart_adds,
              min(f.occurred_at)                                    AS first_at,
              max(f.occurred_at)                                    AS last_at
         FROM funnel_events f
        WHERE f.occurred_at >= $1 AND f.occurred_at < $2
          AND f.user_id IS NULL
        GROUP BY f.visitor_id
     ),
     c AS (
       SELECT anon.*,
              EXISTS (
                SELECT 1 FROM funnel_events w
                 WHERE w.visitor_id = anon.visitor_id
                   AND w.event = 'checkout_intent'
                   AND w.occurred_at >= $1 AND w.occurred_at < $2
              ) AS wall,
              (SELECT min(vi.user_id) FROM visitor_identities vi
                WHERE vi.visitor_id = anon.visitor_id) AS user_id,
              ARRAY(
                SELECT o.order_number
                  FROM order_attribution a
                  JOIN orders o ON o.id = a.order_id
                 WHERE a.visitor_id = anon.visitor_id
                   AND ${EXCLUDE_COD}
                   AND EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND ${CAPTURED})
                 ORDER BY o.created_at
              ) AS paid_orders
         FROM anon
     )
     SELECT c.visitor_id::text AS visitor_id, c.sessions, c.views, c.cart_adds, c.wall,
            c.user_id, u.email, u.full_name, c.paid_orders, c.first_at, c.last_at,
            count(*) OVER ()::int AS total
       FROM c
       LEFT JOIN users u ON u.id = c.user_id
      WHERE ${where.join(' AND ')}
      ORDER BY ${COHORT_ORDER[filters.sort ?? 'progress']}, c.visitor_id
      LIMIT ${capped} OFFSET ${skip}`,
    params,
  );

  return {
    total:
      rows[0]?.total ??
      (skip > 0 ? (await anonymousCohort(from, to, metric, filters, 1, 0)).total : 0),
    rows: rows.map((row) => ({
      visitorId: row.visitor_id,
      sessions: row.sessions,
      views: row.views,
      cartAdds: row.cart_adds,
      reachedWall: row.wall,
      userId: row.user_id,
      email: row.email,
      fullName: row.full_name,
      paidOrders: row.paid_orders,
      firstAt: row.first_at.toISOString(),
      lastAt: row.last_at.toISOString(),
    })),
  };
}

/* -------------------------------------------------------------------- csv */

/** Paise → `49248.00`: a number a spreadsheet can add up. */
function rupees(paise: number): string {
  return (paise / 100).toFixed(2);
}

/** `2026-10-24 08:34` in IST — sorts and parses in any spreadsheet. */
function istDateTime(iso: string | null): string {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

/** BOM so Excel reads UTF-8; CRLF per RFC 4180 — the same shape as `ordersCsv`. */
function toCsv<T>(
  columns: Array<[string, (row: T) => string | number | null | undefined]>,
  rows: readonly T[],
): string {
  const lines = [
    columns.map(([header]) => csvCell(header)).join(','),
    ...rows.map((row) => columns.map(([, cell]) => csvCell(cell(row))).join(',')),
  ];
  return `﻿${lines.join('\r\n')}\r\n`;
}

const stageNames = (stages: FunnelStage[]) => stages.map((stage) => STAGE_LABELS[stage]).join(' > ');

export function stagesCsv(counts: FunnelCounts, visitorCounts: FunnelCounts): string {
  return toCsv<FunnelStage>(
    [
      ['Stage', (stage) => STAGE_LABELS[stage]],
      ['Sessions', (stage) => counts[stage]],
      ['Visitors', (stage) => visitorCounts[stage]],
      [
        'Share of visits %',
        (stage) => (counts.visit > 0 ? Math.round((counts[stage] / counts.visit) * 100) : ''),
      ],
    ],
    FUNNEL_STAGES,
  );
}

export function stageDetailCsv(
  rows: readonly StageDetailRow[],
  unit: FunnelUnit,
  titles: ReadonlyMap<string, string>,
): string {
  return toCsv<StageDetailRow>(
    [
      [unit === 'visitor' ? 'Visitor' : 'Session', (row) => row.key],
      ['Visitor', (row) => row.visitorId ?? ''],
      ['Sessions', (row) => row.sessions],
      ['Customer', (row) => row.fullName ?? ''],
      ['Email', (row) => row.email ?? ''],
      ['Reached stage at (IST)', (row) => istDateTime(row.stageAt)],
      ['First seen (IST)', (row) => istDateTime(row.firstAt)],
      ['Last seen (IST)', (row) => istDateTime(row.lastAt)],
      ['Stages reached', (row) => stageNames(row.stages)],
      ['Furthest stage', (row) => STAGE_LABELS[row.stages[row.stages.length - 1] ?? 'visit']],
      ['Products', (row) => row.products.map((id) => titles.get(id) ?? id).join('; ')],
      ['Orders', (row) => row.orders.join('; ')],
    ],
    rows,
  );
}

export function cohortCsv(rows: readonly CohortRow[]): string {
  return toCsv<CohortRow>(
    [
      ['Visitor', (row) => row.visitorId],
      ['Sessions', (row) => row.sessions],
      ['Product views', (row) => row.views],
      ['Cart adds', (row) => row.cartAdds],
      ['Reached login wall', (row) => (row.reachedWall ? 'yes' : 'no')],
      ['Registered', (row) => (row.userId ? 'yes' : 'no')],
      ['Customer', (row) => row.fullName ?? ''],
      ['Email', (row) => row.email ?? ''],
      ['Paid orders', (row) => row.paidOrders.join('; ')],
      ['First seen (IST)', (row) => istDateTime(row.firstAt)],
      ['Last seen (IST)', (row) => istDateTime(row.lastAt)],
    ],
    rows,
  );
}

export function customerActivityCsv(rows: readonly CustomerActivityRow[]): string {
  return toCsv<CustomerActivityRow>(
    [
      ['Customer', (row) => row.fullName ?? ''],
      ['Email', (row) => row.email],
      ['Product views', (row) => row.views],
      ['Cart adds', (row) => row.cartAdds],
      ['Checkouts', (row) => row.checkouts],
      ['Orders', (row) => row.orders],
      ['Paid orders', (row) => row.paidOrders],
      ['Paid value (INR)', (row) => rupees(row.paidValue)],
      ['Last seen (IST)', (row) => istDateTime(row.lastSeen)],
    ],
    rows,
  );
}

export function productFunnelCsv(
  rows: readonly ProductFunnelRow[],
  titles: ReadonlyMap<string, string>,
): string {
  return toCsv<ProductFunnelRow>(
    [
      ['Product', (row) => titles.get(row.productId) ?? 'Not in catalogue'],
      ['Product id', (row) => row.productId],
      ['Views', (row) => row.views],
      ['Buy Now', (row) => row.buyNows],
      ['Cart adds', (row) => row.cartAdds],
      ['Purchases', (row) => row.purchases],
      ['Units', (row) => row.units],
      [
        'View to buy %',
        (row) => (row.conversion === null ? '' : (row.conversion * 100).toFixed(1)),
      ],
    ],
    rows,
  );
}

/** The on-screen handle for a row with no account: `Visitor 3f9a…`. */
export function visitorLabel(visitorId: string | null): string {
  return visitorId ? `Visitor ${shortVisitor(visitorId)}…` : 'Untracked visitor';
}
