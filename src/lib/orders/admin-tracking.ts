import type { OrderListFilters, OrderSort } from './repository';
import type { Order, OrderStatus, PaymentMethod, PaymentStatus } from './types';

/**
 * The admin view of /track: every order, filtered, sorted and exportable.
 * Pure — the page, the CSV route and their tests share it.
 *
 * Everything lives in the query string, like the /admin order filters, so a
 * filtered view can be bookmarked or sent to a colleague, and the CSV download
 * is simply the same query sent to the export route.
 */

export const ORDER_STATUSES: OrderStatus[] = [
  'pending_payment',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
];

export const PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'authorized', 'paid', 'failed', 'refunded'];

export const PAYMENT_METHODS: PaymentMethod[] = ['cod', 'razorpay-test', 'mock'];

export const SORTS: OrderSort[] = ['placed', 'updated', 'total', 'customer'];

export const PAGE_SIZES = [25, 50, 100] as const;

/** A CSV is a full export, but not an unbounded one. */
export const EXPORT_ROW_LIMIT = 10_000;

export interface TrackingQuery {
  q?: string;
  status?: OrderStatus;
  payment?: PaymentStatus;
  method?: PaymentMethod;
  from?: string;
  to?: string;
  /** `hide` leaves test orders out, `only` shows nothing else. */
  test?: 'hide' | 'only';
  sort: OrderSort;
  dir: 'asc' | 'desc';
  size: number;
  offset: number;
}

export type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v?.trim() || undefined;
}

function oneOf<T extends string>(allowed: readonly T[], value: string | undefined): T | undefined {
  return allowed.find((a) => a === value);
}

/**
 * A calendar date, strictly — `2026-02-30` is rejected rather than rolled into
 * March. Same rule as the analytics custom range.
 */
export function isCalendarDate(value: string | undefined): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 2000 || year > 2100) return false;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/**
 * Query string → validated query, plus why a date range was dropped.
 *
 * Only values the enums allow survive. A bad date range is dropped with a
 * message rather than guessed at — swapping a reversed pair would hide a typo
 * behind plausible-looking rows.
 */
export function parseTrackingQuery(raw: RawParams): { query: TrackingQuery; dateError: string | null } {
  let from = first(raw.from);
  let to = first(raw.to);
  let dateError: string | null = null;

  if (from && !isCalendarDate(from)) {
    dateError = 'That start date is not a real date.';
  } else if (to && !isCalendarDate(to)) {
    dateError = 'That end date is not a real date.';
  } else if (from && to && from > to) {
    dateError = 'The start date must not be after the end date.';
  }
  if (dateError) {
    from = undefined;
    to = undefined;
  }

  const size = Number.parseInt(first(raw.size) ?? '', 10);
  const offset = Number.parseInt(first(raw.offset) ?? '', 10);

  return {
    query: {
      q: first(raw.q)?.slice(0, 100),
      status: oneOf(ORDER_STATUSES, first(raw.status)),
      payment: oneOf(PAYMENT_STATUSES, first(raw.payment)),
      method: oneOf(PAYMENT_METHODS, first(raw.method)),
      from,
      to,
      test: oneOf(['hide', 'only'] as const, first(raw.test)),
      sort: oneOf(SORTS, first(raw.sort)) ?? 'placed',
      dir: first(raw.dir) === 'asc' ? 'asc' : 'desc',
      size: (PAGE_SIZES as readonly number[]).includes(size) ? size : PAGE_SIZES[0],
      // Clamped: a hand-edited offset must not become a negative OFFSET.
      offset: Number.isFinite(offset) ? Math.max(0, offset) : 0,
    },
    dateError,
  };
}

/** True when anything narrows the list (sorting and paging do not). */
export function isFiltered(query: TrackingQuery): boolean {
  return Boolean(
    query.q || query.status || query.payment || query.method || query.from || query.to || query.test,
  );
}

export function toListFilters(query: TrackingQuery): OrderListFilters {
  return {
    search: query.q,
    status: query.status,
    paymentStatus: query.payment,
    paymentMethod: query.method,
    placedFrom: query.from,
    placedTo: query.to,
    isTest: query.test === 'only' ? true : query.test === 'hide' ? false : undefined,
    sort: query.sort,
    direction: query.dir,
    limit: query.size,
    offset: query.offset,
  };
}

/**
 * The query as a URL search string, with `changes` applied. Defaults are left
 * out so a plain view stays a plain `/track`. Any change other than paging
 * returns to the first page — page 4 of a different filter means nothing.
 */
