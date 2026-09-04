import type { Availability } from './types';
import { isDemoSlug } from './demo/demo-slug';

/**
 * What may be bought, and by what rule.
 *
 * Purchasing is **on**, and deliberately narrow: only the catalogue we own —
 * our Postgres rows, served by `DbCatalogProvider` — may be sold. That
 * restriction is not expressed by hoping the right provider is configured. It
 * is checked on the server, in `lib/orders/quote.ts`, which is the only place
 * a price is ever decided.
 *
 * The rules below are **pure** so that the buy box and the server quote apply
 * the same test rather than two that can drift. The division of labour:
 *
 *   `purchaseBlockFor` answers "may this variant be sold?" from values the
 *   product itself carries. Same answer on the client and the server.
 *
 *   The *provider* check — is this catalogue ours at all? — cannot live here,
 *   because resolving the provider pulls in the server-only catalogue modules.
 *   It lives in `buildQuote`, runs before any line is priced, and is what
 *   keeps a Hostinger or development-fixture product from ever being quoted.
 *
 * **The client is not trusted for any of this.** The browser sends variant ids
 * and quantities and nothing else; every price, every availability and every
 * eligibility decision is recomputed server-side from the database row. The
 * gate below existing in the UI only stops a shopper starting something the
 * server would refuse — it is a courtesy, never the protection.
 */

/**
 * The master switch, kept as one constant so there is one thing to flip.
 *
 * Annotated `boolean` rather than left as a literal so the compiler does not
 * narrow either branch to unreachable code — the disabled-state rendering
 * stays type-checked either way.
 *
 * Turning this off again disables every purchase control site-wide and leaves
 * the pipeline behind it untouched, exactly as before.
 */
export const PURCHASE_ENABLED: boolean = true;

/** Why a purchase control is disabled, when the whole switch is off. */
export const PURCHASE_DISABLED_NOTE = 'Online ordering opens soon.';

/**
 * Why one particular variant may not be bought.
 *
 * `null` from `purchaseBlockFor` means "no objection from these rules" — not
 * "sellable". The provider check and the live stock re-read still have to pass
 * on the server.
 */
export type PurchaseBlock =
  | 'purchasing-disabled'
  | 'not-a-catalogue-product'
  | 'not-priced'
  | 'out-of-stock';

/** The sentence a shopper sees for each block. */
export const PURCHASE_BLOCK_NOTE: Record<PurchaseBlock, string> = {
  'purchasing-disabled': PURCHASE_DISABLED_NOTE,
  // The demo fixture. It is a UI reference, has never been a real product, and
  // must not become one by being reachable from a buy button.
  'not-a-catalogue-product': 'This is a demonstration listing and is not for sale.',
  'not-priced': 'This product is not priced yet.',
  'out-of-stock': 'Out of stock.',
};

/** The minimum a caller must know about a variant to ask the question. */
export interface PurchasableVariant {
  price: { selling: number };
  availability: Availability;
  stock: number;
}

/**
 * May this variant be sold?
 *
 * Every clause fails closed, and the order is deliberate — the most
 * fundamental objection is reported first, so a demo product is never
 * described to a shopper as merely "out of stock".
 *
 * `selling <= 0` is the unpriced case. A published row cannot reach it —
 * `publishBlockers()` refuses to publish without a price — but `to-domain.ts`
 * projects a missing price as `0` so that an admin preview can render a draft,
 * and a zero-rupee order is the one arithmetic mistake that cannot be undone
 * by refunding it.
 */
export function purchaseBlockFor(
  product: { slug: string },
  variant: PurchasableVariant,
): PurchaseBlock | null {
  if (!PURCHASE_ENABLED) return 'purchasing-disabled';
  if (isDemoSlug(product.slug)) return 'not-a-catalogue-product';
  if (!Number.isFinite(variant.price.selling) || variant.price.selling <= 0) return 'not-priced';
  if (variant.availability === 'out-of-stock' || variant.stock <= 0) return 'out-of-stock';
  return null;
}

/**
 * The provider whose catalogue may be sold.
 *
 * `DbCatalogProvider.name`. Compared as a string rather than imported as a
 * class so this module stays free of server-only imports and can be read by a
 * client component.
 */
export const PURCHASABLE_PROVIDER = 'db';
