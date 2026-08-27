import { query, queryOne } from '@/lib/db/pool';
import type { OrderStatus } from '@/lib/orders/types';

/**
 * Admin analytics — fulfilment progress and revenue.
 *
 * Three decisions shape every query in this file.
 *
 * **Boundaries are computed in PostgreSQL, never in JavaScript.** India is
 * UTC+5:30, so a naive `new Date()` boundary puts everything between 00:00 and
 * 05:30 IST into the wrong day — and, on the first of a month, the wrong month.
 * Every column here is already `timestamptz`, so the conversion is purely a
 * query concern: `timezone('Asia/Kolkata', <timestamptz>)` gives IST wall-clock
 * as a naive timestamp, and `timezone('Asia/Kolkata', <timestamp>)` converts a
 * naive IST wall-clock back to an instant. Doing both in SQL means the answer
 * does not depend on where the server happens to run.
 *
 * **Cash on delivery is excluded from everything.** It is out of scope for this
 * phase, and a COD order has no captured payment to count as revenue. Rather
 * than let the two report families disagree about what an order is, one
 * predicate excludes it from both, so every figure here is prepaid-only — and
 * the screen says so.
 *
 * **Revenue is bucketed by when payment was captured, not when the order was
 * placed.** Those differ whenever a shopper returns to pay later, and a report
 * that moves money into the month the cart was created is simply wrong.
 */

/** COD is out of scope for this phase — see the note above. */
const EXCLUDE_COD = `o.payment_method <> 'cod'`;

/**
 * Captured payments only.
 *
 * `signature_verified` is part of the predicate on purpose: an unverified row
 * is not evidence that money moved, and revenue should never rest on one.
 */
const CAPTURED_AT = `(
  SELECT min(p.created_at)
    FROM payments p
   WHERE p.order_id = o.id
     AND p.status = 'paid'
     AND p.signature_verified
)`;

/**
 * The stages an order passes through, in order.
 *
 * Counted from `order_events` rather than `orders.status`, because an order
 * that is now `delivered` also passed through the three before it — a
 * current-status count would under-report every earlier stage.
 */
export const FULFILMENT_STAGES = ['confirmed', 'packed', 'shipped', 'delivered'] as const;
export type FulfilmentStage = (typeof FULFILMENT_STAGES)[number];

export const RANGE_KEYS = [
  'today',
  'this_month',
  'last_month',
  'last_3_months',
  'last_6_months',
  'month',
  'custom',
] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

const IST = 'Asia/Kolkata';

export interface ResolvedRange {
  key: RangeKey;
  /** Inclusive lower bound. */
  from: Date;
  /** Exclusive upper bound. */
  to: Date;
  /** For `month`, the `YYYY-MM` that was asked for. */
  month: string | null;
  /**
   * For `custom`, the dates actually in force. Null when a request was refused,
   * so nothing can label the screen with a window it is not showing.
   */
  customFrom: string | null;
  customTo: string | null;
  /**
   * What was typed, refused or not.
   *
   * Kept apart from the pair above because they answer different questions: one
   * is what the screen is showing, this is what the admin asked for. Echoing
   * this back means a rejected range can be corrected in the field that was
   * wrong rather than retyped from scratch.
   */
  requestedFrom: string | null;
  requestedTo: string | null;
  /**
   * Why a requested custom range was refused, if it was.
   *
   * Set alongside a *resolved* range rather than instead of one: an admin who
   * mistypes a date should still be looking at real numbers, not an empty
   * dashboard that reads like a collapse in trade.
   */
  error: string | null;
  label: string;
}

export function isRangeKey(value: string | undefined): value is RangeKey {
  return RANGE_KEYS.includes(value as RangeKey);
}

/** What a custom range was asked for, straight off the query string. */
export interface CustomRangeInput {
  from?: string;
  to?: string;
  /** The range in view when the custom form was submitted; restored on error. */
  prev?: string;
}

/**
 * A calendar date, strictly.
 *
 * `to_date` is lenient — it turns `2026-02-30` into 2 March without complaint,
 * which would silently report a window nobody asked for. Round-tripping through
 * `Date` and comparing the formatting back is what rejects it: only a real
 * calendar date survives unchanged.
 */
