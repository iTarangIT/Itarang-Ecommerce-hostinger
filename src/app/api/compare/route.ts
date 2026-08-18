import { NextResponse } from 'next/server';
import { catalog } from '@/lib/commerce';
import { discountPercent, displayPrice, productAvailability } from '@/lib/catalog/pricing';
import type { Product } from '@/lib/commerce/types';

/** Flattened comparison row for one product. */
export interface CompareEntry {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  image: string;
  categoryLabel: string;
  price: number;
  mrp: number;
  discount: number;
  rating: { average: number; count: number } | null;
  availability: string;
  /** Absent when the catalogue states no warranty for this product. */
  warrantyMonths?: number;
  installationIncluded: boolean;
  /** Every spec on the product, flattened to label → value. */
  specs: Record<string, string>;
}

function flattenSpecs(product: Product): Record<string, string> {
  const out: Record<string, string> = {};
  for (const group of product.specGroups) {
    for (const spec of group.specs) out[spec.label || spec.value] = spec.value;
  }
  return out;
}

const CATEGORY_LABELS: Record<string, string> = {
  inverters: 'Inverter',
  batteries: 'Battery',
  ups: 'UPS',
  combos: 'Combo',
};

export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get('ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);

  const products = await catalog().getProductsByIds(ids);

  const entries: CompareEntry[] = products.map((product) => {
    const price = displayPrice(product);
    return {
      id: product.id,
      slug: product.slug,
      title: product.title,
      subtitle: product.subtitle,
      image: product.images[0] ?? '',
      categoryLabel: CATEGORY_LABELS[product.category] ?? product.category,
      price: price.selling,
      mrp: price.mrp,
      discount: discountPercent(price),
      rating: product.rating
        ? { average: product.rating.average, count: product.rating.count }
        : null,
      availability: productAvailability(product),
      warrantyMonths: product.warrantyMonths,
      installationIncluded: product.installationIncluded,
      specs: flattenSpecs(product),
    };
  });

  return NextResponse.json({ entries });
}
