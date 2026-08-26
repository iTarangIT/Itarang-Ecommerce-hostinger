import { cache } from 'react';
import { catalog } from '@/lib/commerce';
import { REVIEWS } from '@/lib/commerce/mock/reviews';
import { toProductSummary, type ProductSummary } from '@/lib/commerce/summary';
import type { CategorySlug, Product, ProductQuery, Review } from '@/lib/commerce/types';
import { discountPercent, displayPrice } from './pricing';

/**
 * Curated collections used by merchandising surfaces.
 *
 * These are editorial selections rather than shopper queries, but they must
 * still read through the active provider — otherwise switching to the live
 * Hostinger catalogue would leave the homepage rails serving development data.
 */

/** One page big enough to hold the whole catalogue. */
const EVERYTHING: ProductQuery = {
  filters: {},
  sort: 'featured',
  page: 1,
  perPage: 1000,
};

/**
 * The whole catalogue, memoised per request.
 *
 * `cache()` matters more here than it looks. One homepage render called this
 * five times — the layout's navigation, the page's navigation, `bestSellers`,
 * `newArrivals` and `productTitleMap` — and every call ran the full
 * `CatalogEngine.list` pass, including `buildFacetGroups` across all eight
 * facets, whose output every one of those callers then discarded.
 *
 * Request-scoped, exactly like `currentUser()` in `lib/auth/session.ts`: two
 * requests never share a result, so a revalidated catalogue is still picked up
 * on the next render.
 */
export const allProducts = cache(async (): Promise<Product[]> => {
  const result = await catalog().listProducts(EVERYTHING);
  return result.items;
});

export async function bestSellers(limit = 8): Promise<ProductSummary[]> {
  const products = await allProducts();
  return [...products]
    .sort((a, b) => a.popularityRank - b.popularityRank)
    .slice(0, limit)
    .map(toProductSummary);
}

export async function newArrivals(limit = 8): Promise<ProductSummary[]> {
  const products = await allProducts();
  return [...products]
    .sort((a, b) => b.launchedAt.localeCompare(a.launchedAt))
    .slice(0, limit)
    .map(toProductSummary);
}

export async function biggestDiscounts(limit = 8): Promise<ProductSummary[]> {
  const products = await allProducts();
  return [...products]
    .filter((p) => discountPercent(displayPrice(p)) > 0)
    .sort((a, b) => discountPercent(displayPrice(b)) - discountPercent(displayPrice(a)))
    .slice(0, limit)
    .map(toProductSummary);
}

export async function byCategory(
  category: CategorySlug,
  limit = 8,
): Promise<ProductSummary[]> {
  const result = await catalog().listProducts({ ...EVERYTHING, category, perPage: limit });
  return result.items.map(toProductSummary);
}

export async function productsByIds(ids: string[]): Promise<ProductSummary[]> {
  const products = await catalog().getProductsByIds(ids);
  return products.map(toProductSummary);
}

export async function productsBySlugs(slugs: string[]): Promise<ProductSummary[]> {
  const provider = catalog();
  const products = await Promise.all(slugs.map((slug) => provider.getProduct(slug)));
  return products.filter((p): p is Product => Boolean(p)).map(toProductSummary);
}

/**
 * Highest-signal reviews for the homepage.
 *
 * The Hostinger store reports `product_reviews.is_enabled: false`, so there are
 * no real reviews to show when it is the active provider. Returning the
 * development fixtures there would attach invented testimonials to live
 * products, so this returns nothing instead and the section renders empty.
 */
export async function featuredReviews(limit = 6): Promise<Review[]> {
  if (catalog().name !== 'mock') return [];
  return [...REVIEWS]
    .filter((r) => r.rating >= 4 && r.body.length > 90)
    .sort((a, b) => b.helpfulCount - a.helpfulCount)
    .slice(0, limit);
}

export async function productTitleMap(): Promise<Record<string, string>> {
  const products = await allProducts();
  return Object.fromEntries(products.map((p) => [p.id, p.title]));
}
