import type { Metadata } from 'next';
import { catalog } from '@/lib/commerce';
import { parseProductQuery, type SearchParamsInput } from '@/lib/catalog/query';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Listing } from '@/components/catalog/listing';

export const metadata: Metadata = {
  title: 'All products',
  description:
    'Every iTarang product in one place — lithium batteries for home backup, 2-wheeler and 3-wheeler EVs, energy storage and chargers.',
};

/**
 * The whole catalogue on one page.
 *
 * Nothing here is curated: it lists whatever the catalogue serves, so a
 * product an administrator publishes appears on its own, and one they archive
 * disappears, without anyone editing this page.
 */
export default async function AllProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const query = parseProductQuery(await searchParams);
  const result = await catalog().listProducts(query);

  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className="container py-5 sm:py-7">
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'All products' }]} />
          <h1 className="heading-1 mt-3">All products</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            <span className="tabular">{result.total}</span>{' '}
            {result.total === 1 ? 'product' : 'products'} across the iTarang range. Filter by
            category, capacity or price, or open any product for its full details.
          </p>
        </div>
      </div>

      <div className="container py-8 lg:py-10">
        <Listing result={result} query={query} basePath="/products" />
      </div>
    </>
  );
}
