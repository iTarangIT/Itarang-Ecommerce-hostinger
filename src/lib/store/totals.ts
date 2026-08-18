import type { Paise } from '@/lib/commerce/types';
import type { AppliedCoupon, CartItem } from './types';

/** Free standard delivery above this cart value. */
export const FREE_SHIPPING_THRESHOLD: Paise = 499900;
export const STANDARD_SHIPPING: Paise = 39900;

/** GST is included in listed prices; this is the extracted component. */
const GST_RATE = 0.18;

export interface CartTotals {
  itemCount: number;
  subtotal: Paise;
  mrpTotal: Paise;
  productSavings: Paise;
  couponDiscount: Paise;
  shipping: Paise;
  /** Cash-on-delivery handling fee; zero unless COD is the chosen method. */
  codFee: Paise;
  total: Paise;
  totalSavings: Paise;
  /** GST already contained within the total, shown for transparency. */
  gstIncluded: Paise;
  amountToFreeShipping: Paise;
}

/**
 * The single pricing implementation.
 *
 * Runs on the client for display and on the server as the *authority* during
 * checkout, so the two can never disagree. `codFee` is only ever non-zero on
 * the server, once a payment method has been chosen.
 */
export function calculateTotals(
  items: CartItem[],
  coupon: AppliedCoupon | null,
  codFee: Paise = 0,
): CartTotals {
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price.selling * i.quantity, 0);
  const mrpTotal = items.reduce((sum, i) => sum + i.price.mrp * i.quantity, 0);
  const productSavings = Math.max(0, mrpTotal - subtotal);
  const couponDiscount = coupon ? Math.min(coupon.discount, subtotal) : 0;
  const afterDiscount = subtotal - couponDiscount;

  const shipping =
    itemCount === 0 || coupon?.freeShipping || afterDiscount >= FREE_SHIPPING_THRESHOLD
      ? 0
      : STANDARD_SHIPPING;

  const appliedCodFee = itemCount === 0 ? 0 : codFee;
  const total = afterDiscount + shipping + appliedCodFee;
  const gstIncluded = Math.round(total - total / (1 + GST_RATE));

  return {
    itemCount,
    subtotal,
    mrpTotal,
    productSavings,
    couponDiscount,
    shipping,
    codFee: appliedCodFee,
    total,
    totalSavings: productSavings + couponDiscount,
    gstIncluded,
    amountToFreeShipping: Math.max(0, FREE_SHIPPING_THRESHOLD - afterDiscount),
  };
}
