import { Suspense } from 'react';
import Link from 'next/link';
import { catalog } from '@/lib/commerce';
import type { Category, CategorySlug, Subcategory } from '@/lib/commerce/types';
import { activeFilterCount, parseProductQuery, type SearchParamsInput } from '@/lib/catalog/query';
import { DEMO_PRODUCT } from '@/lib/commerce/demo/demo-product';
import { SITE } from '@/lib/site';
import { BreadcrumbJsonLd, Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Listing } from '@/components/catalog/listing';
import { ProductGridSkeleton, Skeleton } from '@/components/ui/skeleton';
import { SupportNudge } from '@/components/ui/states';
import { CategoryIcon } from '@/components/layout/category-icon';
import { cn } from '@/lib/utils';
import { categoryPath, subcategoryPath } from '@/lib/routes';

/**
 * Shared category / subcategory body.
 *
 * The two routes that render it — `/[category]` and `/[category]/[sub]` —
 * are separate plain dynamic segments rather than one optional catch-all,
 * because `dynamicParams: false` is only honoured at the routing layer for
 * plain segments. With a catch-all, an unknown category rendered `notFound()`
 * with HTTP 200: a soft 404 that search engines index.
 */
export async function CategoryView({
  category,
  subcategory,
  searchParams,
  allCategories,
}: {
  category: Category;
  subcategory: Subcategory | null;
  searchParams: SearchParamsInput;
  allCategories: Category[];
}) {
  const basePath = subcategory
    ? subcategoryPath(category.slug, subcategory.slug)
    : categoryPath(category.slug);

  const query = parseProductQuery(searchParams, {
    category: category.slug as CategorySlug,
    subcategory: subcategory?.slug,
  });

  const crumbs = [
    { label: 'Home', href: '/' },
    { label: category.name, href: categoryPath(category.slug) },
    ...(subcategory ? [{ label: subcategory.name, href: basePath }] : []),
  ];

  const heading = subcategory ? subcategory.name : category.name;
  const intro = subcategory ? subcategory.description : category.description;
  const seoCopy = subcategory ? subcategory.seoCopy : category.seoCopy;

  return (
    <>
      <BreadcrumbJsonLd items={crumbs} baseUrl={SITE.url} />

      {/* Category header */}
      <div className="border-b border-border bg-surface">
        <div className="container py-5 sm:py-7">
          <Breadcrumbs items={crumbs} />

          <div className="mt-4 flex items-start gap-4">
            <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-lg bg-card text-primary shadow-card sm:grid">
              <CategoryIcon kind={category.icon} className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="eyebrow">{subcategory ? category.name : 'Category'}</p>
              <h1 className="heading-1 mt-1 text-balance">{heading}</h1>
              <p className="mt-3 max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                {intro}
              </p>
            </div>
          </div>

          {/* Subcategory navigation — always shows siblings, current one highlighted. */}
          <nav aria-label="Subcategories" className="mt-6">
            <ul className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <li className="shrink-0">
                <Link
                  href={categoryPath(category.slug)}
                  className={cn(
                    'inline-block rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                    !subcategory
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-foreground hover:border-accent/50 hover:text-accent-600',
                  )}
                >
                  All {category.shortName.toLowerCase()}
                </Link>
              </li>
              {category.subcategories.map((sub) => {
                const active = subcategory?.slug === sub.slug;
                return (
                  <li key={sub.slug} className="shrink-0">
                    <Link
                      href={subcategoryPath(category.slug, sub.slug)}
                      className={cn(
                        'inline-block rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-foreground hover:border-accent/50 hover:text-accent-600',
                      )}
                    >
                      {sub.name.replace(/ (Inverters|Batteries|UPS|Combos|Combo)$/, '')}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>

      <div className="container py-8 lg:py-10">
        <Suspense key={`${basePath}?${JSON.stringify(searchParams)}`} fallback={<ListingSkeleton />}>
          <CategoryListing query={query} basePath={basePath} />
        </Suspense>
      </div>

      {/* Editorial / SEO copy — genuinely useful buying guidance, not keyword filler. */}
      <section className="border-t border-border bg-surface">
        <div className="container py-10 lg:py-14">
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <h2 className="heading-3">About {heading.toLowerCase()}</h2>
              <div className="rich-text mt-4 max-w-3xl">
                {seoCopy.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </div>
            <div className="lg:col-span-4">
              <SupportNudge className="flex-col items-stretch sm:flex-col sm:items-stretch" />
              {!subcategory ? (
                <nav aria-label="Other categories" className="mt-4">
                  <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
                    Also in the range
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {allCategories
                      .filter((c) => c.slug !== category.slug)
                      .map((other) => (
                        <li key={other.slug}>
                          <Link
                            href={categoryPath(other.slug)}
                            className="flex items-center gap-2.5 rounded-md border border-border bg-card p-3 text-sm font-medium text-foreground transition-colors hover:border-accent/40 hover:text-accent-600"
                          >
                            <CategoryIcon kind={other.icon} className="h-4.5 w-4.5 text-primary" />
                            {other.name}
                          </Link>
                        </li>
                      ))}
                  </ul>
                </nav>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * Should the demo battery be shown at the head of this listing?
 *
 * Only on the unrefined first page of the batteries category, and only while
 * that listing has nothing real in it.
 *
 * Two separate constraints, for two separate reasons. The demo product never
 * passes through `CatalogEngine`, so it cannot honour a facet filter, a price
 * range, a sort or a search term — showing it under any of those would put a
 * product in a result set it was never matched against. And it exists to
 * demonstrate a design on an empty shop; once the catalogue has real batteries
 * in it, a fixture sitting above them is no longer a demonstration, it is a
 * product nobody can buy at the top of a page of products they can.
 *
 * Its own page at `/products/itarang-lifepower-150ah-12v` is unaffected and stays the
 * reference for the layout.
 */
function showsDemoProduct(
  query: ReturnType<typeof parseProductQuery>,
  realResultCount: number,
): boolean {
  return (
    realResultCount === 0 &&
    query.category === 'batteries' &&
    query.subcategory === undefined &&
    query.page === 1 &&
    query.search === undefined &&
    query.minRating === undefined &&
    activeFilterCount(query) === 0
  );
}

async function CategoryListing({
  query,
  basePath,
}: {
  query: ReturnType<typeof parseProductQuery>;
  basePath: string;
}) {
  const result = await catalog().listProducts(query);

  // The demo product is injected here, after the provider has answered, and is
  // never passed back into the commerce layer. See the warning in
  // `lib/commerce/demo/demo-product.ts` for why it must stay out of `catalog()`.
  const listed = showsDemoProduct(query, result.total)
    ? { ...result, items: [DEMO_PRODUCT, ...result.items], total: result.total + 1 }
    : result;

  return <Listing result={listed} query={query} basePath={basePath} />;
}

function ListingSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] xl:gap-10">
      <Skeleton className="hidden h-[32rem] w-full lg:block" />
      <div>
        <div className="flex items-center justify-between border-b border-border pb-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-11 w-44" />
        </div>
        <div className="pt-8">
          <ProductGridSkeleton count={9} />
        </div>
      </div>
    </div>
  );
}

/** Shared metadata builder for both category routes. */
export function categoryMetadata(category: Category, subcategory: Subcategory | null) {
  const title = subcategory ? subcategory.name : `${category.name} — ${category.tagline}`;
  const description = subcategory ? subcategory.description : category.description;
  const path = subcategory
    ? subcategoryPath(category.slug, subcategory.slug)
    : categoryPath(category.slug);

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: `${title} | ${SITE.name}`, description, url: path },
  };
}
