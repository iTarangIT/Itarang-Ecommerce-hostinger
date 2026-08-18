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

const engine = new CatalogEngine(PRODUCTS, facetIdsForCategory);

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
