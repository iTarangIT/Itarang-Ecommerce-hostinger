import { NextResponse } from 'next/server';
import { allProducts } from '@/lib/catalog/collections';
import { toProductSummary, type ProductSummary } from '@/lib/commerce/summary';
import { minSellingPrice } from '@/lib/catalog/pricing';
import type { Product } from '@/lib/commerce/types';

/**
 * Turns a sizing result into shoppable recommendations.
 *
 * For each family we pick the smallest product that clears the requirement —
 * over-specifying costs the shopper money and is not a better answer.
 */
export interface SizingRecommendation {
  combo: ProductSummary | null;
  inverter: ProductSummary | null;
  battery: ProductSummary | null;
  alternatives: ProductSummary[];
  /** True when nothing in the catalogue covers the requirement. */
  exceedsRange: boolean;
}

function smallestMatch(candidates: Product[]): Product | undefined {
  return [...candidates].sort((a, b) => minSellingPrice(a) - minSellingPrice(b))[0];
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const va = Number(params.get('va') ?? 0);
  const ah = Number(params.get('ah') ?? 0);

  const catalogue = await allProducts();
  const inStock = catalogue.filter((p) => p.variants.some((v) => v.stock > 0));

  const inverterMatches = inStock.filter(
    (p) => p.category === 'inverters' && (p.facets.capacityVa ?? 0) >= va,
  );
  const batteryMatches = inStock.filter(
    (p) => p.category === 'batteries' && (p.facets.batteryAh ?? 0) >= ah,
  );
  const comboMatches = inStock.filter(
    (p) =>
      p.category === 'combos' && (p.facets.capacityVa ?? 0) >= va && (p.facets.batteryAh ?? 0) >= ah,
  );

  const inverter = smallestMatch(inverterMatches);
  const battery = smallestMatch(batteryMatches);
  const combo = smallestMatch(comboMatches);

  // Next size up in each family, so the shopper can see the headroom option.
  const alternatives = [
    ...inverterMatches.filter((p) => p.id !== inverter?.id).slice(0, 2),
    ...batteryMatches.filter((p) => p.id !== battery?.id).slice(0, 2),
  ]
    .sort((a, b) => minSellingPrice(a) - minSellingPrice(b))
    .slice(0, 4);

  const recommendation: SizingRecommendation = {
    combo: combo ? toProductSummary(combo) : null,
    inverter: inverter ? toProductSummary(inverter) : null,
    battery: battery ? toProductSummary(battery) : null,
    alternatives: alternatives.map(toProductSummary),
    // With a single-SKU catalogue a combo alone is still a complete answer.
    exceedsRange: !combo && (!inverter || !battery),
  };

  return NextResponse.json(recommendation);
}
