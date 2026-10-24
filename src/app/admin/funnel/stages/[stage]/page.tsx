import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Filter, Search } from 'lucide-react';
import { availableMonths, isRangeKey, resolveRange } from '@/lib/admin/analytics';
import {
  FUNNEL_SEGMENTS,
  SEGMENT_LABELS,
  STAGE_LABELS,
  isFunnelSegment,
  isFunnelStage,
} from '@/lib/admin/funnel';
import {
  DETAIL_EXPORT_LIMIT,
  DETAIL_PAGE_SIZE,
  isFunnelUnit,
  parseStageDetailFilters,
  stageDetail,
  visitorLabel,
} from '@/lib/admin/funnel-detail';
import { allProducts } from '@/lib/catalog/collections';
import { RangeFilter } from '@/components/admin/range-filter';
import {
  DownloadLink,
  FilterField,
  HiddenParams,
  IN_ROW_LINK,
  Pager,
  ROW_LINK,
  pageNumber,
  reportHref,
} from '@/components/admin/table-tools';
import { Input, Select } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Funnel stage',
  robots: { index: false, follow: false },
};

/**
 * The sessions or visitors behind one number on the funnel screen.
 *
 * Authorization is inherited from `admin/layout.tsx`. The row count with no
 * filters is the number that was clicked — `stageDetail()` restates the count
 * query as rows rather than approximating it.
 *
 * A row opens the customer page when the browser belongs to an account, and
 * the anonymous visitor timeline when it does not.
 */

const IST_DATETIME = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

type Params = Record<string, string | undefined>;

