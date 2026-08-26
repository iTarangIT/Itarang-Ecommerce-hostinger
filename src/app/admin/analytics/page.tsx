import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FlaskConical, IndianRupee, Package } from 'lucide-react';
import {
  FULFILMENT_STAGES,
  availableMonths,
  fulfilmentCounts,
  isRangeKey,
  monthlyRevenue,
  recentFulfilment,
  resolveRange,
  revenue,
} from '@/lib/admin/analytics';
import { formatPrice } from '@/lib/catalog/pricing';
import { RangeFilter, monthLabel } from '@/components/admin/range-filter';
import { StatusPill } from '@/components/admin/status-pill';
import type { OrderStatus } from '@/lib/orders/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Analytics',
  robots: { index: false, follow: false },
};

/**
 * Fulfilment and revenue reporting.
 *
 * Authorization is inherited from `admin/layout.tsx`, which runs `requireAdmin`
 * for everything beneath it — this page does not repeat the check, and must not
 * be moved out from under that layout.
 *
 * Everything here is prepaid-only: cash on delivery is out of scope for this
 * phase and has no captured payment to report as revenue, so it is excluded
 * from the fulfilment counts as well rather than letting the two halves of the
 * screen disagree about what an order is. The page says so, in the sub-heading.
 */

const PIPELINE_ORDER: OrderStatus[] = [
  'pending_payment',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
];

/** Timestamps are rendered in IST, matching the buckets they were counted in. */
const IST_DATETIME = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="tabular mt-1.5 font-display text-2xl font-bold text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; month?: string }>;
}) {
  const params = await searchParams;
  const requested = isRangeKey(params.range) ? params.range : 'this_month';
  const range = await resolveRange(requested, params.month);

  const [counts, money, series, months, recent] = await Promise.all([
    fulfilmentCounts(range.from, range.to),
    revenue(range.from, range.to),
    monthlyRevenue(12),
    availableMonths(),
    recentFulfilment(range.from, range.to, 25),
  ]);

  const peak = Math.max(1, ...series.map((point) => point.gross));

  return (
    <div className="container py-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All orders
      </Link>

      <h1 className="heading-2 mt-4">Analytics</h1>
      <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
        Prepaid orders only — cash on delivery is excluded from every figure on this page. All
        dates and totals are bucketed in India Standard Time.
      </p>

      {/* Every order this build can create carries is_test = true. Saying so
          once, prominently, is better than qualifying each number. */}
      <p className="mt-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <span>
          <strong className="font-semibold text-foreground">Test mode</strong> — the payment
          gateway is in test mode and every order in this database is flagged as a test. These
          figures show real records, but no money has moved.
        </span>
      </p>

      <RangeFilter current={range.key} currentMonth={range.month} months={months} />

      <p className="mt-4 text-sm font-medium text-foreground">{range.label}</p>

      {/* Revenue */}
      <section aria-labelledby="revenue-heading" className="mt-4">
        <h2 id="revenue-heading" className="flex items-center gap-2 heading-3">
          <IndianRupee className="h-4.5 w-4.5 text-accent-600" />
          Revenue
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Tile
            label="Captured"
            value={formatPrice(money.gross)}
            hint="Signature-verified payments only"
          />
          <Tile label="Paid orders" value={String(money.orders)} />
          <Tile
            label="Average order"
            value={money.orders > 0 ? formatPrice(money.averageOrderValue) : '—'}
          />
        </div>

        {money.byProvider.length > 0 ? (
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[26rem] text-left text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Payment method</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Orders</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Captured</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {money.byProvider.map((row) => (
                  <tr key={row.provider}>
                    <td className="px-4 py-3 capitalize">{row.provider}</td>
                    <td className="tabular px-4 py-3 text-right">{row.orders}</td>
                    <td className="tabular px-4 py-3 text-right font-semibold">
                      {formatPrice(row.gross)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* Fulfilment */}
      <section aria-labelledby="fulfilment-heading" className="mt-8">
        <h2 id="fulfilment-heading" className="flex items-center gap-2 heading-3">
          <Package className="h-4.5 w-4.5 text-accent-600" />
          Fulfilment in this period
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          How many orders <em>reached</em> each stage during the period. An order counts at every
          stage it passed through, so a delivered order also counts as confirmed, packed and
          shipped.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FULFILMENT_STAGES.map((stage) => (
            <Tile key={stage} label={stage} value={String(counts.reached[stage])} />
          ))}
        </div>

        <h3 className="mt-6 font-display text-sm font-semibold text-foreground">
          Where orders placed in this period are now
        </h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {PIPELINE_ORDER.map((status) => (
            <span
              key={status}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <StatusPill kind="order" value={status} />
              <span className="tabular font-semibold text-foreground">
                {counts.pipeline[status]}
              </span>
            </span>
          ))}
        </div>
      </section>

      {/* Trend */}
      <section aria-labelledby="trend-heading" className="mt-8">
        <h2 id="trend-heading" className="heading-3">
          Revenue by month
        </h2>
        {series.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No captured payments in the last 12 months.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {series.map((point) => (
              <li key={point.month} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-muted-foreground">
                  {monthLabel(point.month)}
                </span>
                <span className="h-5 flex-1 overflow-hidden rounded-sm bg-secondary">
                  <span
                    className="block h-full rounded-sm bg-accent"
                    style={{ width: `${Math.max(2, Math.round((point.gross / peak) * 100))}%` }}
                  />
                </span>
                <span className="tabular w-28 shrink-0 text-right text-sm font-semibold text-foreground">
                  {formatPrice(point.gross)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent stage changes */}
      <section aria-labelledby="recent-heading" className="mt-8">
        <h2 id="recent-heading" className="heading-3">
          Stage changes in this period
        </h2>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No orders changed stage in this period.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[38rem] text-left text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Order</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Moved to</th>
                  <th scope="col" className="px-4 py-3 font-semibold">By</th>
                  <th scope="col" className="px-4 py-3 font-semibold">When (IST)</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {recent.map((row, index) => (
                  <tr key={`${row.orderNumber}-${row.stage}-${index}`}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${row.orderNumber}`}
                        className="tabular font-semibold text-primary hover:text-accent-600 hover:underline"
                      >
                        {row.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill kind="order" value={row.stage as OrderStatus} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.actor}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {IST_DATETIME.format(new Date(row.at))}
                    </td>
                    <td className="tabular px-4 py-3 text-right font-semibold">
                      {formatPrice(row.total)}
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
