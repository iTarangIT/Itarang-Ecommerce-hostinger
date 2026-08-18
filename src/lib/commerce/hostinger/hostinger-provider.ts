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
import { OFFERS } from '../mock/offers';
import { CatalogEngine, SEARCH_FACET_IDS, buildSuggestions } from '@/lib/catalog/engine';
import { env } from '@/lib/env';
import { fetchInventory, fetchProducts } from './client';
import { inventoryMap, mapProduct } from './map';
import { unmappedProductIds } from './enrichment';

/**
 * Live catalogue from the Hostinger Sales Channel API.
 *
 * READ-ONLY. Two GETs — the product list and variant inventory — are fetched
 * per revalidate window and mapped into domain products, after which every
 * query is answered by the shared `CatalogEngine`. That is what guarantees the
 * live site filters, sorts and searches identically to the reviewed
 * development site.
 *
 * Categories and offers stay local: they are editorial content, not backend
 * data, and Hostinger reports no collections for this store.
 */

interface Snapshot {
  products: Product[];
  engine: CatalogEngine;
  fetchedAt: number;
  unmapped: string[];
}

function facetIdsForCategory(category: string): FacetId[] {
  return CATEGORY_BY_SLUG.get(category as never)?.facetIds ?? SEARCH_FACET_IDS;
}

export class HostingerCatalogProvider implements CatalogProvider {
  readonly name = 'hostinger';

  private snapshot: Snapshot | null = null;
  private inFlight: Promise<Snapshot> | null = null;

  /**
   * Current catalogue, refetched when the cache window has elapsed.
   *
   * Concurrent callers share one in-flight request so a cold start does not
   * fan out into one upstream call per rendered page.
   */
  private async load(): Promise<Snapshot> {
    const ttlMs = env().HOSTINGER_CATALOG_REVALIDATE * 1000;
    if (this.snapshot && Date.now() - this.snapshot.fetchedAt < ttlMs) {
      return this.snapshot;
    }
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.refresh().finally(() => {
      this.inFlight = null;
    });

    return this.inFlight;
  }

  private async refresh(): Promise<Snapshot> {
    const { products: raw } = await fetchProducts(100, 0);

    // Stock lives on a separate endpoint; skip the call entirely when the
    // merchant stock-manages nothing.
    const managed = raw.filter((product) =>
      product.variants.some((variant) => variant.manage_inventory !== false),
    );
    const inventory = managed.length
      ? inventoryMap((await fetchInventory(managed.map((product) => product.id))).variants)
      : new Map<string, number>();

    const products = raw.map((product) => mapProduct(product, inventory));

    const snapshot: Snapshot = {
      products,
      engine: new CatalogEngine(products, facetIdsForCategory),
      fetchedAt: Date.now(),
      unmapped: unmappedProductIds(raw.map((product) => product.id)),
    };

    if (snapshot.unmapped.length > 0) {
      console.warn(
        `[hostinger] ${snapshot.unmapped.length} product(s) have no enrichment entry and were ` +
          `filed by title matching: ${snapshot.unmapped.join(', ')}`,
      );
    }

    this.snapshot = snapshot;
    return snapshot;
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

  /** The store reports `product_reviews.is_enabled: false`. */
  async getReviews(_productId: string): Promise<Review[]> {
    return [];
  }

  async suggest(term: string): Promise<SearchSuggestion[]> {
    const { engine } = await this.load();
    return buildSuggestions(term, engine.productSuggestions(term), CATEGORIES);
  }

  async listOffers(): Promise<Offer[]> {
    return OFFERS;
  }

  /** Snapshot metadata for the diagnostics route. */
  async inspect(): Promise<{ count: number; unmapped: string[]; fetchedAt: number; sample: Product | null }> {
    const snapshot = await this.load();
    return {
      count: snapshot.products.length,
      unmapped: snapshot.unmapped,
      fetchedAt: snapshot.fetchedAt,
      sample: snapshot.products[0] ?? null,
    };
  }
}
