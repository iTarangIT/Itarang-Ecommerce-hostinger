import type { FacetId, FacetType, Product } from '@/lib/commerce/types';
import { categoryName, subcategoryName } from './category-names';
import { minSellingPrice, productAvailability } from './pricing';

/**
 * Facet definitions.
 *
 * Each facet knows how to derive its own values from a product and how to
 * render a value as a label. Adding a facet is a single entry here plus one
 * line in the relevant category's `facetIds`.
 */
export interface FacetDefinition {
  id: FacetId;
  label: string;
  type: FacetType;
  unit?: string;
  collapsedByDefault?: boolean;
  /** Raw facet values a product contributes; empty means the product is excluded. */
  valuesOf: (product: Product) => string[];
  /** Human label for a raw value. */
  labelOf: (value: string) => string;
  /** Sort weight for options; lower first. Falls back to alphabetical. */
  order?: (value: string) => number;
}

const BACKUP_BUCKETS: Array<{ value: string; label: string; test: (h: number) => boolean; order: number }> = [
  { value: 'upto-4', label: 'Up to 4 hours', test: (h) => h <= 4, order: 1 },
  { value: '4-6', label: '4 – 6 hours', test: (h) => h > 4 && h <= 6, order: 2 },
  { value: '6-8', label: '6 – 8 hours', test: (h) => h > 6 && h <= 8, order: 3 },
  { value: '8-plus', label: '8 hours and above', test: (h) => h > 8, order: 4 },
];

function warrantyLabel(months: number): string {
  if (months % 12 === 0) {
    const years = months / 12;
    return `${years} year${years > 1 ? 's' : ''}`;
  }
  return `${(months / 12).toFixed(1)} years`;
}

export const FACET_DEFINITIONS: Record<FacetId, FacetDefinition> = {
  category: {
    id: 'category',
    label: 'Category',
    type: 'checkbox',
    valuesOf: (p) => [p.category],
    labelOf: (v) => categoryName(v),
  },
  subcategory: {
    id: 'subcategory',
    label: 'Type',
    type: 'checkbox',
    valuesOf: (p) => [p.subcategory],
    labelOf: (v) => subcategoryName(v),
  },
  capacityVa: {
    id: 'capacityVa',
    label: 'Capacity',
    type: 'checkbox',
    unit: 'VA',
    valuesOf: (p) => (p.facets.capacityVa ? [String(p.facets.capacityVa)] : []),
    labelOf: (v) => `${Number(v).toLocaleString('en-IN')} VA`,
    order: (v) => Number(v),
  },
  batteryAh: {
    id: 'batteryAh',
    label: 'Battery capacity',
    type: 'checkbox',
    unit: 'Ah',
    valuesOf: (p) => (p.facets.batteryAh ? [String(p.facets.batteryAh)] : []),
    labelOf: (v) => `${v} Ah`,
    order: (v) => Number(v),
  },
  voltage: {
    id: 'voltage',
    label: 'System voltage',
    type: 'checkbox',
    unit: 'V',
    // The first filter an EV buyer applies, and the one that decides whether a
    // pack fits at all: a 51V pack and a 73.6V pack are not alternatives for
    // the same vehicle. Products that state no voltage — every home inverter
    // battery — contribute nothing and are absent from the facet.
    valuesOf: (p) => (p.facets.voltage ? [String(p.facets.voltage)] : []),
    labelOf: (v) => `${v} V`,
    order: (v) => Number(v),
  },
  technology: {
    id: 'technology',
    label: 'Technology',
    type: 'checkbox',
    valuesOf: (p) => (p.facets.technology ? [p.facets.technology] : []),
    labelOf: (v) => v,
  },
  backupHours: {
    id: 'backupHours',
    label: 'Typical backup',
    type: 'checkbox',
    collapsedByDefault: true,
    valuesOf: (p) => {
      const h = p.facets.backupHours;
      if (h === undefined) return [];
      const bucket = BACKUP_BUCKETS.find((b) => b.test(h));
      return bucket ? [bucket.value] : [];
    },
    labelOf: (v) => BACKUP_BUCKETS.find((b) => b.value === v)?.label ?? v,
    order: (v) => BACKUP_BUCKETS.find((b) => b.value === v)?.order ?? 99,
  },
  warrantyMonths: {
    id: 'warrantyMonths',
    label: 'Warranty',
    type: 'checkbox',
    collapsedByDefault: true,
    // A product with no stated warranty contributes no value, so it is simply
    // absent from this facet rather than filed under an invented figure.
    valuesOf: (p) =>
      p.facets.warrantyMonths === undefined ? [] : [String(p.facets.warrantyMonths)],
    labelOf: (v) => warrantyLabel(Number(v)),
    order: (v) => Number(v),
  },
  price: {
    id: 'price',
    label: 'Price',
    type: 'range',
    valuesOf: () => [],
    labelOf: (v) => v,
  },
  availability: {
    id: 'availability',
    label: 'Availability',
    type: 'checkbox',
    valuesOf: (p) => {
      const availability = productAvailability(p);
      return [availability === 'out-of-stock' ? 'out-of-stock' : 'in-stock'];
    },
    labelOf: (v) => (v === 'in-stock' ? 'In stock' : 'Out of stock'),
    order: (v) => (v === 'in-stock' ? 0 : 1),
  },
  rating: {
    id: 'rating',
    label: 'Customer rating',
    type: 'rating',
    collapsedByDefault: true,
    valuesOf: (p) => {
      if (!p.rating) return [];
      const out: string[] = [];
      for (const threshold of [4, 3, 2]) {
        if (p.rating.average >= threshold) out.push(String(threshold));
      }
      return out;
    },
    labelOf: (v) => `${v} and above`,
    order: (v) => -Number(v),
  },
  solarReady: {
    id: 'solarReady',
    label: 'Solar ready',
    type: 'toggle',
    valuesOf: (p) => (p.facets.solarReady ? ['yes'] : []),
    labelOf: () => 'Solar ready only',
  },
};

/** Does a product satisfy every selected value for one facet? (OR within a facet.) */
export function productMatchesFacet(
  product: Product,
  facetId: FacetId,
  selected: string[],
): boolean {
  if (selected.length === 0) return true;
  const def = FACET_DEFINITIONS[facetId];
  const values = def.valuesOf(product);
  return selected.some((s) => values.includes(s));
}

export function productPrice(product: Product): number {
  return minSellingPrice(product);
}