export function trackingSearch(
  query: TrackingQuery,
  changes: Partial<TrackingQuery> = {},
): string {
  const next: TrackingQuery = { ...query, ...changes };
  if (!('offset' in changes)) next.offset = 0;

  const params = new URLSearchParams();
  if (next.q) params.set('q', next.q);
  if (next.status) params.set('status', next.status);
  if (next.payment) params.set('payment', next.payment);
  if (next.method) params.set('method', next.method);
  if (next.from) params.set('from', next.from);
  if (next.to) params.set('to', next.to);
  if (next.test) params.set('test', next.test);
  if (next.sort !== 'placed') params.set('sort', next.sort);
  if (next.dir !== 'desc') params.set('dir', next.dir);
  if (next.size !== PAGE_SIZES[0]) params.set('size', String(next.size));
  if (next.offset > 0) params.set('offset', String(next.offset));
  const search = params.toString();
  return search ? `?${search}` : '';
}

/* ------------------------------------------------------------------ dates */

const IST = 'Asia/Kolkata';

/** `YYYY-MM-DD` for an instant, as a calendar day in India. */
export function istDay(at: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

function shiftDay(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Quick date ranges, inclusive IST days, relative to `now`. */
export function datePresets(now: Date): Array<{ label: string; from: string; to: string }> {
  const today = istDay(now);
  return [
    { label: 'Today', from: today, to: today },
    { label: 'Yesterday', from: shiftDay(today, -1), to: shiftDay(today, -1) },
    { label: 'Last 7 days', from: shiftDay(today, -6), to: today },
    { label: 'Last 30 days', from: shiftDay(today, -29), to: today },
    { label: 'This month', from: `${today.slice(0, 8)}01`, to: today },
  ];
}

/** `2026-10-21 19:34` in IST — sortable, and unambiguous in a spreadsheet. */
export function istDateTime(iso: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: IST,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/* -------------------------------------------------------------------- csv */

/**
 * One CSV cell, quoted when needed.
 *
 * A cell starting with `=`, `@`, `+` or `-` is a formula to Excel, and order
 * fields are typed by customers — a name of `=HYPERLINK(...)` must arrive as
 * text. Signed numbers (`+919876543210`, `-500`) are left alone: they are data
 * here, and an apostrophe in every phone number would be its own nuisance.
 */
export function csvCell(value: string | number | boolean | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=@\t\r]/.test(text) || (/^[+-]/.test(text) && !/^[+-]\d+(\.\d+)?$/.test(text))) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Paise → `49248.00`: a number a spreadsheet can add up, no currency symbol. */
function rupees(paise: number): string {
  return (paise / 100).toFixed(2);
}

const CSV_COLUMNS: Array<[string, (order: Order) => string | number | boolean | undefined]> = [
  ['Order number', (o) => o.orderNumber],
  ['Placed (IST)', (o) => istDateTime(o.createdAt)],
  ['Last updated (IST)', (o) => istDateTime(o.updatedAt)],
  ['Order status', (o) => o.status],
  ['Payment status', (o) => o.paymentStatus],
  ['Payment method', (o) => o.paymentMethod],
  ['Customer name', (o) => o.contact.name],
  ['Phone', (o) => o.contact.phone],
  ['Email', (o) => o.contact.email],
  ['Account', (o) => (o.userId ? `#${o.userId}` : 'Guest')],
  ['Address', (o) => [o.shippingAddress.line1, o.shippingAddress.line2, o.shippingAddress.landmark].filter(Boolean).join(', ')],
  ['City', (o) => o.shippingAddress.city],
  ['State', (o) => o.shippingAddress.state],
  ['Pincode', (o) => o.shippingAddress.pincode],
  ['Units', (o) => o.items.reduce((sum, item) => sum + item.quantity, 0)],
  ['Products', (o) => o.items.map((i) => `${i.title}${i.variantTitle ? ` (${i.variantTitle})` : ''} x${i.quantity}`).join('; ')],
  ['SKUs', (o) => o.items.map((i) => i.sku).join('; ')],
  ['Subtotal', (o) => rupees(o.amounts.subtotal)],
  ['Coupon', (o) => o.amounts.couponCode],
  ['Coupon discount', (o) => rupees(o.amounts.couponDiscount)],
  ['Payment discount', (o) => rupees(o.amounts.paymentDiscount)],
  ['Shipping', (o) => rupees(o.amounts.shipping)],
  ['COD fee', (o) => rupees(o.amounts.codFee)],
  ['GST', (o) => rupees(o.amounts.gstAmount)],
  ['Total', (o) => rupees(o.amounts.total)],
  ['Test order', (o) => (o.isTest ? 'yes' : 'no')],
];

/**
 * The orders as CSV text. Starts with a byte-order mark so Excel reads it as
 * UTF-8 (names and addresses are not all ASCII); CRLF line ends per RFC 4180.
 */
export function ordersCsv(list: readonly Order[]): string {
  const lines = [
    CSV_COLUMNS.map(([header]) => csvCell(header)).join(','),
    ...list.map((order) => CSV_COLUMNS.map(([, cell]) => csvCell(cell(order))).join(',')),
  ];
  return `﻿${lines.join('\r\n')}\r\n`;
}
