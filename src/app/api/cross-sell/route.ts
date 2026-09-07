import { NextResponse } from 'next/server';
import { allProducts } from '@/lib/catalog/collections';
import { toProductSummary } from '@/lib/commerce/summary';
import { productAvailability } from '@/lib/catalog/pricing';
import type { CategorySlug } from '@/lib/commerce/types';

/**
 * Cross-sell recommendations for the cart drawer.
 *
 * Simple complementary-category logic: a cart with an inverter should be
 * offered batteries, and vice versa. Replace with real "bought together" data
 * once order history exists.
 */
const COMPLEMENTS: Record<CategorySlug, CategorySlug[]> = {
  inverters: ['batteries'],
  batteries: ['batteries'],
  ups: ['batteries'],
  combos: ['batteries'],
};

/**
 * What to offer when the cart tells us nothing useful.
 *
 * This used to be `combos`, which is no longer a category anyone can browse —
 * so an empty or unrecognised cart asked for a family with no products and got
 * an empty rail. Batteries is the only live family, which also makes every
 * entry in `COMPLEMENTS` above point at it: kept as a map rather than collapsed
 * to a constant because the complementary-category idea comes straight back the
 * day inverters are stocked, and the shape is the documentation for it.
 */
const FALLBACK_CATEGORY: CategorySlug = 'batteries';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const categories = (params.get('categories') ?? '').split(',').filter(Boolean) as CategorySlug[];
  const exclude = new Set((params.get('exclude') ?? '').split(',').filter(Boolean));

  const wanted = new Set<CategorySlug>();
  for (const category of categories) {
    for (const complement of COMPLEMENTS[category] ?? []) wanted.add(complement);
  }
  if (wanted.size === 0) wanted.add(FALLBACK_CATEGORY);

  const catalogue = await allProducts();

  // `productAvailability` rather than `variants.some(v => v.stock > 0)`: the
  // raw comparison reads a count this route has no business reading, and it
  // also answers the wrong question for an untracked variant, where `stock`
  // is the sentinel 99 from `to-domain.ts` and not a quantity anybody stated.
  const products = catalogue
    .filter(
      (p) =>
        wanted.has(p.category) &&
        !exclude.has(p.id) &&
        productAvailability(p) !== 'out-of-stock',
    )
    .sort((a, b) => a.popularityRank - b.popularityRank)
    .slice(0, 4)
    .map(toProductSummary);

  return NextResponse.json({ products });
}
