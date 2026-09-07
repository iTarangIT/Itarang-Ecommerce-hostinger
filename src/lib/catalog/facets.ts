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
  /**
   * The number a `range` facet filters on, or `undefined` when the product does
   * not state one.
   *
   * Required for `type: 'range'` and meaningless otherwise. It exists because
   * the engine used to hardcode *price* into its range branch — the only range
   * facet there was — so adding a second one meant either a second hardcoded
   * branch or this. A product returning `undefined` is excluded from the facet
   * and from any filtering by it, which is the same rule `valuesOf` follows for
   * a checkbox: nothing is filed under a guessed value.
   */
  rangeValueOf?: (product: Product) => number | undefined;
  /** How many decimal places the range's URL and labels keep. */
  precision?: number;
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
  /**
   * Capacity and voltage are ranges, not tick-boxes.
   *
   * As checkboxes they listed one option per distinct value in the catalogue —
   * 30, 32, 45, 105 — which reads as a menu of the four batteries we happen to
   * stock rather than as a way of narrowing. A shopper thinks "at least 45Ah",
   * or "a 60-volt vehicle", and a range says that in one gesture; the tick-box
   * version needed them to know in advance which values exist and to tick every
   * one that qualifies.
   *
   * `valuesOf` still returns the raw value even though a range facet does not
   * use it, so nothing breaks if either is turned back into a checkbox.
   */
  batteryAh: {
    id: 'batteryAh',
    label: 'Capacity (Ah)',
    type: 'range',
    unit: 'Ah',
    valuesOf: (p) => (p.facets.batteryAh ? [String(p.facets.batteryAh)] : []),
    labelOf: (v) => `${v} Ah`,
    order: (v) => Number(v),
    rangeValueOf: (p) => p.facets.batteryAh,
  },
  voltage: {
    id: 'voltage',
    label: 'Voltage',
    type: 'range',
    unit: 'V',
    // The first filter an EV buyer applies, and the one that decides whether a
    // pack fits at all: a 51V pack and a 73.6V pack are not alternatives for
    // the same vehicle. Products that state no voltage contribute nothing and
    // are absent from the facet.
    //
    // One decimal place, because the catalogue's voltages are 12.8, 25.6, 60.8
    // and 73.6 — rounding them to integers would put two distinct packs at the
    // same figure and make the upper bound exclude the very product that set it.
    valuesOf: (p) => (p.facets.voltage ? [String(p.facets.voltage)] : []),
    labelOf: (v) => `${v} V`,
    order: (v) => Number(v),
    rangeValueOf: (p) => p.facets.voltage,
    precision: 1,
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
    // In paise, like every other money value in the codebase. `query.ts`
    // converts to and from rupees at the URL boundary and nowhere else.
    rangeValueOf: (p) => minSellingPrice(p),
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
