import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Boxes } from 'lucide-react';
import { availableMonths, isRangeKey, resolveRange } from '@/lib/admin/analytics';
import { productFunnel } from '@/lib/admin/funnel';
import { allProducts } from '@/lib/catalog/collections';
import { RangeFilter } from '@/components/admin/range-filter';

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
 */

function percent(rate: number | null): string {
  return rate === null ? '—' : `${(rate * 100).toFixed(1)}%`;
}

export default async function ProductFunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; month?: string }>;
}) {
  const params = await searchParams;
  const requested = isRangeKey(params.range) ? params.range : 'this_month';
  const range = await resolveRange(requested, params.month);

  const [rows, months, catalogue] = await Promise.all([
    productFunnel(range.from, range.to, 100),
    availableMonths(),
    // Best-effort: a catalogue outage must not take the report down, it just
    // leaves ids unresolved.
    allProducts().catch(() => []),
  ]);

  const titles = new Map(catalogue.map((product) => [product.id, product.title]));

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
        basePath="/admin/funnel/products"
      />

      <p className="mt-4 text-sm font-medium text-foreground">{range.label}</p>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
          No product activity in this period.
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
              {rows.map((row) => {
                const title = titles.get(row.productId);
                return (
                  <tr key={row.productId} className="transition-colors hover:bg-surface">
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">
                        {title ?? 'Not in catalogue'}
                      </span>
                      <span className="tabular block text-xs text-muted-foreground">
                        {row.productId}
                      </span>
                    </td>
                    <td className="tabular px-4 py-3 text-right">{row.views}</td>
                    <td className="tabular px-4 py-3 text-right">{row.buyNows}</td>
                    <td className="tabular px-4 py-3 text-right">{row.cartAdds}</td>
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
