import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, FlaskConical, Package } from 'lucide-react';
import { OrderProgressBar } from '@/components/account/order-progress';
import { StatusPill } from '@/components/admin/status-pill';
import { Button } from '@/components/ui/button';
import { StateBlock } from '@/components/ui/states';
import { formatPrice } from '@/lib/catalog/pricing';
import {
  EXPORT_ROW_LIMIT,
  ORDER_STATUSES,
  PAGE_SIZES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type TrackingQuery,
  datePresets,
  isFiltered,
  istDateTime,
  trackingSearch,
} from '@/lib/orders/admin-tracking';
import type { OrderSort } from '@/lib/orders/repository';
import { TRACK_STEPS, trackView } from '@/lib/orders/tracking';
import type { Order, OrderStatus, PaymentMethod } from '@/lib/orders/types';
import { cn } from '@/lib/utils';

/**
 * Every order, for an admin on /track: filters, a placed-date range, sortable
 * columns, status counts and a CSV of the whole filtered result.
 *
 * A server component with plain GET forms and links — the state is the URL
 * (see `lib/orders/admin-tracking.ts`), so it needs no client JavaScript and a
 * view survives a reload or a shared link.
 */

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'Waiting for payment',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cod: 'Cash on delivery',
  'razorpay-test': 'Razorpay',
  mock: 'Mock',
};

