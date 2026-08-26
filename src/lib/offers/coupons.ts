import type { CategorySlug, Paise } from '@/lib/commerce/types';
import type { AppliedCoupon, CartItem } from '@/lib/store/types';

/**
 * Coupon rules.
 *
 * Small and client-safe by design so the cart can validate instantly without a
 * round trip. When checkout is built, the server re-validates the same rules —
 * client-side validation is a convenience, never the authority.
 */
export interface CouponRule {
  code: string;
  label: string;
  /** Flat amount in paise, or a percentage of the qualifying subtotal. */
  kind: 'flat' | 'percent' | 'free-shipping';
  value: number;
  maxDiscount?: Paise;
  minCart?: Paise;
  categories?: CategorySlug[];
  description: string;
  /**
   * One redemption per customer, ever.
   *
   * Enforced server-side at order placement against `coupon_redemptions`,
   * never here: this module is deliberately client-safe so the cart can
   * validate without a round trip, and the browser cannot be trusted to say
   * whether somebody has used a code before.
   */
  oncePerCustomer?: boolean;
}

export const COUPONS: CouponRule[] = [
  {
    code: 'COMBO1500',
    label: '₹1,500 off combos',
    kind: 'flat',
    value: 150000,
    minCart: 2000000,
    categories: ['combos'],
    description: 'Applies to inverter + battery combos on orders above ₹20,000.',
  },
  {
    code: 'LIFE2000',
    label: '₹2,000 off lithium batteries',
    kind: 'flat',
    value: 200000,
    categories: ['batteries'],
    description: 'Applies when your cart includes an iTarang LiFe series battery.',
  },
  {
    code: 'FIRST5',
    label: '5% off your first order',
    kind: 'percent',
    value: 5,
    maxDiscount: 200000,
    // The code says "first order" and nothing used to enforce it, so it was
    // reusable without limit on every order a customer ever placed.
    oncePerCustomer: true,
    description: '5% off the cart, capped at ₹2,000. One use per customer.',
  },
  {
    code: 'FREESHIP',
    label: 'Free delivery',
    kind: 'free-shipping',
    value: 0,
    description: 'Waives the standard delivery charge on any order.',
  },
];

/** The rule behind a code, if there is one. */
export function couponRule(code: string): CouponRule | undefined {
  const normalised = code.trim().toUpperCase();
  return COUPONS.find((rule) => rule.code === normalised);
}

export type CouponResult =
  | { ok: true; coupon: AppliedCoupon }
  | { ok: false; reason: string };

export function validateCoupon(code: string, items: CartItem[]): CouponResult {
  const normalised = code.trim().toUpperCase();
  if (!normalised) return { ok: false, reason: 'Enter a coupon code.' };

  const rule = COUPONS.find((c) => c.code === normalised);
  if (!rule) return { ok: false, reason: `“${normalised}” is not a valid code.` };

  if (items.length === 0) return { ok: false, reason: 'Add something to your cart first.' };

  const qualifying = rule.categories
    ? items.filter((i) => rule.categories!.includes(i.category))
    : items;

  if (qualifying.length === 0) {
    return {
      ok: false,
      reason: `${normalised} applies only to ${rule.categories?.join(', ')}.`,
    };
  }

  const qualifyingSubtotal = qualifying.reduce((sum, i) => sum + i.price.selling * i.quantity, 0);

  if (rule.minCart && qualifyingSubtotal < rule.minCart) {
    const shortfall = Math.round((rule.minCart - qualifyingSubtotal) / 100);
    return {
      ok: false,
      reason: `Add ₹${shortfall.toLocaleString('en-IN')} more of eligible products to use ${normalised}.`,
    };
  }

  let discount = 0;
  if (rule.kind === 'flat') discount = rule.value;
  else if (rule.kind === 'percent') discount = Math.round((qualifyingSubtotal * rule.value) / 100);
  else discount = 0; // free-shipping is applied by the totals calculation

  if (rule.maxDiscount) discount = Math.min(discount, rule.maxDiscount);
  discount = Math.min(discount, qualifyingSubtotal);

  return {
    ok: true,
    coupon: {
      code: rule.code,
      label: rule.label,
      discount,
      freeShipping: rule.kind === 'free-shipping',
    },
  };
}
