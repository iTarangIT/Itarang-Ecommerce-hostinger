import type { Metadata } from 'next';
import Link from 'next/link';
import { catalog } from '@/lib/commerce';
import { parseProductQuery, type SearchParamsInput } from '@/lib/catalog/query';
import { CATEGORIES } from '@/lib/commerce/mock/categories';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Listing } from '@/components/catalog/listing';
import { SearchAgainField } from '@/components/catalog/search-again-field';

export const metadata: Metadata = {
  title: 'Search',
  description:
    'Search the full iTarang range of inverters, batteries, UPS systems and inverter + battery combos.',
  robots: { index: false, follow: true },
};

const POPULAR_SEARCHES = [
  '900VA inverter',
  '1100VA inverter',
  'lithium battery',
  '150Ah tubular',
  'inverter battery combo',
  'solar ready inverter',
  'UPS for desktop',
  'digital UPS',
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const resolved = await searchParams;
  const query = parseProductQuery(resolved);
  const result = await catalog().listProducts(query);
  const term = query.search ?? '';

  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className="container py-5 sm:py-7">
          <Breadcrumbs
            items={[{ label: 'Home', href: '/' }, { label: term ? `Search: ${term}` : 'Search' }]}
          />
          <h1 className="heading-1 mt-3 text-balance">
            {term ? (
              <>
                <span className="tabular">{result.total}</span>{' '}
                {result.total === 1 ? 'result' : 'results'} for “{term}”
              </>
            ) : (
              'Search the iTarang range'
            )}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Search by capacity, chemistry, model name or SKU — for example{' '}
            <strong>900VA</strong>, <strong>LiFePO4</strong> or <strong>ITG-INV-900</strong>.
          </p>

          <div className="mt-5 max-w-xl">
            <SearchAgainField defaultValue={term} />
          </div>
        </div>
      </div>

      {term ? (
        <div className="container py-8 lg:py-10">
          <Listing result={result} query={query} basePath="/search" emptyVariant="search" />
        </div>
      ) : (
        <div className="container py-10 lg:py-14">
          <section>
            <h2 className="heading-3">Popular searches</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {POPULAR_SEARCHES.map((s) => (
                <li key={s}>
                  <Link
                    href={`/search?q=${encodeURIComponent(s)}`}
                    className="inline-block rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent/50 hover:text-accent-600"
                  >
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="heading-3">Or browse by category</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {CATEGORIES.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/c/${category.slug}`}
                    className="flex h-full flex-col rounded-lg border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-raised"
                  >
                    <span className="font-display text-base font-bold text-foreground">
                      {category.name}
                    </span>
                    <span className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {category.tagline}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
