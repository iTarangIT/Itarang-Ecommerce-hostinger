import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldOff, UserSearch } from 'lucide-react';
import { availableMonths, isRangeKey, resolveRange } from '@/lib/admin/analytics';
import { anonymousVisitors, shortVisitor } from '@/lib/admin/funnel';
import { RangeFilter } from '@/components/admin/range-filter';

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
 * `funnel_events` stores none of them and `anonymousVisitors()` joins nothing
 * that does. Even the visitor id is truncated to four characters: enough to tell
 * two rows apart, far too little to correlate a screenshot back to a live cookie.
 */

const IST_DATETIME = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

export default async function AnonymousVisitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; month?: string }>;
}) {
  const params = await searchParams;
  const requested = isRangeKey(params.range) ? params.range : 'this_month';
  const range = await resolveRange(requested, params.month);

  const [visitors, months] = await Promise.all([
    anonymousVisitors(range.from, range.to, 100),
    availableMonths(),
  ]);

  return (
    <div className="container py-8">
      <Link
        href="/admin/funnel"
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
        reached the login wall first, then by cart activity.
      </p>

      <p className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground">
        <ShieldOff className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Behaviour only. No e-mail, name, IP address or device is recorded for an unregistered
          visitor, and the visitor id is shown truncated. Once someone signs in, their history moves
          to their customer page.
        </span>
      </p>

      <RangeFilter
        current={range.key}
        currentMonth={range.month}
        months={months}
        basePath="/admin/funnel/visitors"
      />

      <p className="mt-4 text-sm font-medium text-foreground">{range.label}</p>

      {visitors.length === 0 ? (
        <p className="mt-3 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
          No anonymous browsing in this period.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Visitor</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Sessions</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Views</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Cart adds</th>
                <th scope="col" className="px-4 py-3 font-semibold">Login wall</th>
                <th scope="col" className="px-4 py-3 font-semibold">Registered</th>
                <th scope="col" className="px-4 py-3 font-semibold">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {visitors.map((row) => (
                <tr key={row.visitorId} className="transition-colors hover:bg-surface">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/funnel/visitors/${row.visitorId}`}
                      className="font-semibold text-primary hover:text-accent-600 hover:underline"
                    >
                      Visitor {shortVisitor(row.visitorId)}…
                    </Link>
                  </td>
                  <td className="tabular px-4 py-3 text-right">{row.sessions}</td>
                  <td className="tabular px-4 py-3 text-right">{row.views}</td>
                  <td className="tabular px-4 py-3 text-right">{row.cartAdds}</td>
                  <td className="px-4 py-3 text-xs">
                    {row.reachedWall ? (
                      <span className="font-medium text-warning">Reached</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {row.converted ? (
                      <span className="font-medium text-success">Yes</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {IST_DATETIME.format(new Date(row.lastSeen))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
