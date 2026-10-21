import type { Product } from '@/lib/commerce/types';
import { SUBCATEGORY_NAMES, subcategoryName } from '@/lib/catalog/category-names';

export const DOWNLOADS_PATH = '/downloads';

/** `/downloads/<product slug>` — the printable spec sheet for one product. */
export function specSheetPath(productSlug: string): string {
  return `${DOWNLOADS_PATH}/${productSlug}`;
}

export interface SpecSheetGroup {
  subcategory: string;
  name: string;
  products: Product[];
}

/**
 * Products grouped by subcategory, in the taxonomy's display order.
 *
 * Subcategories the name table does not know (a newly created one, say) follow
 * the known ones alphabetically rather than being dropped — a published
 * product should always have a spec sheet listed.
 */
export function groupBySubcategory(products: Product[]): SpecSheetGroup[] {
  const order = Object.keys(SUBCATEGORY_NAMES);
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    const list = groups.get(product.subcategory) ?? [];
    list.push(product);
    groups.set(product.subcategory, list);
  }
  const rank = (slug: string) => {
    const index = order.indexOf(slug);
    return index === -1 ? order.length : index;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([subcategory, list]) => ({
      subcategory,
      name: subcategoryName(subcategory),
      products: [...list].sort((a, b) => a.title.localeCompare(b.title, 'en-IN')),
    }));
}

/** The warranty as the customer is offered it, or nothing when none is stated. */
export function warrantyLine(product: Product): string | undefined {
  if (product.warrantyText) return product.warrantyText;
  if (product.warrantyMonths !== undefined) {
    const years = product.warrantyMonths / 12;
    return Number.isInteger(years)
      ? `${years} ${years === 1 ? 'year' : 'years'}`
      : `${product.warrantyMonths} months`;
  }
  return undefined;
}
