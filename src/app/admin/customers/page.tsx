import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FlaskConical, MapPin, Package, Search, UserRound, X } from 'lucide-react';
import {
  availableMonths,
  geography,
  isRangeKey,
  resolveRange,
  type ResolvedRange,
} from '@/lib/admin/analytics';
import {
  customerPlaces,
  customerProfiles,
  type CustomerProfile,
} from '@/lib/admin/customers';
import { formatPrice } from '@/lib/catalog/pricing';
import { RangeFilter } from '@/components/admin/range-filter';
import { Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Customers',
  robots: { index: false, follow: false },
};

/**
 * Who is buying, where they are, and what they bought.
 *
 * A tab of its own rather than another section on the analytics page, because
 * it answers a different kind of question. Analytics is about money in
 * aggregate — how much, from which state, through which stage. This is about
 * named people, and it is the only screen in the console that puts a customer's
 * identity, their city and their purchase history on one row.
 *
 * That makes it the second most sensitive screen here, after the funnel's
 * customer detail. Authorization is inherited from `admin/layout.tsx`, which
 * runs `requireAdmin` for everything beneath it — this page does not repeat the
 * check and must not be moved out from under that layout. No API route exposes
 * the same join, so none of it is reachable except by an administrator loading
 * this URL.
 *
 * The state and city controls are links, not a form. A city's customer list is
 * something an administrator sends to somebody else, and a URL is how you do
 * that.
 */

const PAGE_SIZE = 25;

const IST_DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

interface PageParams {
  range?: string;
  month?: string;
  from?: string;
  to?: string;
  prev?: string;
  state?: string;
  city?: string;
  q?: string;
  offset?: string;
}

/**
 * A link that keeps the range and changes one filter.
 *
 * Written once because getting it wrong in one place is how a screen ends up
 * silently resetting the month when somebody picks a city.
 */
