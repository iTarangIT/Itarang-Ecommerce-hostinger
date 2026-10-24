import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldOff, UserSearch } from 'lucide-react';
import { availableMonths, isRangeKey, resolveRange } from '@/lib/admin/analytics';
import {
  DETAIL_EXPORT_LIMIT,
  DETAIL_PAGE_SIZE,
  anonymousCohort,
  parseCohortFilters,
} from '@/lib/admin/funnel-detail';
import { RangeFilter } from '@/components/admin/range-filter';
import { CohortFilterForm, CohortTable } from '@/components/admin/cohort-table';
import { DownloadLink, Pager, pageNumber, reportHref } from '@/components/admin/table-tools';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Anonymous visitors',
  robots: { index: false, follow: false },
};

/**
 * Individual anonymous visitors, so a single odd journey can be read.
 *
 * Authorization is inherited from `admin/layout.tsx`, which runs `requireAdmin`
 * for everything beneath it. This page does not repeat the check and must not be
 * moved out from under that layout.
 *
 * PRIVACY. Everyone listed here has told us nothing about themselves, and this
 * screen must not become a way of accumulating a profile regardless. It shows
 * behaviour and nothing else — no e-mail, no name, no IP, no user-agent, because
 * `funnel_events` stores none of them. Even the visitor id is truncated to four
 * characters: enough to tell two rows apart, far too little to correlate a
 * screenshot back to a live cookie. The one identity shown is the account a
 * visitor later chose to sign in to — the same attribution the customer table
 * already makes.
 */

export default async function AnonymousVisitorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const requested = isRangeKey(params.range) ? params.range : 'this_month';
  const range = await resolveRange(requested, params.month, {
    from: params.from,
    to: params.to,
    prev: params.prev,
  });
  const filters = parseCohortFilters(params);
  const page = pageNumber(params.page);

  const [visitors, months] = await Promise.all([
    anonymousCohort(
      range.from,
      range.to,
      'visitors',
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
  const carry = Object.fromEntries(
    Object.entries(state).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  const filtered = Object.keys(carry).length > 0;
  const base = '/admin/funnel/visitors';

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
        Anonymous visitors
      </h1>
      <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
        Visitors who browsed without being signed in. Ordered by how far they got — anyone who
        paid or registered first, then the login wall, then by cart activity. Click a row for the
        visitor&apos;s full timeline.
      </p>

      <p className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground">
        <ShieldOff className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Behaviour only. No e-mail, name, IP address or device is recorded for an unregistered
          visitor, and the visitor id is shown truncated. Once someone signs in, the account they
          signed in to is shown and their history moves to their customer page.
        </span>
      </p>

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
            {visitors.total} visitor{visitors.total === 1 ? '' : 's'}
            {filtered ? ' matching these filters' : ''}
          </p>
        </div>
        {visitors.total > 0 ? (
          <DownloadLink
            href={reportHref('/admin/funnel/export', range, {
              ...state,
              table: 'anonymous',
              metric: 'visitors',
            })}
            title={`Every matching visitor (up to ${DETAIL_EXPORT_LIMIT.toLocaleString('en-IN')})`}
          />
        ) : null}
      </div>

      <CohortFilterForm action={base} range={range} filters={filters} filtered={filtered} />

      {visitors.rows.length === 0 ? (
        <p className="mt-3 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
          {filtered
            ? 'No anonymous visitor matches these filters in this period.'
            : 'No anonymous browsing in this period.'}
        </p>
      ) : (
        <CohortTable rows={visitors.rows} />
      )}

      <Pager
        page={page}
        pageSize={DETAIL_PAGE_SIZE}
        total={visitors.total}
        href={(n) => reportHref(base, range, { ...state, page: n === 1 ? undefined : n })}
      />
    </div>
  );
}
