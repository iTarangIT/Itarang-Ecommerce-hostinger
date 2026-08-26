import { cache } from 'react';
import { catalog } from '.';
import { allProducts } from '@/lib/catalog/collections';

/**
 * Catalogue health, for the admin console.
 *
 * Two failures motivated this, and both were silent for as long as they lasted:
 *
 * 1. `enrichment.ts` is keyed by Hostinger product id. When the merchant
 *    recreates a product in hPanel it comes back with a *new* id, so its entry
 *    stops matching and the product silently loses its subcategory, highlights,
 *    box contents, FAQs, warranty and every facet value. Recreating the whole
 *    catalogue does that to every product at once. The provider already logged
 *    a warning; nobody reads server logs, so it went unnoticed.
 *
 * 2. Two products sharing a SKU is a merchant data error our own order records
 *    inherit — `order_items.sku` is the snapshot an invoice is built from.
 *
 * Neither is something the storefront should try to repair on the fly. Both are
 * things an admin needs told.
 */
export interface CatalogHealth {
  provider: string;
  total: number;
  /** Live products with no explicit enrichment entry, filed by title matching. */
  unmapped: string[];
  /** SKUs carried by more than one product. */
  duplicateSkus: Array<{ sku: string; productIds: string[] }>;
  /** When the upstream snapshot was taken, if the provider keeps one. */
  fetchedAt: number | null;
}

/**
 * Force the next catalogue read to go upstream, where the provider supports it.
 *
 * The Next data cache is *not* touched here: `revalidateTag` may only be
 * called from a Server Action or route handler, and this module is imported by
 * plain unit tests. The caller invalidates the tag.
 */
export function invalidateCatalogueSnapshot(): void {
  const provider = catalog() as Partial<{ invalidate(): void }>;
  if (typeof provider.invalidate === 'function') provider.invalidate();
}

/** The optional slice of a provider that can report on its own snapshot. */
interface InspectableProvider {
  inspect(): Promise<{ count: number; unmapped: string[]; fetchedAt: number }>;
}

function isInspectable(value: unknown): value is InspectableProvider {
  return typeof (value as InspectableProvider).inspect === 'function';
}

export const catalogHealth = cache(async (): Promise<CatalogHealth> => {
  const provider = catalog();
  const products = await allProducts();

  const productIdsBySku = new Map<string, string[]>();
  for (const product of products) {
    for (const variant of product.variants) {
      const owners = productIdsBySku.get(variant.sku) ?? [];
      // A product with several variants on one SKU is normal; two *products*
      // on one SKU is not.
      if (!owners.includes(product.id)) owners.push(product.id);
      productIdsBySku.set(variant.sku, owners);
    }
  }

  const duplicateSkus = [...productIdsBySku]
    .filter(([, productIds]) => productIds.length > 1)
    .map(([sku, productIds]) => ({ sku, productIds }));

  // The mock provider has no upstream and nothing to be stale about.
  const snapshot = isInspectable(provider) ? await provider.inspect() : null;

  return {
    provider: provider.name,
    total: products.length,
    unmapped: snapshot?.unmapped ?? [],
    duplicateSkus,
    fetchedAt: snapshot?.fetchedAt ?? null,
  };
});
