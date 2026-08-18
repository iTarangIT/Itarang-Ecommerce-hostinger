import type { BadgeKind, CategorySlug, Paise, Product } from './types';
import { discountPercent, displayPrice, displayVariant, productAvailability } from '@/lib/catalog/pricing';

/**
 * Card-sized projection of a product.
 *
 * Product cards appear in server-rendered grids and in client components (cart
 * cross-sell, compare tray, recently viewed). A flat, serialisable summary
 * keeps one card implementation working in both places and keeps the full
 * catalogue out of the client bundle.
 */
export interface ProductSummary {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  image: string;
  hoverImage?: string;
  category: CategorySlug;
  categoryLabel: string;
  badges: BadgeKind[];
  price: Paise;
  mrp: Paise;
  discount: number;
  availability: 'in-stock' | 'low-stock' | 'out-of-stock' | 'preorder';
  stock: number;
  rating: { average: number; count: number } | null;
  /** Only set when the product has buyer-facing options. */
  hasOptions: boolean;
  /** Default variant id, used for one-click add from a card. */
  defaultVariantId: string;
  keySpec: string | null;
  /** Absent when the catalogue states no warranty — cards then omit the line. */
  warrantyMonths?: number;
  installationIncluded: boolean;
}

const CATEGORY_LABELS: Record<CategorySlug, string> = {
  inverters: 'Inverter',
  batteries: 'Battery',
  ups: 'UPS',
  combos: 'Combo',
};

/** One-line spec shown under the title — the number buyers actually compare. */
function keySpecOf(product: Product): string | null {
  const { capacityVa, batteryAh, technology } = product.facets;
  const parts: string[] = [];
  if (capacityVa) parts.push(`${capacityVa.toLocaleString('en-IN')} VA`);
  if (batteryAh) parts.push(`${batteryAh} Ah`);
  if (technology && parts.length < 2) parts.push(technology);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function toProductSummary(product: Product): ProductSummary {
  const price = displayPrice(product);
  const variant = displayVariant(product);
  const availability = productAvailability(product);

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    subtitle: product.subtitle,
    image: product.images[0] ?? '',
    hoverImage: product.images[1],
    category: product.category,
    categoryLabel: CATEGORY_LABELS[product.category],
    badges: availability === 'out-of-stock' ? ['sold-out'] : product.badges,
    price: price.selling,
    mrp: price.mrp,
    discount: discountPercent(price),
    availability,
    stock: variant?.stock ?? 0,
    rating: product.rating ? { average: product.rating.average, count: product.rating.count } : null,
    hasOptions: product.options.length > 0,
    defaultVariantId: variant?.id ?? product.variants[0]?.id ?? '',
    keySpec: keySpecOf(product),
    warrantyMonths: product.warrantyMonths,
    installationIncluded: product.installationIncluded,
  };
}
