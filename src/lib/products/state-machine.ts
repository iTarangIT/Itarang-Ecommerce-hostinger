import type { ProductRecord, ProductStatus } from './types';

/**
 * Publishing, as a state machine.
 *
 * Modelled on `orders/state-machine.ts` for the same reason that one exists: a
 * form can be tampered with, so the set of legal moves has to live somewhere
 * the form cannot reach.
 *
 *   draft ──publish──▶ published
 *     ▲                    │
 *     └───unpublish────────┘
 *     │                    │
 *     └──restore── archived ◀──archive── (draft | published)
 *
 * Two absences are deliberate.
 *
 * **There is no delete.** `order_items` snapshots `product_id`, `variant_id`
 * and `sku` at the moment of sale, and `funnel_events.product_id` records what
 * a visitor looked at. Deleting a product would strand both. `archived` is the
 * withdrawal, and it is reversible.
 *
 * **`archived → published` is not a move.** Coming back requires passing
 * through `draft`, which is where the publish gate below is applied. A product
 * withdrawn six months ago should have its price and warranty looked at before
 * it is on sale again, not be restored straight to the storefront.
 */

const TRANSITIONS: Record<ProductStatus, ProductStatus[]> = {
  draft: ['published', 'archived'],
  published: ['draft', 'archived'],
  archived: ['draft'],
};

export function canTransitionProduct(from: ProductStatus, to: ProductStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextProductStatuses(from: ProductStatus): ProductStatus[] {
  return TRANSITIONS[from];
}

/**
 * What a product must state before it may go on sale.
 *
 * This is the gate, not a lint. A product whose selling price is still unknown
 * — the source document says "[insert]" — is a perfectly valid draft and must
 * not be reachable from the storefront, because a page with a blank price is
 * worse than no page.
 *
 * Media is required for the same reason the gallery returns `null` on an empty
 * `images` array: a product page with no image is not a product page.
 *
 * Warranty is deliberately **not** required. Five of the eight source documents
 * do not state one, and the whole codebase's rule is that an unknown warranty
 * renders as nothing rather than as a default. Requiring it here would force
 * somebody to invent one to get a product published.
 */
export function publishBlockers(product: ProductRecord): string[] {
  const missing: string[] = [];

  if (!product.title.trim()) missing.push('title');
  if (!product.slug.trim()) missing.push('slug');
  if (!product.subcategory.trim()) missing.push('subcategory');

  if (product.variants.length === 0) {
    missing.push('at least one variant');
  } else {
    const priced = product.variants.filter(
      (variant) => variant.selling !== null && variant.mrp !== null,
    );
    if (priced.length === 0) missing.push('a variant with an MRP and a selling price');

    const unpricedSku = product.variants.find(
      (variant) => variant.selling === null || variant.mrp === null,
    );
    // Named rather than counted: "TRN-TK25100 has no selling price" is
    // actionable, "1 variant is unpriced" sends the admin hunting.
    if (unpricedSku && priced.length > 0) missing.push(`price for ${unpricedSku.sku}`);
  }

  if (product.media.length === 0) missing.push('at least one image');
  if (product.description.length === 0) missing.push('a description');

  return missing;
}
