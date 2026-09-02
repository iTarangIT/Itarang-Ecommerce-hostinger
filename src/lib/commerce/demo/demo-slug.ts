/* ===========================================================================
 * TEMPORARY DEMO PRODUCT — identity only
 * ===========================================================================
 *
 * Deliberately holds no data, only the slug that identifies the demo product.
 *
 * `summary.ts` runs on every product card in the application, so it must not
 * import the demo module itself — that would risk pulling the whole demo
 * fixture into the client bundle for every listing page. Importing this
 * two-line module instead keeps the demo data on the pages that actually
 * render it.
 *
 * Delete alongside `demo-product.ts`.
 * ------------------------------------------------------------------------ */

export const DEMO_PRODUCT_SLUG = 'itarang-lifepower-150ah-12v';

/** Is this slug the demo product rather than a real catalogue product? */
export function isDemoSlug(slug: string): boolean {
  return slug === DEMO_PRODUCT_SLUG;
}