function filterHref(
  range: ResolvedRange,
  current: { state?: string; city?: string; q?: string },
  change: { state?: string | null; city?: string | null; q?: string | null; offset?: number },
): string {
  const search = new URLSearchParams();
  if (range.key !== 'this_month') search.set('range', range.key);
  if (range.month) search.set('month', range.month);

  const state = change.state === undefined ? current.state : (change.state ?? undefined);
  // Changing state clears the city: a city from another state would match
  // nothing and would read as an empty result rather than an impossible filter.
  const city =
    change.state !== undefined
      ? (change.city ?? undefined)
      : change.city === undefined
        ? current.city
        : (change.city ?? undefined);
  const q = change.q === undefined ? current.q : (change.q ?? undefined);

  if (state) search.set('state', state);
  if (city) search.set('city', city);
  if (q) search.set('q', q);
  if (change.offset && change.offset > 0) search.set('offset', String(change.offset));

  const query = search.toString();
  return query ? `/admin/customers?${query}` : '/admin/customers';
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<PageParams>;
}) {
  const params = await searchParams;
  const requested = isRangeKey(params.range) ? params.range : 'this_month';
  const range = await resolveRange(requested, params.month, {
    from: params.from,
    to: params.to,
    prev: params.prev,
  });

  const state = params.state?.trim() || undefined;
  const city = params.city?.trim() || undefined;
  const q = params.q?.trim() || undefined;

  // Clamped, not trusted: a hand-edited offset must not become an unbounded
  // scan or a negative OFFSET.
  const parsedOffset = Number.parseInt(params.offset ?? '0', 10);
  const offset = Number.isFinite(parsedOffset) ? Math.max(0, parsedOffset) : 0;

  const [page, places, months, byState] = await Promise.all([
    customerProfiles(range.from, range.to, { state, city, search: q }, PAGE_SIZE, offset),
    customerPlaces(range.from, range.to),
    availableMonths(),
    geography(range.from, range.to),
  ]);

  const current = { state, city, q };
  const selectedState = places.find((option) => option.state === state);
  const filtered = Boolean(state || city || q);

  return (
    <div className="container py-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All orders
      </Link>

      <h1 className="heading-2 mt-4 flex items-center gap-2">
        <UserRound className="h-5 w-5 text-accent-600" />
        Customers by city and state
      </h1>
      <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
        Every customer who paid for an order in this period, where it was delivered, and what they
        bought. Prepaid orders only — cash on delivery is excluded from every figure here, and all
        dates are bucketed in India Standard Time.
      </p>

      {/* Every order this build can create carries is_test = true. Saying so
          once, prominently, is better than qualifying each number. */}
      <p className="mt-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <span>
          Every order in this build is a test order. These figures describe the checkout, not the
          business.
        </span>
      </p>

      <div className="mt-5">
        <RangeFilter
          current={range.key}
          currentMonth={range.month}
          months={months}
          basePath="/admin/customers"
          carry={{
            ...(state ? { state } : {}),
            ...(city ? { city } : {}),
            ...(q ? { q } : {}),
          }}
          customFrom={params.from ?? null}
          customTo={params.to ?? null}
          error={range.error}
        />
      </div>

      {/* Where the customers are */}
      <section aria-labelledby="places-heading" className="mt-8">
        <h2 id="places-heading" className="flex items-center gap-2 heading-3">
          <MapPin className="h-4.5 w-4.5 text-accent-600" />
          Where they are
        </h2>
        <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
          From the delivery address recorded on each paid order, so a customer who moves house does
          not move their past orders with them. Pick a state, then a city, to narrow the list
          below.
        </p>

        {byState.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No captured payments with a delivery address in this period.
          </p>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">State</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Orders</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Deliveries</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {byState.map((place) => (
                    <tr
                      key={place.state}
                      className={cn(place.state === state && 'bg-accent-50/60')}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={filterHref(range, current, {
                            state: place.state === state ? null : place.state,
                            city: null,
                          })}
                          className="font-medium text-primary hover:text-accent-600 hover:underline"
                        >
                          {place.state}
                        </Link>
                        {place.stateCode ? (
                          <span className="tabular mt-0.5 block text-xs text-muted-foreground">
                            GST code {place.stateCode}
                          </span>
                        ) : null}
                      </td>
                      <td className="tabular px-4 py-3 text-right">{place.orders}</td>
                      {/* Named "Deliveries", not "Customers". The figure is a
                          sum across cities, so one person who ships to two of
                          them counts twice — which is the right number for a
                          delivery report and the wrong one for a headcount. The
                          list below is the headcount. */}
                      <td className="tabular px-4 py-3 text-right">{place.customers}</td>
                      <td className="tabular px-4 py-3 text-right font-semibold text-foreground">
                        {formatPrice(place.gross)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedState && selectedState.cities.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cities in {selectedState.state}
                </span>
                {selectedState.cities.map((option) => (
                  <Link
                    key={option}
                    href={filterHref(range, current, {
                      city: option === city ? null : option,
                    })}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                      option === city
                        ? 'border-accent bg-accent text-accent-foreground'
                        : 'border-border bg-card text-foreground hover:border-accent/50',
                    )}
                  >
                    {option}
                  </Link>
                ))}
              </div>
            ) : null}
          </>
        )}
      </section>

      {/* The customers themselves */}
      <section aria-labelledby="customers-heading" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="customers-heading" className="heading-3">
              Customer profiles
            </h2>
            <p className="tabular mt-1 text-sm text-muted-foreground">
              {page.total} customer{page.total === 1 ? '' : 's'}
              {filtered ? ' matching these filters' : ' in this period'}
            </p>
          </div>

          {/* A plain GET form, so the search lands in the URL like every other
              filter on this screen and needs no client JavaScript. */}
          <form action="/admin/customers" className="flex flex-wrap items-center gap-2">
            {range.key !== 'this_month' ? (
              <input type="hidden" name="range" value={range.key} />
            ) : null}
            {range.month ? <input type="hidden" name="month" value={range.month} /> : null}
            {state ? <input type="hidden" name="state" value={state} /> : null}
            {city ? <input type="hidden" name="city" value={city} /> : null}
            <Input
              name="q"
              defaultValue={q ?? ''}
              placeholder="Name, email or phone"
              aria-label="Search customers"
              className="h-9 w-56"
            />
            <Button type="submit" variant="outline" size="sm">
              <Search className="h-4 w-4" />
              Search
            </Button>
          </form>
        </div>

        {filtered ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {state ? (
              <FilterChip
                label={`State: ${state}`}
                href={filterHref(range, current, { state: null, city: null })}
              />
            ) : null}
            {city ? (
              <FilterChip label={`City: ${city}`} href={filterHref(range, current, { city: null })} />
            ) : null}
            {q ? (
              <FilterChip label={`Search: ${q}`} href={filterHref(range, current, { q: null })} />
            ) : null}
          </div>
        ) : null}

        {page.rows.length === 0 ? (
          <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
            {filtered
              ? 'No customer paid for an order matching these filters in this period.'
              : 'No captured payments in this period.'}
          </p>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[60rem] text-left text-sm">
                <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Customer</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Delivered to</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Bought</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Orders</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Spend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {page.rows.map((row) => (
                    <CustomerRow key={rowKey(row)} row={row} />
                  ))}
                </tbody>
              </table>
            </div>

            <Pager
              total={page.total}
              offset={offset}
              range={range}
              current={current}
            />
          </>
        )}
      </section>
    </div>
  );
}

