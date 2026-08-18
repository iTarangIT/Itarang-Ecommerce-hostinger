'use client';

import * as React from 'react';
import type { Product, ProductVariant } from '@/lib/commerce/types';
import type { ProductSummary } from '@/lib/commerce/summary';
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

export function useWishlist() {
  const { state, dispatch } = useStore();

  return React.useMemo(
    () => ({
      ids: state.wishlist,
      has: (productId: string) => state.wishlist.includes(productId),
      toggle: (productId: string) => dispatch({ type: 'wishlist/toggle', productId }),
    }),
    [state.wishlist, dispatch],
  );
}

export function useRecentlyViewed() {
  const { state, dispatch } = useStore();
  return React.useMemo(
    () => ({
      slugs: state.recentlyViewed,
      push: (slug: string) => dispatch({ type: 'recent/push', slug }),
    }),
    [state.recentlyViewed, dispatch],
  );
}