function isCalendarDate(value: string | undefined): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  // A typo like `0202-08-01` is a plausible slip and a meaningless window.
  if (year < 2000 || year > 2100) return false;

  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/**
 * Check a requested custom range, without resolving it.
 *
 * Returns the message to show, or null when the pair is usable. Kept separate
 * from `resolveRange` so the rules can be read — and tested — on their own.
 */
function customRangeProblem(custom: CustomRangeInput | undefined): string | null {
  if (!custom?.from || !custom?.to) return 'Enter both a start and an end date.';
  if (!isCalendarDate(custom.from)) return 'That start date is not a real date.';
  if (!isCalendarDate(custom.to)) return 'That end date is not a real date.';
  // Deliberately not swapped: silently reinterpreting the request would hide a
  // typo behind numbers that look plausible.
  if (custom.from > custom.to) return 'The start date must not be after the end date.';
  return null;
}

/**
 * The range as query parameters, for building a link that keeps it.
 *
 * Exists because the range is serialised into a URL in more than one place —
 * the filter control and the funnel's segment links. Two hand-rolled copies is
 * how one of them ends up quietly dropping a custom range.
 */
export function rangeParams(range: ResolvedRange): URLSearchParams {
  const params = new URLSearchParams({ range: range.key });
  if (range.month) params.set('month', range.month);
  if (range.customFrom) params.set('from', range.customFrom);
  if (range.customTo) params.set('to', range.customTo);
  return params;
}

function labelFor(key: RangeKey, from: Date, to: Date, month: string | null): string {
  const asMonth = new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: IST,
  });
  const asDay = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: IST,
  });

  switch (key) {
    case 'today':
      return `Today · ${asDay.format(from)}`;
    case 'this_month':
      return `This month · ${asMonth.format(from)}`;
    case 'last_month':
      return `Last month · ${asMonth.format(from)}`;
    case 'last_3_months':
      return `Last 3 months · from ${asMonth.format(from)}`;
    case 'last_6_months':
      return `Last 6 months · from ${asMonth.format(from)}`;
    case 'month':
      return month ? asMonth.format(from) : 'Selected month';
    case 'custom': {
      // `to` is exclusive, so the last day the admin actually asked for is the
      // day before it. Showing the exclusive bound would read as one day more
      // than was selected.
      const lastDay = new Date(to.getTime() - 1);
      const start = asDay.format(from);
      const end = asDay.format(lastDay);
      return start === end ? `${start}` : `${start} — ${end}`;
    }
  }
}

/**
 * Turn a range key into a half-open `[from, to)` pair of instants.
 *
 * Half-open deliberately: an order placed at exactly midnight IST belongs to
 * the day starting then, and to exactly one bucket.
 */