/**
 * A stable React key for a row that may have no user id.
 *
 * A guest is identified by the email their order carried, and where there is
 * not even one — a phone-only guest order — by the pair of place and spend,
 * which is unique enough for a key and never rendered.
 */
function rowKey(row: CustomerProfile): string {
  return row.userId !== null
    ? `user:${row.userId}`
    : `guest:${row.email ?? ''}:${row.phone ?? ''}:${row.gross}`;
}

function FilterChip({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent-600 hover:bg-accent-50/70"
    >
      {label}
      <X className="h-3 w-3" />
    </Link>
  );
}

function CustomerRow({ row }: { row: CustomerProfile }) {
  return (
    <tr>
      <td className="px-4 py-3 align-top">
        {/* Only a signed-in customer has a profile to open. A guest is shown
            with the same detail and no link, rather than a link that 404s. */}
        {row.userId !== null ? (
          <Link
            href={`/admin/customers/${row.userId}`}
            className="font-semibold text-primary hover:text-accent-600 hover:underline"
          >
            {row.name}
          </Link>
        ) : (
          <span className="font-semibold text-foreground">{row.name}</span>
        )}
        <span className="mt-0.5 block text-xs text-muted-foreground">{row.email ?? '—'}</span>
        <span className="tabular mt-0.5 block text-xs text-muted-foreground">
          {row.phone ?? '—'}
        </span>
        {row.userId === null ? (
          <span className="mt-1 inline-block rounded-sm bg-secondary px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Guest
          </span>
        ) : null}
      </td>

      <td className="px-4 py-3 align-top">
        <span className="font-medium text-foreground">{row.city || '—'}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {row.state}
          {row.stateCode ? ` · GST ${row.stateCode}` : ''}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {row.orders === 1
            ? IST_DATE.format(new Date(row.lastOrderAt))
            : `${IST_DATE.format(new Date(row.firstOrderAt))} – ${IST_DATE.format(new Date(row.lastOrderAt))}`}
        </span>
      </td>

      <td className="px-4 py-3 align-top">
        {row.products.length === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <ul className="space-y-1.5">
            {row.products.map((product) => (
              <li key={product.sku} className="flex items-start gap-2 text-xs">
                <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="font-medium text-foreground">{product.title}</span>
                  {product.variantTitle ? (
                    <span className="text-muted-foreground"> · {product.variantTitle}</span>
                  ) : null}
                  <span className="tabular block text-muted-foreground">
                    {product.sku} · {product.quantity} × · {formatPrice(product.value)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </td>

      <td className="tabular px-4 py-3 text-right align-top">{row.orders}</td>
      <td className="tabular px-4 py-3 text-right align-top font-semibold text-foreground">
        {formatPrice(row.gross)}
      </td>
    </tr>
  );
}

function Pager({
  total,
  offset,
  range,
  current,
}: {
  total: number;
  offset: number;
  range: ResolvedRange;
  current: { state?: string; city?: string; q?: string };
}) {
  if (total <= PAGE_SIZE) return null;

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <nav aria-label="Pages" className="mt-5 flex items-center justify-between gap-3">
      <p className="tabular text-sm text-muted-foreground">
        Page {page} of {pages} · showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of{' '}
        {total}
      </p>
      <div className="flex gap-2">
        {offset > 0 ? (
          <Link
            href={filterHref(range, current, { offset: Math.max(0, offset - PAGE_SIZE) })}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            Previous
          </Link>
        ) : null}
        {offset + PAGE_SIZE < total ? (
          <Link
            href={filterHref(range, current, { offset: offset + PAGE_SIZE })}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
