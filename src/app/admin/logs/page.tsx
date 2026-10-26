import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Package, ScrollText, Search, Truck } from 'lucide-react';
import { availableMonths, isRangeKey, resolveRange } from '@/lib/admin/analytics';
import {
  ENTITY_WORDS,
  LOG_TABS,
  ORDER_KINDS,
  PRODUCT_KINDS,
  orderEventWhat,
  orderLog,
  productLog,
  type LogTab,
  type OrderLogRow,
  type ProductLogRow,
} from '@/lib/admin/logs';
import { istDateTime } from '@/lib/orders/admin-tracking';
import { RangeFilter } from '@/components/admin/range-filter';
import {
  DownloadLink,
  FilterField,
  HiddenParams,
  Pager,
  pageNumber,
  reportHref,
} from '@/components/admin/table-tools';
import { Input, Select } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Logs',
  robots: { index: false, follow: false },
};

/**
 * Who changed what, and when.
 *
 * Product log: every admin change to the catalogue, with old → new values.
 * Order log: every move, payment, note and courier update on every order.
 *
 * Authorization comes from `admin/layout.tsx`; the CSV route checks for itself.
 */

const PAGE_SIZE = 50;

interface PageParams {
  tab?: string;
  range?: string;
  month?: string;
  from?: string;
  to?: string;
  prev?: string;
  q?: string;
  kind?: string;
  page?: string;
}

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<PageParams>;
}) {
  const params = await searchParams;
  const tab: LogTab = LOG_TABS.includes(params.tab as LogTab) ? (params.tab as LogTab) : 'product';
  const range = await resolveRange(isRangeKey(params.range) ? params.range : 'this_month', params.month, {
    from: params.from,
    to: params.to,
    prev: params.prev,
  });
  const q = params.q?.trim() || undefined;
  const kind = params.kind || undefined;
  const page = pageNumber(params.page);
  const offset = (page - 1) * PAGE_SIZE;

  const [months, result] = await Promise.all([
    availableMonths(),
    tab === 'product'
      ? productLog(range.from, range.to, { q, kind }, PAGE_SIZE, offset)
      : orderLog(range.from, range.to, { q, kind }, PAGE_SIZE, offset),
  ]);

  const carry = { tab, q, kind };
  const href = (extra: Record<string, string | number | undefined>) =>
    reportHref('/admin/logs', range, { ...carry, ...extra });
  const kinds = tab === 'product' ? PRODUCT_KINDS : ORDER_KINDS;

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
        <ScrollText className="h-5 w-5 text-accent-600" />
        Logs
      </h1>
      <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
        Every change made from the admin console. Times are India Standard Time.
      </p>

      <nav aria-label="Log" className="mt-5 flex gap-2 border-b border-border">
        {(
          [
            ['product', 'Product log', Package],
            ['order', 'Order log', Truck],
          ] as const
        ).map(([key, label, Icon]) => (
          <Link
            key={key}
            href={reportHref('/admin/logs', range, { tab: key })}
            aria-current={tab === key ? 'page' : undefined}
            className={cn(
              '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium',
              tab === key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <RangeFilter
        current={range.key}
        currentMonth={range.month}
        months={months}
        basePath="/admin/logs"
        carry={Object.fromEntries(
          Object.entries(carry).filter((entry): entry is [string, string] => Boolean(entry[1])),
        )}
        customFrom={params.from ?? null}
        customTo={params.to ?? null}
        error={range.error}
      />

      <form action="/admin/logs" className="mt-5 flex flex-wrap items-end gap-3">
        <HiddenParams range={range} extra={{ tab }} />
        <div className="min-w-[16rem] flex-1">
          <FilterField label="Search">
            <Input
              name="q"
              defaultValue={q ?? ''}
              placeholder={
                tab === 'product'
                  ? 'Product, SKU, admin email or action'
                  : 'Order number, customer, phone, admin or note'
              }
            />
          </FilterField>
        </div>
        <FilterField label="Show">
          <Select name="kind" defaultValue={kind ?? ''}>
            <option value="">Everything</option>
            {kinds.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FilterField>
        <Button type="submit" variant="outline">
          <Search className="h-4 w-4" />
          Apply
        </Button>
        <DownloadLink
          href={reportHref('/admin/logs/export', range, carry)}
          title="Every row matching these filters"
        />
      </form>

      <p className="tabular mt-4 text-sm text-muted-foreground">
        {result.total} entr{result.total === 1 ? 'y' : 'ies'} · {range.label}
      </p>

      {result.total === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nothing recorded for these filters.
        </p>
      ) : tab === 'product' ? (
        <ProductTable rows={result.rows as ProductLogRow[]} />
      ) : (
        <OrderTable rows={result.rows as OrderLogRow[]} />
      )}

      <Pager page={page} pageSize={PAGE_SIZE} total={result.total} href={(p) => href({ page: p })} />
    </div>
  );
}

const TH = 'px-4 py-3 font-semibold';
const TD = 'px-4 py-3 align-top';

function ProductTable({ rows }: { rows: ProductLogRow[] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className={TH}>When</th>
            <th scope="col" className={TH}>Admin</th>
            <th scope="col" className={TH}>Item</th>
            <th scope="col" className={TH}>Action</th>
            <th scope="col" className={TH}>What changed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className={cn(TD, 'tabular whitespace-nowrap text-muted-foreground')}>{istDateTime(row.at)}</td>
              <td className={cn(TD, 'break-all text-xs')}>{row.actor}</td>
              <td className={TD}>
                <span className="block text-2xs font-semibold uppercase text-muted-foreground">
                  {ENTITY_WORDS[row.entityType] ?? row.entityType}
                </span>
                {row.entityType === 'product' && row.entityId ? (
                  <Link
                    href={`/admin/products/${encodeURIComponent(row.entityId)}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {row.label ?? row.entityId}
                  </Link>
                ) : row.entityType === 'campaign' && row.entityId ? (
                  <Link
                    href={`/admin/campaigns/${encodeURIComponent(row.entityId)}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {row.label ?? row.entityId}
                  </Link>
                ) : (
                  <span className="font-medium">{row.label ?? row.entityId ?? '—'}</span>
                )}
              </td>
              <td className={TD}>
                {row.action}
                {row.summary ? <span className="block text-xs text-muted-foreground">{row.summary}</span> : null}
              </td>
              <td className={TD}>
                {row.changes.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {row.changes.slice(0, 12).map((change, index) => (
                      <li key={index}>
                        <span className="font-medium text-foreground">{change.field}:</span>{' '}
                        <span className="text-muted-foreground line-through decoration-muted-foreground/50">
                          {change.from}
                        </span>{' '}
                        → <span className="text-foreground">{change.to}</span>
                      </li>
                    ))}
                    {row.changes.length > 12 ? (
                      <li className="text-muted-foreground">
                        and {row.changes.length - 12} more (in the CSV)
                      </li>
                    ) : null}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderTable({ rows }: { rows: OrderLogRow[] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className={TH}>When</th>
            <th scope="col" className={TH}>Order</th>
            <th scope="col" className={TH}>Customer</th>
            <th scope="col" className={TH}>What happened</th>
            <th scope="col" className={TH}>By</th>
            <th scope="col" className={TH}>Note</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className={cn(TD, 'tabular whitespace-nowrap text-muted-foreground')}>{istDateTime(row.at)}</td>
              <td className={TD}>
                <Link
                  href={`/admin/orders/${row.orderNumber}`}
                  className="tabular font-semibold text-primary hover:underline"
                >
                  {row.orderNumber}
                </Link>
              </td>
              <td className={TD}>
                {row.customerName}
                <span className="tabular block text-xs text-muted-foreground">{row.customerPhone}</span>
              </td>
              <td className={cn(TD, 'font-medium')}>{orderEventWhat(row)}</td>
              <td className={cn(TD, 'break-all text-xs')}>{row.actor}</td>
              <td className={cn(TD, 'max-w-xs')}>
                {row.note ? (
                  <>
                    {row.note}
                    {row.customerVisible ? null : (
                      <span className="mt-0.5 block text-2xs font-semibold uppercase text-muted-foreground">
                        Internal — not shown to customer
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