export async function resolveRange(
  key: RangeKey,
  month?: string,
  custom?: CustomRangeInput,
): Promise<ResolvedRange> {
  const normalisedMonth = key === 'month' && month && /^\d{4}-\d{2}$/.test(month) ? month : null;

  // A custom range that cannot be honoured falls back to whatever was on screen
  // when it was asked for, so the admin keeps their place while they fix the
  // date. `prev` is carried by the form; anything unusable lands on this_month.
  const problem = key === 'custom' ? customRangeProblem(custom) : null;
  const fallback: RangeKey =
    custom?.prev && isRangeKey(custom.prev) && custom.prev !== 'custom' ? custom.prev : 'this_month';

  // `month` without a valid YYYY-MM is meaningless. Fall back rather than let
  // `to_timestamp` improvise a date out of junk.
  const effective: RangeKey =
    key === 'month' && !normalisedMonth ? 'this_month' : problem ? fallback : key;

  // Only ever bound when the pair has already been validated above.
  const customFrom = effective === 'custom' ? (custom?.from ?? null) : null;
  const customTo = effective === 'custom' ? (custom?.to ?? null) : null;

  const row = await queryOne<{ from_ts: Date; to_ts: Date }>(
    `WITH start_local AS (
       SELECT CASE $1
         WHEN 'today'         THEN date_trunc('day',   timezone($3, now()))
         WHEN 'this_month'    THEN date_trunc('month', timezone($3, now()))
         WHEN 'last_month'    THEN date_trunc('month', timezone($3, now())) - interval '1 month'
         WHEN 'last_3_months' THEN date_trunc('month', timezone($3, now())) - interval '2 months'
         WHEN 'last_6_months' THEN date_trunc('month', timezone($3, now())) - interval '5 months'
         WHEN 'month'         THEN to_timestamp($2 || '-01', 'YYYY-MM-DD')::timestamp
         WHEN 'custom'        THEN to_date($4, 'YYYY-MM-DD')::timestamp
       END AS s
     ),
     span AS (
       SELECT s,
              CASE $1
                -- The end date is INCLUSIVE to the admin, so the exclusive
                -- bound is the start of the following day. Every other branch
                -- adds a span to the start; this one is the only one that
                -- computes its end independently.
                WHEN 'custom' THEN to_date($5, 'YYYY-MM-DD')::timestamp + interval '1 day'
                ELSE s + CASE $1
                           WHEN 'today'         THEN interval '1 day'
                           WHEN 'last_3_months' THEN interval '3 months'
                           WHEN 'last_6_months' THEN interval '6 months'
                           ELSE interval '1 month'
                         END
              END AS e
         FROM start_local
     )
     SELECT timezone($3, s) AS from_ts, timezone($3, e) AS to_ts FROM span`,
    [effective, normalisedMonth, IST, customFrom, customTo],
  );

  if (!row) throw new Error(`Could not resolve the analytics range "${key}".`);

  return {
    key: effective,
    from: row.from_ts,
    to: row.to_ts,
    month: normalisedMonth,
    customFrom,
    customTo,
    requestedFrom: key === 'custom' ? (custom?.from ?? null) : null,
    requestedTo: key === 'custom' ? (custom?.to ?? null) : null,
    error: problem,
    label: labelFor(effective, row.from_ts, row.to_ts, normalisedMonth),
  };
}

export interface FulfilmentCounts {
  /** Orders that reached each stage inside the window. */
  reached: Record<FulfilmentStage, number>;
  /** Where prepaid orders placed in the window are sitting right now. */
  pipeline: Record<OrderStatus, number>;
}

export async function fulfilmentCounts(from: Date, to: Date): Promise<FulfilmentCounts> {
  const [reachedRows, pipelineRows] = await Promise.all([
    // `order_events` records payment transitions in the same column, as
    // `payment:paid`, hence matching an explicit stage list rather than a
    // prefix. `DISTINCT` because a status can legitimately be re-entered.
    query<{ stage: FulfilmentStage; n: number }>(
      `SELECT e.to_status AS stage, count(DISTINCT e.order_id)::int AS n
         FROM order_events e
         JOIN orders o ON o.id = e.order_id
        WHERE e.to_status = ANY($3::text[])
          AND e.created_at >= $1 AND e.created_at < $2
          AND ${EXCLUDE_COD}
        GROUP BY e.to_status`,
      [from, to, [...FULFILMENT_STAGES]],
    ),
    query<{ status: OrderStatus; n: number }>(
      `SELECT o.status, count(*)::int AS n
         FROM orders o
        WHERE o.created_at >= $1 AND o.created_at < $2
          AND ${EXCLUDE_COD}
        GROUP BY o.status`,
      [from, to],
    ),
  ]);

  const reached = Object.fromEntries(FULFILMENT_STAGES.map((stage) => [stage, 0])) as Record<
    FulfilmentStage,
    number
  >;
  for (const row of reachedRows) reached[row.stage] = row.n;

  const pipeline: Record<OrderStatus, number> = {
    pending_payment: 0,
    confirmed: 0,
    packed: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  };
  for (const row of pipelineRows) pipeline[row.status] = row.n;

  return { reached, pipeline };
}