function label(value: string): string {
  return value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

const FIELD = 'h-10 rounded-md border border-input bg-card px-3 text-sm';

export function OrderTrackingTable({
  query,
  list,
  total,
  counts,
  dateError,
}: {
  query: TrackingQuery;
  list: Order[];
  total: number;
  counts: Record<OrderStatus, number>;
  dateError: string | null;
}) {
  const filtered = isFiltered(query);
  const allCount = ORDER_STATUSES.reduce((sum, s) => sum + counts[s], 0);
  const presets = datePresets(new Date());
  const href = (changes: Partial<TrackingQuery>) => `/track${trackingSearch(query, changes)}`;
  const exportHref = `/admin/orders/export${trackingSearch(query, { offset: 0 })}`;
  // Opens the visual tracker above the table, keeping the table's place.
  const trackHref = (orderNumber: string) => {
    const search = trackingSearch(query, { offset: query.offset });
    return `/track${search}${search ? '&' : '?'}order=${encodeURIComponent(orderNumber)}`;
  };

  return (
    <section aria-labelledby="all-orders" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="all-orders" className="heading-3">
            All orders
          </h2>
          <p className="tabular mt-1 text-sm text-muted-foreground">
            {total} order{total === 1 ? '' : 's'}
            {filtered ? ' matching these filters' : ''}
          </p>
        </div>
        <a
          href={exportHref}
          download
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary-600"
          title={`Every matching order, all pages (up to ${EXPORT_ROW_LIMIT.toLocaleString('en-IN')})`}
        >
          <Download className="h-4 w-4" />
          Download CSV
        </a>
      </div>

      {/* Status chips: a count per stage, each a one-click filter. */}
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        <Chip href={href({ status: undefined })} active={!query.status} label="All" count={allCount} />
        {ORDER_STATUSES.map((status) => (
          <Chip
            key={status}
            href={href({ status })}
            active={query.status === status}
            label={STATUS_LABEL[status]}
            count={counts[status]}
          />
        ))}
      </nav>

      <form action="/track" className="rounded-lg border border-border bg-card p-4">
        {/* Sort and page size survive a filter change. */}
        {query.sort !== 'placed' ? <input type="hidden" name="sort" value={query.sort} /> : null}
        {query.dir !== 'desc' ? <input type="hidden" name="dir" value={query.dir} /> : null}
        {query.size !== PAGE_SIZES[0] ? <input type="hidden" name="size" value={query.size} /> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="t-q" label="Search" className="sm:col-span-2">
            <input
              id="t-q"
              name="q"
              defaultValue={query.q}
              placeholder="Order number, phone, name or email"
              className={FIELD}
            />
          </Field>
          <Field id="t-status" label="Order status">
            <select id="t-status" name="status" defaultValue={query.status ?? ''} className={FIELD}>
              <option value="">Any</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="t-payment" label="Payment status">
            <select id="t-payment" name="payment" defaultValue={query.payment ?? ''} className={FIELD}>
              <option value="">Any</option>
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field id="t-method" label="Payment method">
            <select id="t-method" name="method" defaultValue={query.method ?? ''} className={FIELD}>
              <option value="">Any</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="t-test" label="Test orders">
            <select id="t-test" name="test" defaultValue={query.test ?? ''} className={FIELD}>
              <option value="">Include</option>
              <option value="hide">Hide</option>
              <option value="only">Only test orders</option>
            </select>
          </Field>
          <Field id="t-from" label="Placed from">
            <input
              id="t-from"
              name="from"
              type="date"
              defaultValue={query.from ?? ''}
              aria-invalid={dateError ? true : undefined}
              className={FIELD}
            />
          </Field>
          <Field id="t-to" label="Placed to (inclusive)">
            <input
              id="t-to"
              name="to"
              type="date"
              defaultValue={query.to ?? ''}
              aria-invalid={dateError ? true : undefined}
              className={FIELD}
            />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Quick range:</span>
          {presets.map((preset) => {
            const active = query.from === preset.from && query.to === preset.to;
            return (
              <Link
                key={preset.label}
                href={href({ from: preset.from, to: preset.to })}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:bg-secondary',
                )}
              >
                {preset.label}
              </Link>
            );
          })}
          {query.from || query.to ? (
            <Link
              href={href({ from: undefined, to: undefined })}
              className="px-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Any date
            </Link>
          ) : null}

          <span className="ml-auto flex items-center gap-2">
            {filtered ? (
              <Link
                href="/track"
                className="px-2 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Clear all
              </Link>
            ) : null}
            <Button type="submit" size="sm">
              Apply filters
            </Button>
          </span>
        </div>

        {dateError ? (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {dateError} Showing every date instead.
          </p>
        ) : null}
      </form>

      {list.length === 0 ? (
        <StateBlock
          icon={<Package className="h-6 w-6" />}
          title={filtered ? 'No orders match these filters' : 'No orders yet'}
          description={
            filtered
              ? 'Widen the date range, try the full order number or phone, or clear the filters.'
              : 'Orders placed on the storefront appear here.'
          }
        />
      ) : (
        <div className="relative overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[64rem] text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Order</th>
                <SortHeader query={query} sort="placed" label="Placed" href={href} />
                <SortHeader query={query} sort="customer" label="Customer" href={href} />
                <th scope="col" className="px-4 py-3 font-semibold">Items</th>
                <th scope="col" className="px-4 py-3 font-semibold">Delivery to</th>
                <th scope="col" className="px-4 py-3 font-semibold">Payment</th>
                <th scope="col" className="px-4 py-3 font-semibold">Progress</th>
                <SortHeader query={query} sort="updated" label="Last update" href={href} />
                <SortHeader query={query} sort="total" label="Total" href={href} align="right" />
                <th scope="col" className="px-4 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {list.map((order) => {
                const view = trackView(order.status, order.createdAt, [], order.stages);
                const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
                return (
                  <tr key={order.id} className="align-top transition-colors hover:bg-surface">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order.orderNumber}`}
                        className="tabular whitespace-nowrap font-semibold text-primary hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      {order.isTest ? (
                        <span className="mt-1 flex w-fit items-center gap-1 rounded-sm bg-warning-soft px-1.5 py-0.5 text-2xs font-bold uppercase text-warning">
                          <FlaskConical className="h-3 w-3" />
                          Test
                        </span>
                      ) : null}
                    </td>
                    <td className="tabular whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {istDateTime(order.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {order.contact.name}
                      <span className="tabular block text-xs text-muted-foreground">{order.contact.phone}</span>
                      <span className="block text-2xs text-muted-foreground">
                        {order.userId ? `Account #${order.userId}` : 'Guest order'}
                      </span>
                    </td>
                    <td className="max-w-[14rem] px-4 py-3">
                      <span className="line-clamp-2">{order.items[0]?.title ?? '—'}</span>
                      <span className="text-xs text-muted-foreground">
                        {units} unit{units === 1 ? '' : 's'}
                        {order.items.length > 1 ? ` · ${order.items.length} products` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {order.shippingAddress.city}
                      <span className="block text-xs text-muted-foreground">
                        {order.shippingAddress.state} {order.shippingAddress.pincode}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block whitespace-nowrap text-xs">{METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}</span>
                      <StatusPill kind="payment" value={order.paymentStatus} className="mt-1" />
                    </td>
                    <td className="min-w-[10rem] px-4 py-3">
                      <OrderProgressBar view={view} />
                      <span className="mt-1.5 block text-xs font-semibold text-foreground">
                        {view.cancelled
                          ? 'Cancelled'
                          : view.awaitingPayment
                            ? 'Waiting for payment'
                            : TRACK_STEPS[view.currentIndex].label}
                      </span>
                    </td>
                    <td className="tabular whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {istDateTime(order.updatedAt)}
                    </td>
                    <td className="tabular whitespace-nowrap px-4 py-3 text-right font-semibold">
                      {formatPrice(order.amounts.total)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={trackHref(order.orderNumber)}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Track
                      </Link>
                      <span className="mx-1.5 text-border">|</span>
                      <Link
                        href={`/admin/orders/${order.orderNumber}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Paging query={query} total={total} href={href} />
    </section>
  );
}

function Field({
  id,
  label: text,
  className,
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {text}
      </label>
      {children}
    </div>
  );
}

function Chip({ href, active, label: text, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-foreground hover:bg-secondary',
      )}
    >
      {text}
      <span
        className={cn(
          'tabular rounded-full px-1.5 text-xs',
          active ? 'bg-primary-foreground/20' : 'bg-secondary text-muted-foreground',
        )}
      >
        {count}
      </span>
    </Link>
  );
}

/** A column header that sorts by it; clicking the active one flips direction. */
function SortHeader({
  query,
  sort,
  label: text,
  href,
  align,
}: {
  query: TrackingQuery;
  sort: OrderSort;
  label: string;
  href: (changes: Partial<TrackingQuery>) => string;
  align?: 'right';
}) {
  const active = query.sort === sort;
  // Text sorts start A→Z; dates and amounts start newest/largest.
  const firstDir = sort === 'customer' ? 'asc' : 'desc';
  const dir = active ? (query.dir === 'asc' ? 'desc' : 'asc') : firstDir;
  const Icon = !active ? ArrowUpDown : query.dir === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th
      scope="col"
      aria-sort={active ? (query.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      className={cn('px-4 py-3 font-semibold', align === 'right' && 'text-right')}
    >
      <Link
        href={href({ sort, dir })}
        className={cn(
          'inline-flex items-center gap-1 uppercase hover:text-foreground',
          active && 'text-foreground',
        )}
      >
        {text}
        <Icon className="h-3.5 w-3.5" />
      </Link>
    </th>
  );
}

function Paging({
  query,
  total,
  href,
}: {
  query: TrackingQuery;
  total: number;
  href: (changes: Partial<TrackingQuery>) => string;
}) {
  const page = Math.floor(query.offset / query.size) + 1;
  const pages = Math.max(1, Math.ceil(total / query.size));

  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3">
      <p className="tabular text-sm text-muted-foreground">
        {total > 0
          ? `Page ${page} of ${pages} · showing ${query.offset + 1}–${Math.min(query.offset + query.size, total)} of ${total}`
          : 'Nothing to show'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Rows per page</span>
        {PAGE_SIZES.map((size) => (
          <Link
            key={size}
            href={href({ size })}
            aria-current={query.size === size ? 'true' : undefined}
            className={cn(
              'tabular rounded-md border px-2.5 py-1 text-xs font-medium',
              query.size === size
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-secondary',
            )}
          >
            {size}
          </Link>
        ))}
        {query.offset > 0 ? (
          <Link
            href={href({ offset: Math.max(0, query.offset - query.size) })}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
          >
            Previous
          </Link>
        ) : null}
        {query.offset + query.size < total ? (
          <Link
            href={href({ offset: query.offset + query.size })}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
          >
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
