import type { Paise, Product, ProductVariant } from '@/lib/commerce/types';
import { allProducts } from '@/lib/catalog/collections';
import { calculateTotals, type CartTotals } from '@/lib/store/totals';
import type { AppliedCoupon, CartItem } from '@/lib/store/types';
import { validateCoupon } from '@/lib/offers/coupons';
import { activeProviderName } from '@/lib/commerce';
import {
  PURCHASABLE_PROVIDER,
  PURCHASE_BLOCK_NOTE,
  purchaseBlockFor,
} from '@/lib/commerce/purchase';
import { checkPincode, type ServiceabilityResult } from '@/lib/support/serviceability';
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
    maxQuantity: Math.max(1, variant.stock),
    category: product.category,
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
    const allowed = Math.min(quantity, variant.stock);
    if (allowed < quantity) {
      issues.push({
        code: 'quantity_reduced',
        variantId: variant.id,
        title: product.title,
        message: `Only ${variant.stock} of ${product.title} available — quantity reduced.`,
      });
    }

    const item = toCartItem(product, variant, allowed);
    items.push(item);
    orderItems.push(toOrderItem(item, product));
  }

  /* ----------------------------------------------------------- coupon */

  let coupon: AppliedCoupon | null = null;
  if (request.couponCode) {
    const result = validateCoupon(request.couponCode, items);
    if (result.ok) {
      coupon = result.coupon;
    } else {
      issues.push({ code: 'coupon_invalid', message: result.reason });
    }
  }

  /* --------------------------------------------------- serviceability */

  let serviceability: ServiceabilityResult | null = null;
  if (request.pincode) {
    const outcome = checkPincode(request.pincode);
    if ('error' in outcome) {
      issues.push({ code: 'not_serviceable', message: outcome.error });
    } else {
      serviceability = outcome;
      if (!outcome.serviceable) {
        issues.push({ code: 'not_serviceable', message: outcome.message });
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
  const totals = calculateTotals(items, coupon, codFee);

  if (wantsCod && codAvailable && totals.total > config.COD_MAX_ORDER_PAISE) {
    issues.push({
      code: 'cod_unavailable',
      message: 'This order is above the cash-on-delivery limit. Please pay online.',
    });
  }

  /**
   * Which issues actually refuse the order.
   *
   * `not_serviceable` is deliberately **absent**. It is still raised above and
   * still returned in `issues`, so the checkout can tell a customer that we
   * cannot confirm delivery to their pincode — it simply no longer stops them
   * ordering.
   *
   * The reason is that nothing behind it is real. `checkPincode` is a
   * development fixture that decides coverage from the digit sum of the
   * pincode (`serviceable = checksum % 11 !== 0`), which refuses roughly one
   * valid Indian pincode in eleven on grounds that have no relationship to
   * where we actually deliver. A fixture that turns real customers away is
   * worse than no coverage check at all.
   *
   * Put this back the moment `checkPincode` is answered by real coverage data
   * rather than arithmetic. That is a one-line change, and it is the only
   * change needed — the issue code, the message and the call site all remain.
   *
   * Note this is about *coverage*, not about *data*. A malformed pincode is
   * still rejected: `pincodeSchema` requires six digits before a quote is ever
   * built. What stops here is a well-formed pincode being refused as
   * undeliverable by a fiction.
   */
  const blocking = new Set<QuoteIssueCode>([
    'not_found',
    'not_purchasable',
    'out_of_stock',
    'cod_unavailable',
  ]);

  const placeable =
    items.length > 0 && !issues.some((issue) => blocking.has(issue.code));

  return {
    items,
    orderItems,
    totals,
    coupon,
    issues,
    serviceability,
    codEnabled,
    codAvailable,
    codFee,
    placeable,
  };
}
