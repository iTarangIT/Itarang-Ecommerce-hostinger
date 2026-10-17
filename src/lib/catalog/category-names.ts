import type { CategorySlug } from '@/lib/commerce/types';

/**
 * Category and subcategory display names, and nothing else.
 *
 * This exists to keep editorial prose out of the browser. `facets.ts` needs
 * only slug → name, but it used to reach for `CATEGORY_BY_SLUG`, and
 * `facet-controls.tsx` is a client component — so every catalogue page shipped
 * the whole `CATEGORIES` array, including all of its `seoCopy` passages, to
 * resolve a couple of labels.
 *
 * Deriving these from `CATEGORIES` at module scope would import it again and
 * defeat the point, so the names are written out. That duplication is real, and
 * `category-names.test.ts` is what keeps it honest: it imports the full
 * taxonomy — server-side, where the cost does not matter — and fails if a name
 * here ever drifts from the source, or if a category or subcategory is added
 * without a name.
 */

/**
 * `Partial` because `CategorySlug` is wider than the live taxonomy.
 *
 * The union still admits `inverters`, `ups` and `combos` so the development
 * fixture in `mock/products.ts` typechecks, but none of the three is a
 * customer-facing category any more (see `mock/categories.ts`). A total
 * `Record` would force us to name three sections that no longer exist, and the
 * parity test would then have to be loosened to tolerate them — which is
 * exactly the drift this file exists to prevent. `categoryName` falls back to
 * the slug, so nothing renders blank either way.
 */
export const CATEGORY_NAMES: Partial<Record<CategorySlug, string>> = {
  batteries: 'Batteries',
  chargers: 'Chargers',
};

export const SUBCATEGORY_NAMES: Record<string, string> = {
  'ev-3-wheeler': '3-Wheeler & E-Rickshaw Batteries',
  'ev-2-wheeler': '2-Wheeler EV Batteries',
  'home-inverter': 'Home Inverter Batteries',
  ess: 'ESS — Energy Storage Systems',
  'ev-chargers': 'EV Battery Chargers',
};

export function categoryName(slug: string): string {
  return CATEGORY_NAMES[slug as CategorySlug] ?? slug;
}

export function subcategoryName(slug: string): string {
  return SUBCATEGORY_NAMES[slug] ?? slug;
}
