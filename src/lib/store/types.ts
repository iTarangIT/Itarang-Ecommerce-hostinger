import type { CategorySlug, Paise, Price } from '@/lib/commerce/types';

export interface CartItem {
  /** Variant id — the unit of the cart. */
  id: string;
  productId: string;
  slug: string;
  title: string;
  /** Variant label, omitted for single-variant products. */
  variantTitle?: string;
  image: string;
  price: Price;
  quantity: number;
  /** Stock ceiling for the quantity stepper. */
  maxQuantity: number;
  category: CategorySlug;
  installationIncluded: boolean;
}

export interface AppliedCoupon {
  code: string;
  label: string;
  discount: Paise;
  /** Waives the delivery charge regardless of cart value. */
  freeShipping?: boolean;
}

export interface CartState {
  items: CartItem[];
  savedForLater: CartItem[];
  coupon: AppliedCoupon | null;
  gstin: string;
}

export interface StoreState {
  cart: CartState;
  compare: string[];
  wishlist: string[];
  /**
   * Which account this browser has already folded its local wishlist into.
   *
   * `null` means "not yet merged for anyone". It is the difference between a
   * merge that happens once and one that happens on every page load — and the
   * second kind resurrects items. Device A holds `[p1, p2]` locally, the
   * customer removes `p2` on device B, then device A loads again and re-sends
   * its stale copy: `p2` comes back, and keeps coming back, and the customer
   * cannot delete it. The marker is what makes the local list a one-time
   * contribution rather than a permanent second opinion.
   *
   * Cleared on sign-out along with the list itself, so the next person on a
   * shared device does not inherit either.
   */
  wishlistSyncedFor: number | null;
  recentlyViewed: string[];
  hydrated: boolean;
}

export const MAX_COMPARE = 4;
export const MAX_RECENTLY_VIEWED = 8;

/**
 * The most products one browser will keep in a wishlist.
 *
 * Mirrors `MAX_WISHLIST_ITEMS` on the server. Bounded here too because the
 * local list is what gets sent up to be merged, and because it is serialised
 * into a query string when the cards are fetched.
 */
export const MAX_WISHLIST = 200;

export const EMPTY_STATE: StoreState = {
  cart: { items: [], savedForLater: [], coupon: null, gstin: '' },
  compare: [],
  wishlist: [],
  wishlistSyncedFor: null,
  recentlyViewed: [],
  hydrated: false,
};
