import { describe, expect, it } from 'vitest';
import { EMPTY_STATE, MAX_WISHLIST } from './types';
import { MAX_WISHLIST_ITEMS } from '@/lib/account/wishlist';

/**
 * The client half of the wishlist contract.
 *
 * The reducer itself is not exported — it is an implementation detail of
 * `StoreProvider` — so what is asserted here is the shape and the bounds the
 * server and the browser have to agree on. The behaviour that needs a database
 * (merge, ownership, the sync marker's effect) is covered in
 * `wishlist-actions.integration.test.ts`.
 */

describe('wishlist client state', () => {
  it('starts with nothing saved and no account synced', () => {
    expect(EMPTY_STATE.wishlist).toEqual([]);
    // Null is what tells `useWishlist` there is no account to write to, and
    // what tells `<WishlistSync />` the next merge is a first merge.
    expect(EMPTY_STATE.wishlistSyncedFor).toBeNull();
  });

  it('bounds the local list to the same size the server allows', () => {
    // If the browser could hold more than the server accepts, the extra saves
    // would be silently dropped on merge — the customer would see items
    // disappear on sign-in with nothing to explain it.
    expect(MAX_WISHLIST).toBe(MAX_WISHLIST_ITEMS);
  });

  it('allows a list far larger than the old 24-item API ceiling', () => {
    // That cap lived in `/api/products` and not in the wishlist, which is
    // exactly why the grid and the header badge disagreed.
    expect(MAX_WISHLIST).toBeGreaterThan(24);
  });
});
