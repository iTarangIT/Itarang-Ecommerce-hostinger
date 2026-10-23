import type { CategorySlug, Paise } from '@/lib/commerce/types';
import { categoryName, subcategoryName } from '@/lib/catalog/category-names';
import type { AppliedCoupon, CartItem } from '@/lib/store/types';

/**
 * Coupon rules.
 *
 * Small and client-safe by design so the cart can validate instantly without a
 * round trip. When checkout is built, the server re-validates the same rules —
 * client-side validation is a convenience, never the authority.
 */

/**
 * The master switch, kept as one constant so there is one thing to flip.
 *
 * **On**, with the two codes the business specified (Website changes, Oct
 * 2026): WELCOME1000 on home inverter batteries and WELCOME2000 on 3-wheeler
 * batteries. Everything else that used to be here was a placeholder and is gone.
 *
 * Annotated `boolean` rather than left as a literal so the compiler does not
 * narrow either branch to unreachable code. The single choke point is
 * `validateCoupon` below — the cart field and the server quote both go through
 * it, so flipping this off again stops every code everywhere at once.
 */
export const COUPONS_ENABLED: boolean = true;

/**
 * Extra discount for paying by UPI, in paise.
 *
 * Not a coupon: it needs no code and stacks with one. Applied by `buildQuote`
 * only when the shopper picks UPI, and the payment window then opens on UPI
 * alone, so the discount cannot be claimed and paid by card.
 */
export const UPI_DISCOUNT: Paise = 20000;

/** What a shopper is told where the coupon field would be. */
export const COUPONS_DISABLED_NOTE = 'Coupon codes are not active at the moment.';
export interface CouponRule {
  code: string;
  label: string;
  /** Flat amount in paise, or a percentage of the qualifying subtotal. */
  kind: 'flat' | 'percent' | 'free-shipping';
  value: number;
  maxDiscount?: Paise;
  minCart?: Paise;
  categories?: CategorySlug[];
  /** Narrower than `categories`: the code applies only to these subcategories. */
  subcategories?: string[];
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
    code: 'WELCOME1000',
    label: '₹1,000 off home inverter batteries',
    kind: 'flat',
    value: 100000,
    subcategories: ['home-inverter'],
    oncePerCustomer: true,
    description: '₹1,000 off when your cart includes a home inverter battery. One use per customer.',
  },
  {
    code: 'WELCOME2000',
    label: '₹2,000 off 3-wheeler batteries',
    kind: 'flat',
    value: 200000,
    subcategories: ['ev-3-wheeler'],
    oncePerCustomer: true,
    description:
      '₹2,000 off when your cart includes a 3-wheeler or e-rickshaw battery. One use per customer.',
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

/**
 * The one place a code is turned into a discount.
 *
 * Both the cart field and `buildQuote` call it, which is why the master switch
 * is tested here rather than in either of them: a surface that forgot the check
 * would otherwise be able to apply a discount the server would then honour.
 * Checked before the code is even looked up, so a disabled build cannot be
 * probed for which codes exist.
 */
/**
 * `rules` defaults to the built-in list for the unit tests and the fallback;
 * at checkout the server passes the campaign loaded from the `campaigns`
 * table (see `campaign-store.ts`), and this decides only what it takes off.
 */
export function validateCoupon(
  code: string,
  items: CartItem[],
  rules: readonly CouponRule[] = COUPONS,
): CouponResult {
  if (!COUPONS_ENABLED) return { ok: false, reason: COUPONS_DISABLED_NOTE };

  const normalised = code.trim().toUpperCase();
  if (!normalised) return { ok: false, reason: 'Enter a coupon code.' };

  const rule = rules.find((c) => c.code === normalised);
  if (!rule) return { ok: false, reason: `“${normalised}” is not a valid code.` };

  if (items.length === 0) return { ok: false, reason: 'Add something to your cart first.' };

  const qualifying = items.filter(
    (i) =>
      (!rule.categories || rule.categories.includes(i.category)) &&
      (!rule.subcategories || (i.subcategory !== undefined && rule.subcategories.includes(i.subcategory))),
  );

  if (qualifying.length === 0) {
    const scope = rule.subcategories
      ? rule.subcategories.map((slug) => subcategoryName(slug).toLowerCase()).join(' or ')
      : rule.categories
        ? rule.categories.map((slug) => categoryName(slug).toLowerCase()).join(', ')
        : 'eligible products';
    return { ok: false, reason: `${normalised} applies only to ${scope}.` };
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
