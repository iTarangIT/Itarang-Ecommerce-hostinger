'use client';

import * as React from 'react';
import type { Product, ProductVariant } from '@/lib/commerce/types';
import type { ProductSummary } from '@/lib/commerce/summary';
import {
  addWishlistItemAction,
  removeWishlistItemAction,
} from '@/lib/account/wishlist-actions';
import { useStore } from './store-provider';
import { MAX_COMPARE } from './types';
import type { AppliedCoupon, CartItem } from './types';

export function toCartItem(
  product: Product,
  variant: ProductVariant,
  quantity: number,
): CartItem {
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

/** Cart line built from a card-sized summary (grids, rails, cross-sell). */
export function summaryToCartItem(summary: ProductSummary, quantity = 1): CartItem {
  return {
    id: summary.defaultVariantId,
    productId: summary.id,
    slug: summary.slug,
    title: summary.title,
    image: summary.image,
    price: { mrp: summary.mrp, selling: summary.price },
    quantity,
    maxQuantity: Math.max(1, summary.stock),
    category: summary.category,
    installationIncluded: summary.installationIncluded,
  };
}

export function useCart() {
  const { state, dispatch, totals } = useStore();

  return React.useMemo(
    () => ({
      items: state.cart.items,
      savedForLater: state.cart.savedForLater,
      coupon: state.cart.coupon,
      gstin: state.cart.gstin,
      totals,
      hydrated: state.hydrated,
      isInCart: (variantId: string) => state.cart.items.some((i) => i.id === variantId),
      add: (product: Product, variant: ProductVariant, quantity = 1) =>
        dispatch({ type: 'cart/add', item: toCartItem(product, variant, quantity) }),
      addItem: (item: CartItem) => dispatch({ type: 'cart/add', item }),
      remove: (id: string) => dispatch({ type: 'cart/remove', id }),
      setQuantity: (id: string, quantity: number) =>
        dispatch({ type: 'cart/setQuantity', id, quantity }),
      clear: () => dispatch({ type: 'cart/clear' }),
      saveForLater: (id: string) => dispatch({ type: 'cart/save', id }),
      moveToCart: (id: string) => dispatch({ type: 'cart/restore', id }),
      removeSaved: (id: string) => dispatch({ type: 'cart/removeSaved', id }),
      applyCoupon: (coupon: AppliedCoupon | null) => dispatch({ type: 'cart/coupon', coupon }),
      setGstin: (gstin: string) => dispatch({ type: 'cart/gstin', gstin }),
    }),
    [state.cart, state.hydrated, totals, dispatch],
  );
}

export function useCompare() {
  const { state, dispatch } = useStore();

  return React.useMemo(
    () => ({
      ids: state.compare,
      isFull: state.compare.length >= MAX_COMPARE,
      max: MAX_COMPARE,
      has: (productId: string) => state.compare.includes(productId),
      toggle: (productId: string) => dispatch({ type: 'compare/toggle', productId }),
      clear: () => dispatch({ type: 'compare/clear' }),
    }),
    [state.compare, dispatch],
  );
}

/**
 * Saved products.
 *
 * Local state is updated first and the server is told afterwards, so a heart
 * fills in the instant it is tapped rather than after a round trip. That is not
 * only a nicety: the wishlist has to keep working signed out, where there is no
 * server to wait for, so the local list is the one path that always exists and
 * the server call is the addition.
 *
 * The server call is deliberately fire-and-forget. It answers `signedIn: false`
 * for a visitor with no account, in which case there is nothing to do and the
 * local list stands on its own; and if it fails outright, the customer still
 * sees what they saved. `<WishlistSync />` reconciles from the server on the
 * next page load, so a dropped write costs one refresh, not a lost product.
 */
export function useWishlist() {
  const { state, dispatch } = useStore();
  const syncedFor = state.wishlistSyncedFor;

  return React.useMemo(() => {
    const persist = (productId: string, saving: boolean) => {
      // Only when this browser knows it is signed in. Signed out there is no
      // account to write to, and calling anyway would be a wasted request on
      // every heart tap by every visitor.
      if (syncedFor === null) return;
      void (saving
        ? addWishlistItemAction(productId)
        : removeWishlistItemAction(productId)
      ).catch(() => {
        /* Reconciled by <WishlistSync /> on the next load. */
      });
    };

    return {
      ids: state.wishlist,
      hydrated: state.hydrated,
      has: (productId: string) => state.wishlist.includes(productId),
      toggle: (productId: string) => {
        const saving = !state.wishlist.includes(productId);
        dispatch({ type: 'wishlist/toggle', productId });
        persist(productId, saving);
      },
      remove: (productId: string) => {
        if (!state.wishlist.includes(productId)) return;
        dispatch({ type: 'wishlist/toggle', productId });
        persist(productId, false);
      },
    };
  }, [state.wishlist, state.hydrated, syncedFor, dispatch]);
}

/**
 * Drop the signed-in account's saved products from this browser.
 *
 * Called as part of signing out. `logoutAction` redirects with a *client-side*
 * navigation, so the app never remounts and `<WishlistSync />` — whose effect
 * runs once per full page load — would not fire again. Without this, one
 * customer's saved products would stay on screen for whoever used the device
 * next, which on a shared or borrowed machine is exactly the thing "sign out"
 * is supposed to prevent.
 *
 * Clears the marker as well as the list, so the next person to sign in gets a
 * clean first merge rather than inheriting a stale one.
 */
export function useForgetWishlist() {
  const { dispatch } = useStore();
  return React.useCallback(() => dispatch({ type: 'wishlist/forget' }), [dispatch]);
}

export function useRecentlyViewed() {
  const { state, dispatch } = useStore();
  return React.useMemo(
    () => ({
      slugs: state.recentlyViewed,
      hydrated: state.hydrated,
      push: (slug: string) => dispatch({ type: 'recent/push', slug }),
    }),
    [state.recentlyViewed, state.hydrated, dispatch],
  );
}
