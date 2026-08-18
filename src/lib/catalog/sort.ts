import type { Product, SortId, SortOption } from '@/lib/commerce/types';
import { discountPercent, displayPrice, minSellingPrice } from './pricing';

export const SORT_OPTIONS: SortOption[] = [
  { id: 'featured', label: 'Featured' },
  { id: 'best-selling', label: 'Best selling' },
  { id: 'newest', label: 'Newest first' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
  { id: 'rating-desc', label: 'Highest rated' },
  { id: 'discount-desc', label: 'Biggest discount' },
  { id: 'name-asc', label: 'Name: A to Z' },
];

export const DEFAULT_SORT: SortId = 'featured';

export function isSortId(value: string): value is SortId {
  return SORT_OPTIONS.some((o) => o.id === value);
}

/** Featured ordering: badged products first, then popularity, then rating. */
function featuredScore(p: Product): number {
  let score = p.popularityRank;
  if (p.badges.includes('bestseller')) score -= 40;
  if (p.badges.includes('new')) score -= 12;
  if (p.badges.includes('combo-saver')) score -= 8;
  if (p.rating) score -= p.rating.average * 2;
  return score;
}

export function sortProducts(products: Product[], sort: SortId): Product[] {
  const list = [...products];
  switch (sort) {
    case 'best-selling':
      return list.sort((a, b) => a.popularityRank - b.popularityRank);
    case 'newest':
      return list.sort((a, b) => b.launchedAt.localeCompare(a.launchedAt));
    case 'price-asc':
      return list.sort((a, b) => minSellingPrice(a) - minSellingPrice(b));
    case 'price-desc':
      return list.sort((a, b) => minSellingPrice(b) - minSellingPrice(a));
    case 'rating-desc':
      return list.sort((a, b) => {
        const ra = a.rating?.average ?? 0;
        const rb = b.rating?.average ?? 0;
        if (rb !== ra) return rb - ra;
        return (b.rating?.count ?? 0) - (a.rating?.count ?? 0);
      });
    case 'discount-desc':
      return list.sort((a, b) => discountPercent(displayPrice(b)) - discountPercent(displayPrice(a)));
    case 'name-asc':
      return list.sort((a, b) => a.title.localeCompare(b.title));
    case 'featured':
    default:
      return list.sort((a, b) => featuredScore(a) - featuredScore(b));
  }
}
