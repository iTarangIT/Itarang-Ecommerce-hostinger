import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Boxes, Search } from 'lucide-react';
import { availableMonths, isRangeKey, resolveRange } from '@/lib/admin/analytics';
import { productFunnel } from '@/lib/admin/funnel';
import { allProducts } from '@/lib/catalog/collections';
import { RangeFilter } from '@/components/admin/range-filter';
import {
  CountLink,
  DownloadLink,
  FilterField,
  HiddenParams,
  IN_ROW_LINK,
  ROW_LINK,
  reportHref,
} from '@/components/admin/table-tools';
import { Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Product funnel',
  robots: { index: false, follow: false },
};

/**
 * Which products get looked at, which get added, which get bought.
 *
 * Views and cart adds come from browsing events; purchases come from
 * `order_items`, which is authoritative and needs no attribution row to be
 * correct. That asymmetry is deliberate and shows on screen: a product can have
 * purchases and no views if it sold before tracking existed.
 *
 * Titles are resolved from the live catalogue rather than stored alongside the
 * events. A product recreated in hPanel gets a new id, and pinning a title into
 * the event row would preserve a name that no longer matches anything.
 *
 * A row opens the sessions that viewed the product; the Buy Now and cart
 * numbers open the sessions behind them. Purchases are not linked: they come
 * from `order_items` and include orders no session can be traced to, so no
 * session list would add up to them.
 */

function percent(rate: number | null): string {
  return rate === null ? '—' : `${(rate * 100).toFixed(1)}%`;
}

export default async function ProductFunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; month?: string; from?: string; to?: string; prev?: string; q?: string }>;
}) {
  const params = await searchParams;
  const requested = isRangeKey(params.range) ? params.range : 'this_month';
  const range = await resolveRange(requested, params.month, {
    from: params.from,
    to: params.to,
    prev: params.prev,
  });

  const [rows, months, catalogue] = await Promise.all([
    productFunnel(range.from, range.to, 100),
    availableMonths(),
    // Best-effort: a catalogue outage must not take the report down, it just
    // leaves ids unresolved.
    allProducts().catch(() => []),
  ]);

  const titles = new Map(catalogue.map((product) => [product.id, product.title]));

  // Filtered here rather than in SQL: the title lives in the catalogue, not the events.
  const q = params.q?.trim().slice(0, 100) || undefined;
  const needle = q?.toLowerCase();
  const shown = needle
    ? rows.filter(
        (row) =>
          row.productId.toLowerCase().includes(needle) ||
          (titles.get(row.productId) ?? '').toLowerCase().includes(needle),
      )
    : rows;
  const drill = (stage: string, productId: string) =>
    reportHref(`/admin/funnel/stages/${stage}`, range, { product: productId });

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
        <Boxes className="h-5 w-5 text-accent-600" />
        Product funnel
      </h1>
      <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
        Views, Buy Now clicks and cart adds count distinct sessions. Purchases count captured,
        signature-verified prepaid orders containing the product.
      </p>

      <RangeFilter
        current={range.key}
        currentMonth={range.month}
        months={months}
        customFrom={range.requestedFrom}
        customTo={range.requestedTo}
        error={range.error}
        basePath="/admin/funnel/products"
        carry={q ? { q } : undefined}
      />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{range.label}</p>
          <p className="tabular mt-1 text-sm text-muted-foreground">
            {shown.length} product{shown.length === 1 ? '' : 's'}
            {q ? ' matching this search' : ''}. Click a row for the sessions that viewed it.
          </p>
        </div>
        {shown.length > 0 ? (
          <DownloadLink
            href={reportHref('/admin/funnel/export', range, { table: 'products', q })}
            title="Every product in this table"
          />
        ) : null}
      </div>

      <form
        action="/admin/funnel/products"
        className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-3"
      >
        <HiddenParams range={range} />
        <FilterField label="Search">
          <Input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Product name or id"
            aria-label="Search products"
            className="h-9 w-64"
          />
        </FilterField>
        <Button type="submit" variant="outline" size="sm" className="h-9">
          <Search className="h-4 w-4" />
          Apply
        </Button>
        {q ? (
          <Link
            href={reportHref('/admin/funnel/products', range)}
            className="inline-flex h-9 items-center px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {shown.length === 0 ? (
        <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
          {q ? 'No product matches this search.' : 'No product activity in this period.'}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Product</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Views</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Buy Now</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Cart adds</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Purchases</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Units</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">View → buy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {shown.map((row) => {
                const title = titles.get(row.productId);
                return (
                  <tr key={row.productId} className="relative transition-colors hover:bg-surface">
                    <td className="px-4 py-3">
                      <Link
                        href={drill('product_view', row.productId)}
                        className={cn('font-medium text-foreground hover:text-primary', ROW_LINK)}
                      >
                        {title ?? 'Not in catalogue'}
                      </Link>
                      <span className="tabular block text-xs text-muted-foreground">
                        {row.productId}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <CountLink href={drill('product_view', row.productId)} className={IN_ROW_LINK}>
                        {row.views}
                      </CountLink>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <CountLink href={drill('buy_now', row.productId)} className={IN_ROW_LINK}>
                        {row.buyNows}
                      </CountLink>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <CountLink href={drill('add_to_cart', row.productId)} className={IN_ROW_LINK}>
                        {row.cartAdds}
                      </CountLink>
                    </td>
                    <td className="tabular px-4 py-3 text-right font-semibold">{row.purchases}</td>
                    <td className="tabular px-4 py-3 text-right">{row.units}</td>
                    <td className="tabular px-4 py-3 text-right">{percent(row.conversion)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
