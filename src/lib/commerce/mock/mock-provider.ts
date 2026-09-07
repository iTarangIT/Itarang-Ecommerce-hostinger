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
import { CATEGORIES, CATEGORY_BY_SLUG } from './categories';
import { PRODUCTS, PRODUCT_BY_ID, PRODUCT_BY_SLUG } from './products';
import { REVIEWS_BY_PRODUCT } from './reviews';
import { OFFERS } from './offers';
import { CatalogEngine, SEARCH_FACET_IDS, buildSuggestions } from '@/lib/catalog/engine';

/**
 * Development catalogue provider.
 *
 * Query behaviour lives in `CatalogEngine` so this and the Hostinger provider
 * answer a shopper's query identically — they differ only in where the
 * `Product[]` comes from.
 */

function facetIdsForCategory(category: string): FacetId[] {
  return CATEGORY_BY_SLUG.get(category as never)?.facetIds ?? SEARCH_FACET_IDS;
}

/**
 * The fixture, narrowed to categories that still exist.
 *
 * `PRODUCTS` is a development fixture written when the taxonomy had four
 * families; it still contains inverters, UPS units and combos. Those are no
 * longer customer-facing categories (see `categories.ts`), so a product filed
 * under one has no category page to sit on, no breadcrumb that resolves and no
 * mega-menu entry — it would be reachable only by guessing its URL.
 *
 * Filtering here rather than deleting fixture rows keeps the development
 * catalogue intact for whenever those families come back, and means the mock
 * provider agrees with the database provider about what a shopper can browse.
 * Nothing in the live catalogue is affected: `COMMERCE_PROVIDER=db` never
 * reads this file.
 */
const LIVE_CATEGORIES = new Set(CATEGORIES.map((c) => c.slug));
const CATALOGUE = PRODUCTS.filter((product) => LIVE_CATEGORIES.has(product.category));

const engine = new CatalogEngine(CATALOGUE, facetIdsForCategory);

export class MockCatalogProvider implements CatalogProvider {
  readonly name = 'mock';

  async listCategories(): Promise<Category[]> {
    return CATEGORIES;
  }

  async getCategory(slug: string): Promise<Category | null> {
    return CATEGORY_BY_SLUG.get(slug as never) ?? null;
  }

  async listProducts(query: ProductQuery): Promise<ProductListResult> {
    return engine.list(query);
  }

  async getProduct(slug: string): Promise<Product | null> {
    return PRODUCT_BY_SLUG.get(slug) ?? null;
  }

  async getProductsByIds(ids: string[]): Promise<Product[]> {
    return ids.map((id) => PRODUCT_BY_ID.get(id)).filter((p): p is Product => Boolean(p));
  }

  async getReviews(productId: string): Promise<Review[]> {
    return REVIEWS_BY_PRODUCT[productId] ?? [];
  }

  async suggest(term: string): Promise<SearchSuggestion[]> {
    return buildSuggestions(term, engine.productSuggestions(term), CATEGORIES);
  }

  async listOffers(): Promise<Offer[]> {
    return OFFERS;
  }
}
