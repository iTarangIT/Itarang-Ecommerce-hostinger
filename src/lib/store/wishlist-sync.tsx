'use client';

import * as React from 'react';
import { syncWishlistAction } from '@/lib/account/wishlist-actions';
import { useStore } from './store-provider';

/**
 * Reconciles this browser's wishlist with the signed-in account's.
 *
 * Mounted once inside `StoreProvider`, so it runs on a full page load and not
 * on every client-side navigation.
 *
 * **Why it asks the server instead of being told.** The obvious alternative is
 * to read `currentUser()` in the root layout and pass the id down. That would
 * make the root layout read cookies, which makes every route under it dynamic —
 * and `/products/[slug]` is statically generated today. Trading the catalogue's
 * static rendering for one id is a bad bargain, so the question is asked from
 * the client instead and the session answers it.
 *
 * What happens on each outcome:
 *
 * - **signed out** — nothing. The local list is the whole wishlist, exactly as
 *   before accounts existed. `wishlistSyncedFor` stays null, which is also what
 *   stops `useWishlist` making pointless server calls for a visitor.
 * - **signed in, first time for this account** — the local ids are folded in
 *   (additively, never as a replacement) and the merged list comes back.
 * - **signed in, already synced** — the server list is read and replaces the
 *   local copy, so a product saved on a phone shows up on a laptop.
 *
 * The one-time part is the marker, and it is the whole reason a removal stays
 * removed. Without it this component would re-offer a stale local list on every
 * load, and an item deleted on another device would reappear each time.
 */
export function WishlistSync() {
  const { state, dispatch } = useStore();
  const { hydrated, wishlist, wishlistSyncedFor } = state;

  // Read through a ref so the effect does not re-run when the list changes —
  // it should fire once per load, not after every heart tap.
  const snapshot = React.useRef({ wishlist, wishlistSyncedFor });
  snapshot.current = { wishlist, wishlistSyncedFor };

  React.useEffect(() => {
    // Before hydration the store still holds EMPTY_STATE, so syncing now would
    // send an empty local list and could clear a wishlist that is about to load
    // from localStorage.
    if (!hydrated) return;

    let cancelled = false;

    void syncWishlistAction({
      localIds: snapshot.current.wishlist,
      alreadySyncedFor: snapshot.current.wishlistSyncedFor,
    })
      .then((result) => {
        if (cancelled) return;

        if (!result.signedIn) {
          // Signed out now, but this browser was signed in before: drop the
          // account's list rather than leaving one customer's saved products
          // visible to whoever uses the device next.
          if (snapshot.current.wishlistSyncedFor !== null) {
            dispatch({ type: 'wishlist/forget' });
          }
          return;
        }

        // `ids` is null when the read was throttled. Keep what is on screen.
        if (result.ids && result.userId !== null) {
          dispatch({ type: 'wishlist/replace', ids: result.ids, syncedFor: result.userId });
        }
      })
      .catch(() => {
        /* Offline or a failed action: the local list keeps working. */
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, dispatch]);

  return null;
}
