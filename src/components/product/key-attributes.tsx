import type { Product } from '@/lib/commerce/types';

export interface Attribute {
  label: string;
  value: string;
}

/**
 * The handful of figures that identify a product at a glance.
 *
 * Rendered as the "Key Highlights" tile inside the gallery grid, the way a
 * retail listing overlays its headline attributes on one of the photographs.
 * Everything here is stated elsewhere on the page too — this is a summary, so
 * it invents nothing and simply takes what the catalogue already gives.
 *
 * Facets come first: they are the normalised, filterable values, so they are
 * the ones a shopper is comparing across products. The first spec group fills
 * any remaining slots.
 */
export function attributePairs(product: Product): Attribute[] {
  const { capacityVa, batteryAh, technology, backupHours, phase } = product.facets;
  const pairs: Attribute[] = [];

  if (capacityVa) pairs.push({ label: 'Capacity', value: `${capacityVa.toLocaleString('en-IN')} VA` });
  if (batteryAh) pairs.push({ label: 'Battery', value: `${batteryAh} Ah` });
  if (technology) pairs.push({ label: 'Technology', value: technology });
  if (backupHours) pairs.push({ label: 'Typical backup', value: `${backupHours} hours` });
  if (phase) pairs.push({ label: 'Phase', value: phase });
  if (product.warrantyMonths !== undefined) {
    pairs.push({ label: 'Warranty', value: `${Math.round(product.warrantyMonths / 12)} years` });
  }

  // Deduplicated on the *value*, not just the label: "Battery 150 Ah" and
  // "Rated capacity 150 Ah" are the same fact under two names, and a
  // five-item highlight panel cannot afford to state one of them twice.
  const seen = new Set(pairs.flatMap((pair) => [pair.label, pair.value]));
  for (const spec of product.specGroups[0]?.specs ?? []) {
    if (pairs.length >= 6) break;
    if (seen.has(spec.label) || seen.has(spec.value)) continue;
    seen.add(spec.label);
    seen.add(spec.value);
    pairs.push(spec);
  }

  return pairs.slice(0, 6);
}
