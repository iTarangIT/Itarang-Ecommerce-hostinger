import type { Paise } from '@/lib/commerce/types';
import type { AppliedCoupon, CartItem } from './types';

/** Free standard delivery above this cart value. */
export const FREE_SHIPPING_THRESHOLD: Paise = 499900;
/**
 * PLACEHOLDER (D-03) — business has not agreed the delivery charge. Until it
 * is `true` the site states no threshold or charge anywhere; the cart and
 * checkout still show the charge this file computes, line by line, before
 * payment. Set it once D-03 is answered and the two constants above match.
 */
export const DELIVERY_CHARGE_CONFIRMED = false;
/** The one sentence the site uses about delivery cost while D-03 is open. */
export const DELIVERY_CHARGE_NOTE = 'Any delivery charge is shown in your cart before you pay.';
export const STANDARD_SHIPPING: Paise = 39900;

/** GST is included in listed prices; this is the extracted component. */
const GST_RATE = 0.18;

export interface CartTotals {
  itemCount: number;
  subtotal: Paise;
  mrpTotal: Paise;
  productSavings: Paise;
  couponDiscount: Paise;
  /** Discount for paying by a particular method — ₹200 for UPI. */
  paymentDiscount: Paise;
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
 * checkout, so the two can never disagree. `codFee` and `paymentDiscount` are
 * only ever non-zero on the server, once a payment method has been chosen.
 *
 * The payment discount is taken after the coupon and never below zero, and it
 * does not count towards free delivery: the threshold is about what was bought,
 * not how it was paid for.
 */
export function calculateTotals(
  items: CartItem[],
  coupon: AppliedCoupon | null,
  codFee: Paise = 0,
  paymentDiscount: Paise = 0,
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
  const appliedPaymentDiscount = itemCount === 0 ? 0 : Math.min(paymentDiscount, afterDiscount);
  const total = afterDiscount - appliedPaymentDiscount + shipping + appliedCodFee;
  const gstIncluded = Math.round(total - total / (1 + GST_RATE));

  return {
    itemCount,
    subtotal,
    mrpTotal,
    productSavings,
    couponDiscount,
    paymentDiscount: appliedPaymentDiscount,
    shipping,
    codFee: appliedCodFee,
    total,
    totalSavings: productSavings + couponDiscount + appliedPaymentDiscount,
    gstIncluded,
    amountToFreeShipping: Math.max(0, FREE_SHIPPING_THRESHOLD - afterDiscount),
  };
}
