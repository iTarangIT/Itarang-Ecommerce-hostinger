/**
 * Public storefront URLs, built in one place.
 *
 * Before this file the shape of a category and a product URL was written out
 * by hand in about forty places — navigation, breadcrumbs, cards, the cart, the
 * compare tray, search suggestions, the sitemap, the canonical tags. Renaming a
 * prefix meant finding all forty and hoping. Every storefront link now comes
 * from here, so the next rename is this file and the two route folders.
 *
 * The slug is never touched: `productPath` takes the product's own slug from
 * the catalogue and prefixes it. Nothing here generates, normalises or
 * rewrites a slug.
 *
 * **Only public storefront routes belong here.** `/admin`, `/api`, checkout,
 * account and auth paths are written where they are used; they are not part of
 * the customer-facing URL scheme and are deliberately out of scope.
 */

/** `/batteries` — a top-level category listing. */
export function categoryPath(categorySlug: string): string {
  return `/${categorySlug}`;
}

/** `/batteries/lithium` — a subcategory listing. */
export function subcategoryPath(categorySlug: string, subSlug: string): string {
  return `/${categorySlug}/${subSlug}`;
}

/** `/products/trontek-powercube-1-4-tk12100` — a product detail page. */
export function productPath(productSlug: string): string {
  return `${PRODUCT_PREFIX}/${productSlug}`;
}

/**
 * The product route's static first segment.
 *
 * Exported because one component needs to recognise a product page from
 * `usePathname()` rather than build a link to one.
 */
export const PRODUCT_PREFIX = '/products';

/**
 * The prefixes these routes used to carry.
 *
 * Kept only so the permanent redirects in `next.config.mjs` and the tests that
 * cover them have a name for what they are preserving. Nothing builds a link
 * from these.
 */
export const LEGACY_CATEGORY_PREFIX = '/c';
export const LEGACY_PRODUCT_PREFIX = '/p';
