import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, UserSearch } from 'lucide-react';
import { availableMonths, isRangeKey, resolveRange } from '@/lib/admin/analytics';
import {
  COHORT_METRICS,
  DETAIL_EXPORT_LIMIT,
  DETAIL_PAGE_SIZE,
  anonymousCohort,
  isCohortMetric,
  parseCohortFilters,
} from '@/lib/admin/funnel-detail';
import { RangeFilter } from '@/components/admin/range-filter';
import { CohortFilterForm, CohortTable } from '@/components/admin/cohort-table';
import { DownloadLink, Pager, pageNumber, reportHref } from '@/components/admin/table-tools';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Anonymous → registered',
  robots: { index: false, follow: false },
};

/**
 * The visitors behind one of the anonymous → registered tiles.
 *
 * Authorization is inherited from `admin/layout.tsx`. Same population and
 * flags as `anonymousConversion()`, so the unfiltered row count is the tile's
 * number. A visitor who later signed in is shown with that account — the same
 * attribution the customer table makes — and one who never did is a truncated
 * visitor id and nothing else.
 */

export default async function AnonymousCohortPage({
  params,
  searchParams,
}: {
  params: Promise<{ metric: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { metric } = await params;
  if (!isCohortMetric(metric)) notFound();

  const query = await searchParams;
  const range = await resolveRange(isRangeKey(query.range) ? query.range : 'this_month', query.month, {
    from: query.from,
    to: query.to,
    prev: query.prev,
  });
  const filters = parseCohortFilters(query);
  const page = pageNumber(query.page);

  const [cohort, months] = await Promise.all([
    anonymousCohort(
      range.from,
      range.to,
      metric,
      filters,
      DETAIL_PAGE_SIZE,
      (page - 1) * DETAIL_PAGE_SIZE,
    ),
    availableMonths(),
  ]);

  const state: Record<string, string | undefined> = {
    q: filters.q,
    wall: filters.wall,
    registered: filters.registered,
    purchased: filters.purchased,
    sort: filters.sort,
  };
  const base = `/admin/funnel/anonymous/${metric}`;
  const carry = Object.fromEntries(
    Object.entries(state).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  const filtered = Object.keys(carry).length > 0;
  const label = COHORT_METRICS.find(([key]) => key === metric)?.[1] ?? metric;

  return (
    <div className="container py-8">
      <Link
        href={reportHref('/admin/funnel', range)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Customer funnel
      </Link>

      <h1 className="heading-2 mt-4 flex items-center gap-2">
        <UserSearch className="h-5 w-5 text-accent-600" />
        {label}
      </h1>
      <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
        Visitors who browsed signed-out in this period. Registration and paid orders follow a
        visitor beyond the period, exactly as the tile counts them. Click a row for the full
        journey.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {COHORT_METRICS.map(([key, text]) => (
          <Link
            key={key}
            href={reportHref(`/admin/funnel/anonymous/${key}`, range, state)}
            aria-current={key === metric ? 'page' : undefined}
            className={
              key === metric
                ? 'rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground'
                : 'rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary'
            }
          >
            {text}
          </Link>
        ))}
      </div>

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
            {cohort.total} visitor{cohort.total === 1 ? '' : 's'}
            {filtered ? ' matching these filters' : ''}
          </p>
        </div>
        {cohort.total > 0 ? (
          <DownloadLink
            href={reportHref('/admin/funnel/export', range, { ...state, table: 'anonymous', metric })}
            title={`Every matching visitor (up to ${DETAIL_EXPORT_LIMIT.toLocaleString('en-IN')})`}
          />
        ) : null}
      </div>

      <CohortFilterForm action={base} range={range} filters={filters} filtered={filtered} />

      {cohort.rows.length === 0 ? (
        <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
          Nobody matches in this period.
        </p>
      ) : (
        <CohortTable rows={cohort.rows} />
      )}

      <Pager
        page={page}
        pageSize={DETAIL_PAGE_SIZE}
        total={cohort.total}
        href={(n) => reportHref(base, range, { ...state, page: n === 1 ? undefined : n })}
      />
    </div>
  );
}
