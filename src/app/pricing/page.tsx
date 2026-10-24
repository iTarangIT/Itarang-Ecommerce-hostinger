import type { Metadata } from 'next';
import Link from 'next/link';
import { allProducts } from '@/lib/catalog/collections';
import { catalog } from '@/lib/commerce';
import { toProductSummary } from '@/lib/commerce/summary';
import { formatPrice } from '@/lib/catalog/pricing';
import { productPath } from '@/lib/routes';
import type { Product } from '@/lib/commerce/types';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { PriceListAdd } from '@/components/catalog/price-list-add';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Check price — Trontek battery and charger price list',
  description:
    'Prices for every Trontek lithium battery and charger on iTarang in one table: e-rickshaw, 2-wheeler, home inverter, ESS and chargers, with capacity, voltage and warranty.',
  alternates: { canonical: '/pricing' },
};

/**
 * "Check price": the whole range in one comparable table, a page Livguard has
 * and shoppers use to shortlist before opening any product.
 *
 * Grouped by subcategory in the business's order, filterable to one group with
 * `?type=`. Every figure comes from the catalogue: a product that states no
 * warranty shows a dash, never a default. Only published products appear —
 * the catalogue serves nothing else — so an unpriced draft cannot show here.
 */


function energyKwh(product: Product): string | null {
  const { batteryAh, voltage } = product.facets;
  if (!batteryAh || !voltage || product.category !== 'batteries') return null;
  return `${((batteryAh * voltage) / 1000).toFixed(2)} kWh`;
}

function warranty(product: Product): string {
  if (product.warrantyText) return product.warrantyText;
  if (product.warrantyMonths) return `${Math.round(product.warrantyMonths / 12)} years`;
  return '—';
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const [products, categories] = await Promise.all([allProducts(), catalog().listCategories()]);
  // Subcategories in the admin panel's order, so a new one gets its own group.
  const GROUPS = categories.flatMap((category) =>
    category.subcategories.map((sub) => ({ slug: sub.slug, name: sub.name })),
  );
  const selected = GROUPS.find((group) => group.slug === type)?.slug;

  const groups = GROUPS.map((group) => ({
    ...group,
    products: products
      .filter((product) => product.subcategory === group.slug)
      .sort((a, b) => (a.facets.batteryAh ?? 0) - (b.facets.batteryAh ?? 0) || a.title.localeCompare(b.title)),
  })).filter((group) => group.products.length > 0 && (!selected || group.slug === selected));

  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className="container py-6 sm:py-8">
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Check price' }]} />
          <h1 className="heading-1 mt-3">Check price</h1>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground sm:text-base">
            Every battery and charger we sell, with today’s price, in one place. Prices include GST.
            WELCOME coupons and the ₹200 UPI discount are applied at checkout.
          </p>
          <nav aria-label="Filter by type" className="mt-5 flex flex-wrap gap-2">
            {[{ slug: undefined, name: 'All' }, ...GROUPS].map((group) => (
              <Link
                key={group.slug ?? 'all'}
                href={group.slug ? `/pricing?type=${group.slug}` : '/pricing'}
                className={cn(
                  'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                  group.slug === selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card hover:border-primary/40',
                )}
              >
                {group.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="container space-y-10 py-8 lg:py-10">
        {groups.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-6 text-sm text-muted-foreground">
            Nothing listed in this range yet.
          </p>
        ) : null}

        {groups.map((group) => (
          <section key={group.slug} aria-labelledby={`group-${group.slug}`}>
            <h2 id={`group-${group.slug}`} className="heading-3">
              {group.name}
            </h2>
            {/* `relative` keeps the table's screen-reader-only labels inside
                the scroll box; without it they widen the whole page on a phone. */}
            <div className="relative mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="bg-surface text-left">
                    <th scope="col" className="px-4 py-3 font-semibold">Product</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Capacity</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Voltage</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Warranty</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Price</th>
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">Add to cart</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.products.map((product) => {
                    const summary = toProductSummary(product);
                    const kwh = energyKwh(product);
                    return (
                      <tr key={product.id} className="border-t border-border align-middle">
                        <td className="px-4 py-3">
                          <Link href={productPath(product.slug)} className="font-medium text-primary hover:underline">
                            {product.title}
                          </Link>
                          {product.model ? (
                            <span className="block text-xs text-muted-foreground">{product.model}</span>
                          ) : null}
                        </td>
                        <td className="tabular px-4 py-3 text-right">
                          {product.facets.batteryAh ? `${product.facets.batteryAh} Ah` : '—'}
                          {kwh ? <span className="block text-xs text-muted-foreground">{kwh}</span> : null}
                        </td>
                        <td className="tabular px-4 py-3 text-right">
                          {product.facets.voltage ? `${product.facets.voltage} V` : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{warranty(product)}</td>
                        <td className="tabular px-4 py-3 text-right">
                          <span className="font-semibold text-foreground">{formatPrice(summary.price)}</span>
                          {summary.mrp > summary.price ? (
                            <span className="block text-xs text-muted-foreground line-through">
                              {formatPrice(summary.mrp)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {summary.availability === 'out-of-stock' ? (
                            <span className="text-xs font-medium text-destructive">Out of stock</span>
                          ) : (
                            <PriceListAdd product={summary} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
