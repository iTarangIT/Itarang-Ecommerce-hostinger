import { NextResponse } from 'next/server';
import { allProducts } from '@/lib/catalog/collections';
import { toProductSummary } from '@/lib/commerce/summary';
import type { CategorySlug } from '@/lib/commerce/types';

/**
 * Cross-sell recommendations for the cart drawer.
 *
 * Simple complementary-category logic: a cart with an inverter should be
 * offered batteries, and vice versa. Replace with real "bought together" data
 * once order history exists.
 */
const COMPLEMENTS: Record<CategorySlug, CategorySlug[]> = {
  inverters: ['batteries', 'combos'],
  batteries: ['inverters', 'combos'],
  ups: ['batteries'],
  combos: ['batteries', 'ups'],
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const categories = (params.get('categories') ?? '').split(',').filter(Boolean) as CategorySlug[];
  const exclude = new Set((params.get('exclude') ?? '').split(',').filter(Boolean));

  const wanted = new Set<CategorySlug>();
  for (const category of categories) {
    for (const complement of COMPLEMENTS[category] ?? []) wanted.add(complement);
  }
  if (wanted.size === 0) wanted.add('combos');

  const catalogue = await allProducts();

  const products = catalogue
    .filter((p) => wanted.has(p.category) && !exclude.has(p.id) && p.variants.some((v) => v.stock > 0))
    .sort((a, b) => a.popularityRank - b.popularityRank)
    .slice(0, 4)
    .map(toProductSummary);

  return NextResponse.json({ products });
}
