import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Boxes, Filter, FlaskConical, TrendingDown, Users } from 'lucide-react';
import { availableMonths, isRangeKey, resolveRange } from '@/lib/admin/analytics';
import {
  FUNNEL_STAGES,
  STAGE_LABELS,
  STAGE_SOURCES,
  attributionCoverage,
  conversions,
  customerActivity,
  funnelCounts,
} from '@/lib/admin/funnel';
import { formatPrice } from '@/lib/catalog/pricing';
import { RangeFilter } from '@/components/admin/range-filter';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Customer funnel',
  robots: { index: false, follow: false },
};

/**
 * Customer funnel and per-customer activity.
 *
 * Authorization is inherited from `admin/layout.tsx`, which runs `requireAdmin`
 * for everything beneath it. This page does not repeat the check and must not
 * be moved out from under that layout — customer-level behaviour is exactly the
 * data that boundary exists to protect.
 *
 * Prepaid only, matching `/admin/analytics`: cash on delivery is out of scope
 * for this phase, and letting one screen count it while the other does not
 * would make the two impossible to reconcile.
 *
 * Every number is a count of *sessions*, not events. A shopper who views five
 * products reached the product-view stage once.
 */

const IST_DATETIME = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

function percent(rate: number | null): string {
  return rate === null ? '—' : `${(rate * 100).toFixed(1)}%`;
}

export default async function FunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; month?: string }>;
}) {
  const params = await searchParams;
  const requested = isRangeKey(params.range) ? params.range : 'this_month';
  const range = await resolveRange(requested, params.month);

  const [counts, months, coverage, customers] = await Promise.all([
    funnelCounts(range.from, range.to),
    availableMonths(),
    attributionCoverage(range.from, range.to),
    customerActivity(range.from, range.to, 50),
  ]);

  const rates = conversions(counts);
  const top = Math.max(1, counts.visit, ...FUNNEL_STAGES.map((stage) => counts[stage]));
  const unattributed = coverage.orders - coverage.attributed;

  return (
    <div className="container py-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All orders
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="heading-2">Customer funnel</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Prepaid only — cash on delivery is excluded, matching Analytics. Every stage counts
            distinct browsing sessions, bucketed in India Standard Time.
          </p>
        </div>
        <Link
          href="/admin/funnel/products"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          <Boxes className="h-4 w-4" />
          Product funnel
        </Link>
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <span>
          <strong className="font-semibold text-foreground">Test mode</strong> — the gateway is in
          test mode and every order in this database is flagged as a test. Tracking began when this
          feature shipped, so nothing before that date appears in the browsing stages.
        </span>
      </p>

      <RangeFilter
        current={range.key}
        currentMonth={range.month}
        months={months}
        basePath="/admin/funnel"
      />

      <p className="mt-4 text-sm font-medium text-foreground">{range.label}</p>

      {/* --------------------------------------------------------- funnel */}

      <section aria-labelledby="stages-heading" className="mt-4">
        <h2 id="stages-heading" className="flex items-center gap-2 heading-3">
          <Filter className="h-4.5 w-4.5 text-accent-600" />
          Stages
        </h2>

        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Stage</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Sessions</th>
                <th scope="col" className="px-4 py-3 font-semibold">Share of visitors</th>
                <th scope="col" className="px-4 py-3 font-semibold">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {FUNNEL_STAGES.map((stage) => {
                const value = counts[stage];
                return (
                  <tr key={stage}>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {STAGE_LABELS[stage]}
                    </td>
                    <td className="tabular px-4 py-3 text-right font-semibold">{value}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 min-w-[2px] rounded-sm bg-accent-500"
                          style={{ width: `${Math.round((value / top) * 100)}%` }}
                        />
                        <span className="tabular text-xs text-muted-foreground">
                          {counts.visit > 0 ? `${Math.round((value / counts.visit) * 100)}%` : '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {STAGE_SOURCES[stage]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* The gap this screen must never hide. Orders placed before tracking
            shipped have no session behind them, and would otherwise read as a
            conversion collapse rather than as missing coverage. */}
        {unattributed > 0 ? (
          <p className="mt-3 rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground">
            <strong className="font-semibold text-foreground">
              {`${unattributed} of ${coverage.orders} prepaid ${
                coverage.orders === 1 ? 'order' : 'orders'
              } in this period`}
            </strong>{' '}
            cannot be traced to a browsing session — placed before funnel tracking existed, or by a
            browser that sent no analytics cookie. They are counted in Analytics and in the
            customer table below, but not in the three payment and order stages above.
          </p>
        ) : null}
      </section>

      {/* ----------------------------------------------------- conversions */}

      <section aria-labelledby="conversion-heading" className="mt-8">
        <h2 id="conversion-heading" className="flex items-center gap-2 heading-3">
          <TrendingDown className="h-4.5 w-4.5 text-accent-600" />
          Conversion
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {rates.map((rate) => (
            <div key={rate.label} className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{rate.label}</p>
              <p className="tabular mt-1.5 font-display text-2xl font-bold text-foreground">
                {percent(rate.rate)}
              </p>
              <p className="tabular mt-1 text-xs text-muted-foreground">
                {counts[rate.to]} of {counts[rate.from]}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- customers */}

      <section aria-labelledby="customers-heading" className="mt-8">
        <h2 id="customers-heading" className="flex items-center gap-2 heading-3">
          <Users className="h-4.5 w-4.5 text-accent-600" />
          Customers
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Anonymous browsing is included from the moment a shopper signs in — the events keep the
          identity they had at the time, and the link resolves them.
        </p>

        {customers.length === 0 ? (
          <p className="mt-3 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
            No customer activity in this period.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Customer</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Views</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Cart adds</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Checkouts</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Paid</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Value</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {customers.map((row) => (
                  <tr key={row.userId} className="transition-colors hover:bg-surface">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/customers/${row.userId}`}
                        className="font-semibold text-primary hover:text-accent-600 hover:underline"
                      >
                        {row.fullName || row.email}
                      </Link>
                      {row.fullName ? (
                        <span className="block text-xs text-muted-foreground">{row.email}</span>
                      ) : null}
                    </td>
                    <td className="tabular px-4 py-3 text-right">{row.views}</td>
                    <td className="tabular px-4 py-3 text-right">{row.cartAdds}</td>
                    <td className="tabular px-4 py-3 text-right">{row.checkouts}</td>
                    <td className="tabular px-4 py-3 text-right font-semibold">{row.paidOrders}</td>
                    <td className="tabular px-4 py-3 text-right">
                      {row.paidValue > 0 ? formatPrice(row.paidValue) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {row.lastSeen ? IST_DATETIME.format(new Date(row.lastSeen)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
