import type { Paise, Product, ProductVariant } from '@/lib/commerce/types';
import { allProducts } from '@/lib/catalog/collections';
import { calculateTotals, type CartTotals } from '@/lib/store/totals';
import type { AppliedCoupon, CartItem } from '@/lib/store/types';
import { COUPONS_ENABLED, UPI_DISCOUNT, validateCoupon } from '@/lib/offers/coupons';
import { campaignIneligibility, type Campaign } from '@/lib/offers/campaigns';
import { eligibilityContext, findCampaign } from '@/lib/offers/campaign-store';
import { activeProviderName } from '@/lib/commerce';
import {
  PURCHASABLE_PROVIDER,
  PURCHASE_BLOCK_NOTE,
  customerMaxQuantity,
  purchaseBlockFor,
} from '@/lib/commerce/purchase';
import type { ServiceabilityResult } from '@/lib/support/serviceability';
import { lookupPincode } from '@/lib/support/serviceability-server';
import { env } from '@/lib/env';
import type { OrderItem, PaymentMethod } from './types';

/**
 * Server-side quote — the pricing authority, and the eligibility authority.
 *
 * The browser sends variant ids and quantities and nothing else. Every price,
 * every discount and every total is recomputed here from the catalogue
 * provider, so a tampered client cart cannot change what is charged.
 *
 * Totals come from `calculateTotals` — the same pure function the cart UI uses
 * — so the displayed price and the charged price cannot drift apart.
 *
 * **What may be sold is decided here too, and nowhere else that matters.**
 * Two gates, in order:
 *
 *  1. *Whose catalogue is this?* Only the database catalogue we own may be
 *     sold. Under `COMMERCE_PROVIDER=hostinger` or `mock` this function quotes
 *     nothing at all, so a Hostinger product or a development fixture cannot be
 *     priced, ordered or paid for even by a caller who knows a real variant id.
 *     Checked once, before any line is looked at, because it is a statement
 *     about the whole request.
 *
 *  2. *May this variant be sold?* `purchaseBlockFor` — the same pure rule the
 *     buy box applies — rejects the demo fixture, an unpriced variant and an
 *     out-of-stock one. Applied per line against the row just read from the
 *     database, never against anything the client sent.
 *
 * A draft product needs no gate of its own: `DbCatalogProvider` reads
 * `listPublished()`, so a draft is not in `allProducts()` and resolves as
 * `not_found` — the same answer as an id that was never real. That is the
 * right amount to tell an anonymous caller probing for unreleased products.
 */

export interface QuoteLineRequest {
  variantId: string;
  quantity: number;
}

export interface QuoteRequest {
  lines: QuoteLineRequest[];
  couponCode?: string;
  pincode?: string;
  paymentMethod?: PaymentMethod;
  /**
   * The shopper chose to pay by UPI, which earns `UPI_DISCOUNT`. Ignored for
   * cash on delivery. Trusting the client with it is safe because the payment
   * window for such an order is opened on UPI alone.
   */
  payVia?: 'upi';
  /**
   * Who is asking, for the campaign rules (first order, customer type, usage
   * limits, delivery area). Set by the server from the session, never read
   * from the request body. `final` (order placement) makes every rule count.
   */
  shopper?: {
    userId?: number;
    phone?: string;
    city?: string;
    state?: string;
    final?: boolean;
  };
}

export type QuoteIssueCode =
  | 'not_found'
  | 'not_purchasable'
  | 'out_of_stock'
  | 'quantity_reduced'
  | 'price_changed'
  | 'coupon_invalid'
  | 'cod_unavailable'
  | 'not_serviceable';

export interface QuoteIssue {
  code: QuoteIssueCode;
  variantId?: string;
  title?: string;
  message: string;
}

export interface QuoteResult {
  /** Authoritative lines, priced from the catalogue. */
  items: CartItem[];
  orderItems: OrderItem[];
  totals: CartTotals;
  coupon: AppliedCoupon | null;
  /** The campaign behind `coupon`, for the limits re-checked at placement. */
  campaign: Campaign | null;
  issues: QuoteIssue[];
  serviceability: ServiceabilityResult | null;
  /**
   * Whether the business offers cash on delivery at all.
   *
   * Distinct from `codAvailable`, which additionally depends on the pincode.
   * The checkout needs both: "we do not offer this" and "we do not offer this
   * *here*" are different sentences, and showing the second when the first is
   * true tells a customer their address is the problem when it is not.
   */
  codEnabled: boolean;
  codAvailable: boolean;
  codFee: Paise;
  /** False when the quote cannot be turned into an order as-is. */
  placeable: boolean;
}

