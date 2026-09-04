import type { CategorySlug } from '@/lib/commerce/types';

/**
 * Category and subcategory display names, and nothing else.
 *
 * This exists to keep editorial prose out of the browser. `facets.ts` needs
 * only slug → name, but it used to reach for `CATEGORY_BY_SLUG`, and
 * `facet-controls.tsx` is a client component — so every catalogue page shipped
 * the whole `CATEGORIES` array, including all seventeen `seoCopy` passages, to
 * resolve a couple of labels.
 *
 * Deriving these from `CATEGORIES` at module scope would import it again and
 * defeat the point, so the names are written out. That duplication is real, and
 * `category-names.test.ts` is what keeps it honest: it imports the full
 * taxonomy — server-side, where the cost does not matter — and fails if a name
 * here ever drifts from the source, or if a category or subcategory is added
 * without a name.
 */

export const CATEGORY_NAMES: Record<CategorySlug, string> = {
  inverters: 'Inverters',
  batteries: 'Batteries',
  ups: 'UPS Systems',
  combos: 'Inverter + Battery Combos',
};

export const SUBCATEGORY_NAMES: Record<string, string> = {
  'pure-sine-wave': 'Pure Sine Wave Inverters',
  'digital-ups': 'Digital UPS (DUPS)',
  'solar-ready': 'Solar-Ready Inverters',
  'high-capacity': 'High-Capacity Inverters',
  lithium: 'Lithium (LiFePO4) Batteries',
  'tall-tubular': 'Tall Tubular Batteries',
  'short-tubular': 'Short Tubular Batteries',
  'flat-plate-smf': 'Flat Plate & SMF Batteries',
  'ev-2-wheeler': '2-Wheeler EV Batteries',
  'ev-3-wheeler': '3-Wheeler & E-Rickshaw Batteries',
  'home-ups': 'Home & Office UPS',
  'online-ups': 'Online (Double Conversion) UPS',
  'home-combos': 'Home Combos',
  'shop-office-combos': 'Shop & Office Combos',
  'solar-combos': 'Solar Combos',
};

export function categoryName(slug: string): string {
  return CATEGORY_NAMES[slug as CategorySlug] ?? slug;
}

export function subcategoryName(slug: string): string {
  return SUBCATEGORY_NAMES[slug] ?? slug;
}
