import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import type {
  CatalogProvider,
  Category,
  FacetId,
  Offer,
  Product,
  ProductListResult,
  ProductQuery,
  Review,
  SearchSuggestion,
} from '../types';
import { CATEGORIES, CATEGORY_BY_SLUG } from '../mock/categories';
import { CatalogEngine, SEARCH_FACET_IDS, buildSuggestions } from '@/lib/catalog/engine';
import { productRepository } from '@/lib/products/postgres-repository';
import { toDomainProduct } from '@/lib/products/to-domain';

/**
 * The catalogue we own.
 *
 * Third implementation of `CatalogProvider`, and deliberately the least
 * interesting one: it reads published rows, projects them with
 * `toDomainProduct`, and hands the result to the same `CatalogEngine` the other
 * two providers use. Filtering, sorting, searching, facet counting and paging
 * are therefore identical across all three by construction rather than by
 * discipline.
 *
 * What differs from `HostingerCatalogProvider`, and why:
 *
 * - **No stale-snapshot fallback.** That exists upstream because a third-party
 *   HTTP call can blip and a storefront should not 500 over it. Our database is
 *   the same database the rest of the request already depends on; if it is
 *   down, serving a catalogue from memory would only hide the outage.
 *
 * - **Tag-based invalidation, not a timer.** Reads go through `unstable_cache`
 *   tagged `CATALOG_TAG`, and every admin write calls `revalidateTag` for it.
 *   That is what reaches a page Next has already rendered — including a fully
 *   static product page — and it works across processes, which an in-memory
 *   snapshot never could.
 *
 * - **No reviews and no offers.** There is no review capture and no signed
 *   offer terms. Both return empty rather than borrowing the development
 *   fixtures — a real product must not carry an invented rating or an
 *   unagreed discount.
 *
 * Categories stay local, as they do for both other providers: they are
 * editorial copy with SEO passages, not backend data.
 */

interface Snapshot {
  products: Product[];
  engine: CatalogEngine;
}

/**
 * The cache tag every catalogue read is filed under.
 *
 * This is the mechanism that makes an admin edit visible. A page that renders
 * catalogue data reads through `loadPublishedProducts` below, so Next records a
 * dependency from that page's cached HTML to this tag; `revalidateTag(CATALOG_TAG)`
 * in the admin write path then purges exactly those pages.
 *
 * Before this existed, the provider held a 30-second in-process snapshot and the
 * admin actions cleared it — which did nothing at all to a statically rendered
 * product page, because that page's HTML no longer depended on the variable that
 * was being cleared. Category pages recovered within the TTL and product pages
 * never did, so the grid and the page it linked to disagreed about the price.
 */
export const CATALOG_TAG = 'catalog';

function facetIdsForCategory(category: string): FacetId[] {
  return CATEGORY_BY_SLUG.get(category as never)?.facetIds ?? SEARCH_FACET_IDS;
}

/**
 * The published catalogue, cached across requests and invalidated by tag.
 *
 * Only the *data* is cached here, not the `CatalogEngine` built from it: this
 * value is serialised into Next's cache, and an engine holds a Map and closures
 * that would not survive the round trip.
 *
 * It also has to be the thing every render actually calls. An in-process
 * short-circuit in front of it would mean a page could render without ever
 * touching the cached function, and Next would then never associate that page
 * with the tag — the invalidation would silently stop working for exactly the
 * pages that were cheapest to serve.
 */
const loadPublishedProducts = unstable_cache(
  async (): Promise<Product[]> => {
    const records = await productRepository().listPublished();
    return records.map(toDomainProduct);
  },
  ['db-catalogue', 'published'],
  { tags: [CATALOG_TAG] },
);

/**
 * One snapshot per request.
 *
 * React's `cache()` dedupes within a single render pass, so a page that calls
 * `getProduct` and `listProducts` and `suggest` builds the engine once rather
 * than three times. Across requests, `loadPublishedProducts` is the cache and
 * this is just the engine construction on top of it.
 */
const requestSnapshot = cache(async (): Promise<Snapshot> => {
  const products = await loadPublishedProducts();
  return { products, engine: new CatalogEngine(products, facetIdsForCategory) };
});

export class DbCatalogProvider implements CatalogProvider {
  readonly name = 'db';

  private async load(): Promise<Snapshot> {
    return requestSnapshot();
  }

  async listCategories(): Promise<Category[]> {
    return CATEGORIES;
  }

  async getCategory(slug: string): Promise<Category | null> {
    return CATEGORY_BY_SLUG.get(slug as never) ?? null;
  }

  async listProducts(query: ProductQuery): Promise<ProductListResult> {
    const { engine } = await this.load();
    return engine.list(query);
  }

  async getProduct(slug: string): Promise<Product | null> {
    const { products } = await this.load();
    return products.find((product) => product.slug === slug) ?? null;
  }

  async getProductsByIds(ids: string[]): Promise<Product[]> {
    const { products } = await this.load();
    const byId = new Map(products.map((product) => [product.id, product]));
    return ids.map((id) => byId.get(id)).filter((product): product is Product => Boolean(product));
  }

  /** No review capture exists. An empty list, never an invented one. */
  async getReviews(_productId: string): Promise<Review[]> {
    return [];
  }

  async suggest(term: string): Promise<SearchSuggestion[]> {
    const { engine } = await this.load();
    return buildSuggestions(term, engine.productSuggestions(term), CATEGORIES);
  }

  /**
   * No offers until real ones exist.
   *
   * The development fixtures in `mock/offers.ts` are illustrative bank, UPI and
   * EMI terms that nobody has signed. Returning them here would put an unagreed
   * discount on a real product page.
   */
  async listOffers(): Promise<Offer[]> {
    return [];
  }

  /**
   * Kept so the `CatalogProvider & { invalidate?() }` shape in
   * `commerce/index.ts` still resolves, and deliberately a no-op.
   *
   * There is no in-process snapshot to drop any more. Invalidation is
   * `revalidateTag(CATALOG_TAG)` from the admin write path, which is the only
   * thing that can reach a page Next has already rendered and cached. Leaving
   * a method here that cleared some local state would read as protection and
   * provide none — the exact failure this replaced.
   */
  invalidate(): void {}
}