const DEFAULT_GST_RATE = 0.18;

function findVariant(
  products: Product[],
  variantId: string,
): { product: Product; variant: ProductVariant } | null {
  for (const product of products) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (variant) return { product, variant };
  }
  return null;
}

function toCartItem(product: Product, variant: ProductVariant, quantity: number): CartItem {
  return {
    id: variant.id,
    productId: product.id,
    slug: product.slug,
    title: product.title,
    variantTitle: product.options.length > 0 ? variant.title : undefined,
    image: product.images[0] ?? '',
    price: variant.price,
    quantity,
    // The stepper ceiling the cart renders, which is why it is capped rather
    // than set to the true count: `maxQuantity` crosses the wire to the
    // browser, so `variant.stock` here would publish the figure this release
    // exists to stop publishing. The genuine availability clamp is `allowed`
    // below, computed from the real number and never sent.
    maxQuantity: customerMaxQuantity(variant.stock),
    category: product.category,
    subcategory: product.subcategory,
    installationIncluded: product.installationIncluded,
  };
}

function toOrderItem(item: CartItem, product: Product): OrderItem {
  return {
    productId: item.productId,
    variantId: item.id,
    sku: product.variants.find((v) => v.id === item.id)?.sku ?? item.id,
    title: item.title,
    variantTitle: item.variantTitle,
    image: item.image,
    unitMrp: item.price.mrp,
    unitPrice: item.price.selling,
    quantity: item.quantity,
    lineTotal: item.price.selling * item.quantity,
    // HSN codes are not in the catalogue yet; captured as undefined rather than
    // guessed, so an invoice cannot be built on an invented classification.
    hsnCode: undefined,
    taxRate: DEFAULT_GST_RATE,
    installationIncluded: item.installationIncluded,
  };
}

