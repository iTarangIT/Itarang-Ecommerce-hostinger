'use client';

import * as React from 'react';
import type { AppliedCoupon, CartItem, StoreState } from './types';
import { EMPTY_STATE, MAX_COMPARE, MAX_RECENTLY_VIEWED } from './types';
import { calculateTotals, type CartTotals } from './totals';

/**
 * Client-side shopping state.
 *
 * Phase 1 persists to localStorage. When accounts land, this same reducer is
 * the merge target for a server-side cart — components consume the hooks, not
 * the storage layer.
 */

const STORAGE_KEY = 'itarang.store.v1';

type Action =
  | { type: 'hydrate'; payload: StoreState }
  | { type: 'cart/add'; item: CartItem }
  | { type: 'cart/remove'; id: string }
  | { type: 'cart/setQuantity'; id: string; quantity: number }
  | { type: 'cart/clear' }
  | { type: 'cart/save'; id: string }
  | { type: 'cart/restore'; id: string }
  | { type: 'cart/removeSaved'; id: string }
  | { type: 'cart/coupon'; coupon: AppliedCoupon | null }
  | { type: 'cart/gstin'; gstin: string }
  | { type: 'compare/toggle'; productId: string }
  | { type: 'compare/clear' }
  | { type: 'wishlist/toggle'; productId: string }
  | { type: 'recent/push'; slug: string };

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case 'hydrate':
      return { ...action.payload, hydrated: true };

    case 'cart/add': {
      const existing = state.cart.items.find((i) => i.id === action.item.id);
      const items = existing
        ? state.cart.items.map((i) =>
            i.id === action.item.id
              ? { ...i, quantity: Math.min(i.maxQuantity, i.quantity + action.item.quantity) }
              : i,
          )
        : [...state.cart.items, action.item];
      return { ...state, cart: { ...state.cart, items } };
    }

    case 'cart/remove':
      return {
        ...state,
        cart: { ...state.cart, items: state.cart.items.filter((i) => i.id !== action.id) },
      };

    case 'cart/setQuantity': {
      if (action.quantity <= 0) {
        return {
          ...state,
          cart: { ...state.cart, items: state.cart.items.filter((i) => i.id !== action.id) },
        };
      }
      return {
        ...state,
        cart: {
          ...state.cart,
          items: state.cart.items.map((i) =>
            i.id === action.id
              ? { ...i, quantity: Math.min(i.maxQuantity, action.quantity) }
              : i,
          ),
        },
      };
    }

    case 'cart/clear':
      return { ...state, cart: { ...state.cart, items: [], coupon: null } };

    case 'cart/save': {
      const item = state.cart.items.find((i) => i.id === action.id);
      if (!item) return state;
      return {
        ...state,
        cart: {
          ...state.cart,
          items: state.cart.items.filter((i) => i.id !== action.id),
          savedForLater: [item, ...state.cart.savedForLater.filter((i) => i.id !== action.id)],
        },
      };
    }

    case 'cart/restore': {
      const item = state.cart.savedForLater.find((i) => i.id === action.id);
      if (!item) return state;
      return {
        ...state,
        cart: {
          ...state.cart,
          items: [...state.cart.items, item],
          savedForLater: state.cart.savedForLater.filter((i) => i.id !== action.id),
        },
      };
    }

    case 'cart/removeSaved':
      return {
        ...state,
        cart: {
          ...state.cart,
          savedForLater: state.cart.savedForLater.filter((i) => i.id !== action.id),
        },
      };

    case 'cart/coupon':
      return { ...state, cart: { ...state.cart, coupon: action.coupon } };

    case 'cart/gstin':
      return { ...state, cart: { ...state.cart, gstin: action.gstin } };

    case 'compare/toggle': {
      const has = state.compare.includes(action.productId);
      if (has) return { ...state, compare: state.compare.filter((id) => id !== action.productId) };
      if (state.compare.length >= MAX_COMPARE) return state;
      return { ...state, compare: [...state.compare, action.productId] };
    }

    case 'compare/clear':
      return { ...state, compare: [] };

    case 'wishlist/toggle':
      return {
        ...state,
        wishlist: state.wishlist.includes(action.productId)
          ? state.wishlist.filter((id) => id !== action.productId)
          : [action.productId, ...state.wishlist],
      };

    case 'recent/push':
      return {
        ...state,
        recentlyViewed: [
          action.slug,
          ...state.recentlyViewed.filter((s) => s !== action.slug),
        ].slice(0, MAX_RECENTLY_VIEWED),
      };

    default:
      return state;
  }
}

/* ---------------------------------------------------------------- context */

interface StoreContextValue {
  state: StoreState;
  dispatch: React.Dispatch<Action>;
  totals: CartTotals;
}

const StoreContext = React.createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, EMPTY_STATE);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoreState>;
        dispatch({
          type: 'hydrate',
          payload: {
            ...EMPTY_STATE,
            ...parsed,
            cart: { ...EMPTY_STATE.cart, ...(parsed.cart ?? {}) },
          },
        });
        return;
      }
    } catch {
      // Corrupt or unavailable storage: start clean rather than blocking the app.
    }
    dispatch({ type: 'hydrate', payload: EMPTY_STATE });
  }, []);

  React.useEffect(() => {
    if (!state.hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, hydrated: undefined }));
    } catch {
      // Storage full or blocked — state still works for this session.
    }
  }, [state]);

  const totals = React.useMemo(
    () => calculateTotals(state.cart.items, state.cart.coupon),
    [state.cart.items, state.cart.coupon],
  );

  const value = React.useMemo(() => ({ state, dispatch, totals }), [state, totals]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
