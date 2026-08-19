import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { OrderStatus, PaymentStatus } from '@/lib/orders/types';

/**
 * Search and filter controls for the order list.
 *
 * A plain GET form, deliberately: the filter state lives in the URL, so a
 * filtered view can be bookmarked, shared with a colleague, or reloaded after
 * acting on an order without losing your place. Anything held in component
 * state would be lost on every status change.
 *
 * `OrderListFilters` has supported status, paymentStatus and offset since the
 * repository was written — this exposes what was already there.
 */

const ORDER_STATUSES: OrderStatus[] = [
  'pending_payment',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
];

const PAYMENT_STATUSES: PaymentStatus[] = [
  'pending',
  'authorized',
  'paid',
  'failed',
  'refunded',
];

function label(value: string): string {
  return value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export interface AdminFilterState {
  q?: string;
  status?: string;
  payment?: string;
}

export function OrderFilters({ current }: { current: AdminFilterState }) {
  const hasFilters = Boolean(current.q || current.status || current.payment);

  return (
    <form className="mt-6 flex flex-wrap items-end gap-2" action="/admin">
      <div className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
        <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
          Search
        </label>
        <input
          id="q"
          name="q"
          defaultValue={current.q}
          placeholder="Order number, phone, name or email"
          className="h-11 rounded-md border border-input bg-card px-3 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="status" className="text-xs font-medium text-muted-foreground">
          Order status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={current.status ?? ''}
          className="h-11 rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="">Any</option>
          {ORDER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {label(value)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="payment" className="text-xs font-medium text-muted-foreground">
          Payment
        </label>
        <select
          id="payment"
          name="payment"
          defaultValue={current.payment ?? ''}
          className="h-11 rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="">Any</option>
          {PAYMENT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {label(value)}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" variant="outline">
        Apply
      </Button>

      {hasFilters ? (
        <Link
          href="/admin"
          className="px-2 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Clear
        </Link>
      ) : null}
    </form>
  );
}

/**
 * Page links.
 *
 * Offset paging rather than cursors: the list is ordered by `created_at DESC`
 * with a covering index, admins jump to arbitrary pages, and an order shifting
 * between pages while someone reads is not a correctness problem here.
 */
export function Pagination({
  total,
  offset,
  pageSize,
  params,
}: {
  total: number;
  offset: number;
  pageSize: number;
  params: AdminFilterState;
}) {
  if (total <= pageSize) return null;

  const page = Math.floor(offset / pageSize) + 1;
  const pages = Math.ceil(total / pageSize);

  const href = (nextOffset: number) => {
    const search = new URLSearchParams();
    if (params.q) search.set('q', params.q);
    if (params.status) search.set('status', params.status);
    if (params.payment) search.set('payment', params.payment);
    if (nextOffset > 0) search.set('offset', String(nextOffset));
    const query = search.toString();
    return query ? `/admin?${query}` : '/admin';
  };

  return (
    <nav aria-label="Pages" className="mt-5 flex items-center justify-between gap-3">
      <p className="tabular text-sm text-muted-foreground">
        Page {page} of {pages} · showing {offset + 1}–{Math.min(offset + pageSize, total)} of{' '}
        {total}
      </p>
      <div className="flex gap-2">
        {offset > 0 ? (
          <Link
            href={href(Math.max(0, offset - pageSize))}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            Previous
          </Link>
        ) : null}
        {offset + pageSize < total ? (
          <Link
            href={href(offset + pageSize)}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