export default async function FunnelStagePage({
  params,
  searchParams,
}: {
  params: Promise<{ stage: string }>;
  searchParams: Promise<Params>;
}) {
  const { stage } = await params;
  if (!isFunnelStage(stage)) notFound();

  const query = await searchParams;
  const range = await resolveRange(isRangeKey(query.range) ? query.range : 'this_month', query.month, {
    from: query.from,
    to: query.to,
    prev: query.prev,
  });
  const unit = isFunnelUnit(query.unit) ? query.unit : 'session';
  const segment = isFunnelSegment(query.segment) ? query.segment : 'all';
  const filters = parseStageDetailFilters(query);
  const page = pageNumber(query.page);

  const [detail, months, catalogue] = await Promise.all([
    stageDetail(
      stage,
      unit,
      segment,
      range.from,
      range.to,
      filters,
      DETAIL_PAGE_SIZE,
      (page - 1) * DETAIL_PAGE_SIZE,
    ),
    availableMonths(),
    // Best-effort, as on the product funnel: an outage leaves ids unresolved.
    allProducts().catch(() => []),
  ]);
  const titles = new Map(catalogue.map((product) => [product.id, product.title]));

  // Everything this screen owns besides the range, so no control resets another.
  const state: Record<string, string | undefined> = {
    unit: unit === 'session' ? undefined : unit,
    segment: segment === 'all' ? undefined : segment,
    q: filters.q,
    who: filters.who,
    product: filters.product,
    next: filters.next,
    outcome: filters.outcome,
    sort: filters.sort,
  };
  const base = `/admin/funnel/stages/${stage}`;
  const href = (changes: Record<string, string | undefined>) =>
    reportHref(base, range, { ...state, ...changes });
  const carry = Object.fromEntries(
    Object.entries(state).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  const filtered = Boolean(filters.q || filters.who || filters.product || filters.sort);
  const unitWord = unit === 'visitor' ? 'visitor' : 'session';

  const toggle = (active: boolean) =>
    active
      ? 'rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground'
      : 'rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary';

  return (
    <div className="container py-8">
      <Link
        href={reportHref('/admin/funnel', range, { segment: state.segment })}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Customer funnel
      </Link>

      <h1 className="heading-2 mt-4 flex items-center gap-2">
        <Filter className="h-5 w-5 text-accent-600" />
        {STAGE_LABELS[stage]}
      </h1>
      <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
        Every {unitWord} that reached <strong className="text-foreground">{STAGE_LABELS[stage]}</strong>{' '}
        in this period. Click a row for the full journey — the customer page for someone with an
        account, the visitor timeline for someone without.
      </p>

      {/* ------------------------------------------------------ unit + segment */}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Count</span>
        <Link href={href({ unit: undefined, page: undefined })} className={toggle(unit === 'session')}>
          Sessions
        </Link>
        <Link href={href({ unit: 'visitor', page: undefined })} className={toggle(unit === 'visitor')}>
          Visitors
        </Link>
        <span className="ml-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Segment
        </span>
        {FUNNEL_SEGMENTS.map((option) => (
          <Link
            key={option}
            href={href({ segment: option === 'all' ? undefined : option, page: undefined })}
            className={toggle(segment === option)}
          >
            {SEGMENT_LABELS[option]}
          </Link>
        ))}
      </div>

      {/* A conversion card lands here with `next`: split the rows by whether they went on. */}
      {filters.next ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Then {STAGE_LABELS[filters.next]}?
          </span>
          <Link href={href({ outcome: undefined, page: undefined })} className={toggle(!filters.outcome)}>
            Everyone
          </Link>
          <Link
            href={href({ outcome: 'converted', page: undefined })}
            className={toggle(filters.outcome === 'converted')}
          >
            Went on
          </Link>
          <Link
            href={href({ outcome: 'dropped', page: undefined })}
            className={toggle(filters.outcome === 'dropped')}
          >
            Dropped off
          </Link>
        </div>
      ) : null}

      <RangeFilter
        current={range.key}
        currentMonth={range.month}
        months={months}
        customFrom={range.requestedFrom}
        customTo={range.requestedTo}
        error={range.error}
        basePath={base}
        carry={carry}
      />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{range.label}</p>
          <p className="tabular mt-1 text-sm text-muted-foreground">
            {detail.total} {unitWord}
            {detail.total === 1 ? '' : 's'}
            {filtered || filters.outcome ? ' matching these filters' : ''}
          </p>
        </div>
        {detail.total > 0 ? (
          <DownloadLink
            href={reportHref('/admin/funnel/export', range, { ...state, table: 'stage', stage })}
            title={`Every matching row (up to ${DETAIL_EXPORT_LIMIT.toLocaleString('en-IN')})`}
          />
        ) : null}
      </div>

      {/* ------------------------------------------------------------ filters */}

      <form
        action={base}
        className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-3"
      >
        <HiddenParams
          range={range}
          extra={{
            unit: state.unit,
            segment: state.segment,
            next: state.next,
            outcome: state.outcome,
          }}
        />
        <FilterField label="Search">
          <Input
            name="q"
            defaultValue={filters.q ?? ''}
            placeholder="Name, email, order or visitor id"
            aria-label="Search rows"
            className="h-9 w-64"
          />
        </FilterField>
        <FilterField label="Who">
          <Select name="who" defaultValue={filters.who ?? ''} className="h-9 w-40">
            <option value="">Everyone</option>
            <option value="known">With an account</option>
            <option value="anonymous">Never signed in</option>
          </Select>
        </FilterField>
        <FilterField label="Product at this step">
          <Select name="product" defaultValue={filters.product ?? ''} className="h-9 w-60">
            <option value="">Any product</option>
            {filters.product && !titles.has(filters.product) ? (
              <option value={filters.product}>{filters.product}</option>
            ) : null}
            {catalogue.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Sort">
          <Select name="sort" defaultValue={filters.sort ?? ''} className="h-9 w-36">
            <option value="">Newest first</option>
            <option value="oldest">Oldest first</option>
          </Select>
        </FilterField>
        <Button type="submit" variant="outline" size="sm" className="h-9">
          <Search className="h-4 w-4" />
          Apply
        </Button>
        {filtered ? (
          <Link
            href={href({ q: undefined, who: undefined, product: undefined, sort: undefined })}
            className="inline-flex h-9 items-center px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {/* -------------------------------------------------------------- table */}

      {detail.rows.length === 0 ? (
        <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
          Nobody matches in this period.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[60rem] text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Who</th>
                <th scope="col" className="px-4 py-3 font-semibold">Reached at</th>
                {unit === 'visitor' ? (
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Sessions</th>
                ) : null}
                <th scope="col" className="px-4 py-3 font-semibold">Got as far as</th>
                <th scope="col" className="px-4 py-3 font-semibold">Products</th>
                <th scope="col" className="px-4 py-3 font-semibold">Orders</th>
                <th scope="col" className="px-4 py-3 font-semibold">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {detail.rows.map((row) => {
                const target = row.userId
                  ? `/admin/customers/${row.userId}`
                  : row.visitorId
                    ? `/admin/funnel/visitors/${row.visitorId}`
                    : null;
                const name = row.userId ? row.fullName || row.email : visitorLabel(row.visitorId);
                const furthest = row.stages[row.stages.length - 1];
                return (
                  <tr key={row.key} className="relative transition-colors hover:bg-surface">
                    <td className="px-4 py-3">
                      {target ? (
                        <Link
                          href={target}
                          className={cn(
                            'font-semibold text-primary hover:text-accent-600 hover:underline',
                            ROW_LINK,
                          )}
                        >
                          {name}
                        </Link>
                      ) : (
                        <span className="font-semibold text-foreground">{name}</span>
                      )}
                      <span className="block text-xs text-muted-foreground">
                        {row.userId
                          ? [row.fullName ? row.email : null, visitorLabel(row.visitorId)]
                              .filter(Boolean)
                              .join(' · ')
                          : 'No account'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {IST_DATETIME.format(new Date(row.stageAt))}
                    </td>
                    {unit === 'visitor' ? (
                      <td className="tabular px-4 py-3 text-right">{row.sessions}</td>
                    ) : null}
                    <td className="px-4 py-3">
                      {furthest ? (
                        <span
                          title={row.stages.map((s) => STAGE_LABELS[s]).join(' → ')}
                          className="rounded-md border border-border bg-surface px-2 py-0.5 text-xs font-medium"
                        >
                          {STAGE_LABELS[furthest]}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[18rem] px-4 py-3 text-xs text-muted-foreground">
                      {row.products.length === 0
                        ? '—'
                        : row.products.map((id) => titles.get(id) ?? id).join(', ')}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {row.orders.length === 0
                        ? '—'
                        : row.orders.map((order) => (
                            <Link
                              key={order}
                              href={`/admin/orders/${order}`}
                              className={cn('mr-2 font-medium text-primary hover:underline', IN_ROW_LINK)}
                            >
                              {order}
                            </Link>
                          ))}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {IST_DATETIME.format(new Date(row.lastAt))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pager
        page={page}
        pageSize={DETAIL_PAGE_SIZE}
        total={detail.total}
        href={(n) => href({ page: n === 1 ? undefined : String(n) })}
      />
    </div>
  );
}
