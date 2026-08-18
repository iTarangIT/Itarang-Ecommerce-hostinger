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
  recentlyViewed: string[];
  hydrated: boolean;
}

export const MAX_COMPARE = 4;
export const MAX_RECENTLY_VIEWED = 8;

export const EMPTY_STATE: StoreState = {
  cart: { items: [], savedForLater: [], coupon: null, gstin: '' },
  compare: [],
  wishlist: [],
  recentlyViewed: [],
  hydrated: false,
};