export async function buildQuote(request: QuoteRequest): Promise<QuoteResult> {
  const config = env();
  const products = await allProducts();

  // Read once. `activeProviderName()` resolves the singleton provider, and the
  // answer cannot change within a request.
  const ownCatalogue = activeProviderName() === PURCHASABLE_PROVIDER;

  const items: CartItem[] = [];
  const orderItems: OrderItem[] = [];
  const issues: QuoteIssue[] = [];

  for (const line of request.lines) {
    const quantity = Math.max(0, Math.floor(line.quantity));
    if (quantity === 0) continue;

    // Nothing is quoted at all unless the catalogue is ours. Inside the loop so
    // every line carries the refusal, rather than returning early with an empty
    // quote the caller would read as an empty cart.
    if (!ownCatalogue) {
      issues.push({
        code: 'not_purchasable',
        variantId: line.variantId,
        message: 'This product is not available to buy from this store.',
      });
      continue;
    }

    const match = findVariant(products, line.variantId);
    if (!match) {
      // Also the answer for a draft product, which is absent from
      // `listPublished()`. Deliberately indistinguishable from an id that never
      // existed, so the endpoint is not an oracle for unreleased products.
      issues.push({
        code: 'not_found',
        variantId: line.variantId,
        message: 'This product is no longer available.',
      });
      continue;
    }

    const { product, variant } = match;

    // The same pure rule the buy box applies, re-run here against the row the
    // database just returned. `out-of-stock` keeps its own issue code because
    // the checkout says something specific about it.
    const block = purchaseBlockFor(product, variant);
    if (block !== null && block !== 'out-of-stock') {
      issues.push({
        code: 'not_purchasable',
        variantId: variant.id,
        title: product.title,
        message: `${product.title} is not available to buy. ${PURCHASE_BLOCK_NOTE[block]}`,
      });
      continue;
    }

    if (block === 'out-of-stock') {
      issues.push({
        code: 'out_of_stock',
        variantId: variant.id,
        title: product.title,
        message: `${product.title} is out of stock.`,
      });
      continue;
    }

    // Silently capping would charge for less than the shopper asked for, so the
    // reduction is reported and the checkout surfaces it.
    //
    // The message no longer names the figure. It used to read "Only N of X
    // available", which handed over the exact count the moment a shopper asked
    // for more than we hold — the one request guaranteed to reveal it. The
    // clamp below is unchanged and still uses the true number; only the
    // sentence describing it does not.
    const allowed = Math.min(quantity, variant.stock);
    if (allowed < quantity) {
      issues.push({
        code: 'quantity_reduced',
        variantId: variant.id,
        title: product.title,
        message: `We cannot supply that many of ${product.title} right now — quantity reduced.`,
      });
    }

    const item = toCartItem(product, variant, allowed);
    items.push(item);
    orderItems.push(toOrderItem(item, product));
  }

  /* --------------------------------------------------- serviceability */

  let serviceability: ServiceabilityResult | null = null;
  if (request.pincode) {
    // Coverage only — the place name is the address form's job, not pricing's.
    const outcome = await lookupPincode(request.pincode, { withPlace: false });
    if ('error' in outcome) {
      issues.push({ code: 'not_serviceable', message: outcome.error });
    } else {
      serviceability = outcome;
      if (!outcome.serviceable) {
        issues.push({ code: 'not_serviceable', message: outcome.message });
      }
    }
  }

  /* ----------------------------------------------------------- coupon */

  /**
   * A code sent while coupons are switched off is *dropped*, not reported.
   *
   * `validateCoupon` refuses it either way, so no discount can be applied — the
   * only question is whether the customer is told. A cart saved in
   * `localStorage` before the switch was thrown still carries its code, and
   * telling that customer their coupon is invalid at checkout blames them for a
   * feature we turned off. The cart field clears the stored code on sight; this
   * is the second half of the same decision, for the shopper who reaches
   * checkout without opening the cart page.
   */
  let coupon: AppliedCoupon | null = null;
  let campaign: Campaign | null = null;
  if (request.couponCode && COUPONS_ENABLED) {
    // Read fresh from `campaigns` (admin-configured) on every quote, so a
    // paused or expired code stops working at once.
    const found = await findCampaign(request.couponCode);
    const result = validateCoupon(request.couponCode, items, found ? [found] : []);
    if (!result.ok) {
      issues.push({ code: 'coupon_invalid', message: result.reason });
    } else if (found) {
      // Who may use it: dates, limits, first order, customer, delivery area.
      // The delivery city/state come from the address at placement, or from
      // the pincode's coverage row while the shopper is still in checkout.
      const shopper = request.shopper ?? {};
      const context = await eligibilityContext(found, {
        ...shopper,
        city: shopper.city ?? serviceability?.city,
        state: shopper.state ?? serviceability?.state,
      });
      const refusal = campaignIneligibility(found, context);
      if (refusal) {
        issues.push({ code: 'coupon_invalid', message: refusal });
      } else {
        coupon = result.coupon;
        campaign = found;
      }
    }
  }



  /* -------------------------------------------------------------- COD */

  const codEnabled = config.COD_ENABLED;
  const codAvailable =
    codEnabled && (serviceability?.serviceable ?? false) && (serviceability?.codAvailable ?? false);

  const wantsCod = request.paymentMethod === 'cod';
  if (wantsCod && !codAvailable) {
    issues.push({
      code: 'cod_unavailable',
      message: !config.COD_ENABLED
        ? 'Cash on delivery is not available. Please pay online.'
        : serviceability
          ? 'Cash on delivery is not available at this pincode.'
          : 'Enter a delivery pincode to check cash on delivery.',
    });
  }

  const codFee = wantsCod && codAvailable ? config.COD_FEE_PAISE : 0;
  const paymentDiscount = request.payVia === 'upi' && !wantsCod ? UPI_DISCOUNT : 0;
  const totals = calculateTotals(items, coupon, codFee, paymentDiscount);

  if (wantsCod && codAvailable && totals.total > config.COD_MAX_ORDER_PAISE) {
    issues.push({
      code: 'cod_unavailable',
      message: 'This order is above the cash-on-delivery limit. Please pay online.',
    });
  }

  /**
   * Which issues actually refuse the order.
   *
   * `not_serviceable` refuses an order only when the coverage list says so —
   * a pincode we have explicitly switched off. An unlisted pincode is
   * "unconfirmed", which is reported to the shopper but does not block, and a
   * malformed one never reaches here (`pincodeSchema` requires six digits).
   * Before the coverage table this issue never blocked at all, because the
   * answer came from a checksum of the digits.
   */
  const blocking = new Set<QuoteIssueCode>([
    'not_found',
    'not_purchasable',
    'out_of_stock',
    'cod_unavailable',
  ]);

  const refusedPincode = serviceability !== null && serviceability.confirmed && !serviceability.serviceable;

  const placeable =
    items.length > 0 && !refusedPincode && !issues.some((issue) => blocking.has(issue.code));

  return {
    items,
    orderItems,
    totals,
    coupon,
    campaign,
    issues,
    serviceability,
    codEnabled,
    codAvailable,
    codFee,
    placeable,
  };
}