export interface RevenueTotals {
  /** Paise. */
  gross: number;
  orders: number;
  /** Paise; zero when there are no orders. */
  averageOrderValue: number;
  byProvider: Array<{ provider: string; gross: number; orders: number }>;
}

export async function revenue(from: Date, to: Date): Promise<RevenueTotals> {
  const rows = await query<{ provider: string; gross: string | number; orders: number }>(
    `SELECT o.payment_method AS provider,
            COALESCE(sum(o.total), 0)::bigint AS gross,
            count(*)::int AS orders
       FROM orders o
      WHERE o.payment_status = 'paid'
        AND ${EXCLUDE_COD}
        AND ${CAPTURED_AT} >= $1
        AND ${CAPTURED_AT} <  $2
      GROUP BY o.payment_method
      ORDER BY gross DESC`,
    [from, to],
  );

  const byProvider = rows.map((row) => ({
    provider: row.provider,
    gross: Number(row.gross),
    orders: row.orders,
  }));

  const gross = byProvider.reduce((sum, row) => sum + row.gross, 0);
  const orders = byProvider.reduce((sum, row) => sum + row.orders, 0);

  return {
    gross,
    orders,
    averageOrderValue: orders > 0 ? Math.round(gross / orders) : 0,
    byProvider,
  };
}

export interface MonthlyPoint {
  /** `YYYY-MM` in IST. */
  month: string;
  gross: number;
  orders: number;
}

/** Revenue by IST calendar month, for the trend strip. */
export async function monthlyRevenue(months = 12): Promise<MonthlyPoint[]> {
  const rows = await query<{ month: string; gross: string | number; orders: number }>(
    `SELECT to_char(date_trunc('month', timezone($2, ${CAPTURED_AT})), 'YYYY-MM') AS month,
            COALESCE(sum(o.total), 0)::bigint AS gross,
            count(*)::int AS orders
       FROM orders o
      WHERE o.payment_status = 'paid'
        AND ${EXCLUDE_COD}
        AND ${CAPTURED_AT} IS NOT NULL
        AND ${CAPTURED_AT} >= timezone(
              $2,
              date_trunc('month', timezone($2, now())) - make_interval(months => $1::int - 1)
            )
      GROUP BY 1
      ORDER BY 1`,
    [months, IST],
  );

  return rows.map((row) => ({
    month: row.month,
    gross: Number(row.gross),
    orders: row.orders,
  }));
}

/** IST months that actually hold prepaid orders, newest first. */
export async function availableMonths(): Promise<string[]> {
  const rows = await query<{ month: string }>(
    `SELECT DISTINCT to_char(date_trunc('month', timezone($1, o.created_at)), 'YYYY-MM') AS month
       FROM orders o
      WHERE ${EXCLUDE_COD}
      ORDER BY month DESC`,
    [IST],
  );
  return rows.map((row) => row.month);
}

export interface RecentFulfilment {
  orderNumber: string;
  stage: string;
  actor: string;
  at: string;
  total: number;
  status: OrderStatus;
}

/** Stage changes inside the window, newest first, with their timestamps. */
export async function recentFulfilment(
  from: Date,
  to: Date,
  limit = 25,
): Promise<RecentFulfilment[]> {
  const capped = Math.min(Math.max(1, Math.floor(limit)), 200);

  const rows = await query<{
    order_number: string;
    stage: string;
    actor: string;
    at: Date;
    total: string | number;
    status: OrderStatus;
  }>(
    `SELECT o.order_number, e.to_status AS stage, e.actor, e.created_at AS at,
            o.total, o.status
       FROM order_events e
       JOIN orders o ON o.id = e.order_id
      WHERE e.to_status = ANY($3::text[])
        AND e.created_at >= $1 AND e.created_at < $2
        AND ${EXCLUDE_COD}
      ORDER BY e.created_at DESC
      LIMIT ${capped}`,
    [from, to, [...FULFILMENT_STAGES]],
  );

  return rows.map((row) => ({
    orderNumber: row.order_number,
    stage: row.stage,
    actor: row.actor,
    at: row.at.toISOString(),
    total: Number(row.total),
    status: row.status,
  }));
}
