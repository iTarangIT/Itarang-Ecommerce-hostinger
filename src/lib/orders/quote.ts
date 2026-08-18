import type { Paise, Product, ProductVariant } from '@/lib/commerce/types';
import { allProducts } from '@/lib/catalog/collections';
import { calculateTotals, type CartTotals } from '@/lib/store/totals';
import type { AppliedCoupon, CartItem } from '@/lib/store/types';
import { validateCoupon } from '@/lib/offers/coupons';
import { checkPincode, type ServiceabilityResult } from '@/lib/support/serviceability';
import { env } from '@/lib/env';
import type { OrderItem, PaymentMethod } from './types';

/**
 * Server-side quote — the pricing authority.
 *
 * The browser sends variant ids and quantities and nothing else. Every price,
 * every discount and every total is recomputed here from the catalogue
 * provider, so a tampered client cart cannot change what is charged.
 *
 * Totals come from `calculateTotals` — the same pure function the cart UI uses
 * — so the displayed price and the charged price cannot drift apart.
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

  const items: CartItem[] = [];
  const orderItems: OrderItem[] = [];
  const issues: QuoteIssue[] = [];

  for (const line of request.lines) {
    const quantity = Math.max(0, Math.floor(line.quantity));
    if (quantity === 0) continue;

    const match = findVariant(products, line.variantId);
    if (!match) {
      issues.push({
        code: 'not_found',
        variantId: line.variantId,
        message: 'This product is no longer available.',
      });
      continue;
    }

    const { product, variant } = match;

    if (variant.availability === 'out-of-stock' || variant.stock <= 0) {
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

  const codAvailable =
    config.COD_ENABLED && (serviceability?.serviceable ?? false) && (serviceability?.codAvailable ?? false);

  const wantsCod = request.paymentMethod === 'cod';
  if (wantsCod && !codAvailable) {
    issues.push({
      code: 'cod_unavailable',
      message: serviceability
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

  const blocking = new Set<QuoteIssueCode>([
    'not_found',
    'out_of_stock',
    'not_serviceable',
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
    codAvailable,
    codFee,
    placeable,
  };
}
