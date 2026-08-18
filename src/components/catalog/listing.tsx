import Link from 'next/link';
import { ChevronLeft, ChevronRight, PackageSearch, SearchX } from 'lucide-react';
import type { ProductListResult, ProductQuery } from '@/lib/commerce/types';
import { toProductSummary } from '@/lib/commerce/summary';
import { buildQueryString } from '@/lib/catalog/query';
import { SORT_OPTIONS } from '@/lib/catalog/sort';
import { ProductCard } from '@/components/product/product-card';
import { ButtonLink } from '@/components/ui/button';
import { StateBlock, SupportNudge } from '@/components/ui/states';
import {
  ActiveFilterChips,
  FacetSidebar,
  MobileFilterButton,
  SortSelect,
} from './facet-controls';
import { cn } from '@/lib/utils';

function pageHref(basePath: string, query: ProductQuery, page: number): string {
  const qs = buildQueryString(query, { page });
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Compact page list: first, last, current and its neighbours, with gaps. */
function pageNumbers(current: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | 'gap'> = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) out.push('gap');
    out.push(page);
    previous = page;
  }
  return out;
}

export function Pagination({
  result,
  query,
  basePath,
}: {
  result: ProductListResult;
  query: ProductQuery;
  basePath: string;
}) {
  if (result.totalPages <= 1) return null;

  const { page, totalPages } = result;
  const first = (page - 1) * result.perPage + 1;
  const last = Math.min(result.total, page * result.perPage);

  const link =
    'grid h-10 min-w-10 place-items-center rounded-md border border-border bg-card px-3 text-sm font-medium transition-colors hover:border-primary/30 hover:bg-secondary';

  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-col items-center gap-4">
      {page < totalPages ? (
        <ButtonLink
          href={pageHref(basePath, query, page + 1)}
          variant="outline"
          size="lg"
          className="w-full sm:w-auto sm:px-10"
        >
          Show the next {Math.min(result.perPage, result.total - page * result.perPage)} products
          <ChevronRight className="h-4 w-4" />
        </ButtonLink>
      ) : null}

      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link
            href={pageHref(basePath, query, page - 1)}
            className={link}
            rel="prev"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : null}

        {pageNumbers(page, totalPages).map((entry, index) =>
          entry === 'gap' ? (
            <span key={`gap-${index}`} className="px-1 text-muted-foreground">
              …
            </span>
          ) : (
            <Link
              key={entry}
              href={pageHref(basePath, query, entry)}
              aria-current={entry === page ? 'page' : undefined}
              className={cn(
                link,
                'tabular',
                entry === page && 'border-primary bg-primary text-primary-foreground hover:bg-primary',
              )}
            >
              {entry}
            </Link>
          ),
        )}

        {page < totalPages ? (
          <Link
            href={pageHref(basePath, query, page + 1)}
            className={link}
            rel="next"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>

      <p className="tabular text-sm text-muted-foreground">
        Showing {first}–{last} of {result.total} products
      </p>
    </nav>
  );
}

export function ProductGrid({ result }: { result: ProductListResult }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-4">
      {result.items.map((product) => (
        <ProductCard key={product.id} product={toProductSummary(product)} />
      ))}
    </div>
  );
}

/**
 * Shared product listing body.
 *
 * Category pages, subcategory pages and search results all render through this
 * so filtering, sorting, pagination and empty states behave identically.
 */
export function Listing({
  result,
  query,
  basePath,
  emptyVariant = 'filters',
}: {
  result: ProductListResult;
  query: ProductQuery;
  basePath: string;
  emptyVariant?: 'filters' | 'search';
}) {
  const hasResults = result.items.length > 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] xl:gap-10">
      <FacetSidebar facets={result.facets} query={query} basePath={basePath} />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          {/*
            On search the page heading already states the count and the term, so
            repeating it here would put the same number on screen twice in two
            different words. Category pages have no count in their heading, so
            this is where it belongs.
          */}
          {query.search ? (
            // Nothing to refine when nothing matched — the empty state below
            // explains the situation instead.
            result.total > 0 ? (
              <p className="text-sm text-muted-foreground">Refine these results</p>
            ) : (
              <span />
            )
          ) : (
            <p className="tabular text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{result.total}</span>{' '}
              {result.total === 1 ? 'product' : 'products'}
            </p>
          )}
          <div className="flex items-center gap-2">
            <MobileFilterButton
              facets={result.facets}
              query={query}
              basePath={basePath}
              total={result.total}
            />
            <SortSelect query={query} basePath={basePath} options={SORT_OPTIONS} />
          </div>
        </div>

        <div className="py-4">
          <ActiveFilterChips query={query} basePath={basePath} facets={result.facets} />
        </div>

        {hasResults ? (
          <>
            <ProductGrid result={result} />
            <Pagination result={result} query={query} basePath={basePath} />
          </>
        ) : emptyVariant === 'search' ? (
          <div className="space-y-6">
            <StateBlock
              icon={<SearchX className="h-6 w-6" />}
              title={`Nothing matched ${query.search ? `“${query.search}”` : 'those filters'}`}
              description={
                <>
                  Try a capacity like <strong>900VA</strong>, a chemistry like{' '}
                  <strong>lithium</strong>, or clear a filter or two. If you would rather describe
                  the appliances you need to run, the load calculator will size a system for you.
                </>
              }
              actions={
                <>
                  <ButtonLink href="/tools/load-calculator" variant="accent">
                    Size my system
                  </ButtonLink>
                  <ButtonLink href={basePath} variant="outline">
                    Clear all filters
                  </ButtonLink>
                </>
              }
            />
            <SupportNudge />
          </div>
        ) : (
          <StateBlock
            icon={<PackageSearch className="h-6 w-6" />}
            title="No products match these filters"
            description="Every product in this category is still here — the current combination of filters is just too narrow. Remove one and try again."
            actions={
              <>
                <ButtonLink href={basePath} variant="primary">
                  Clear all filters
                </ButtonLink>
                <ButtonLink href="/tools/load-calculator" variant="outline">
                  Help me choose
                </ButtonLink>
              </>
            }
          />
        )}
      </div>
    </div>
  );
}
