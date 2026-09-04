'use server';

import { z } from 'zod';
import { currentUser } from '@/lib/auth/session';
import { LIMITS, consume } from '@/lib/security/rate-limit';
import {
  MAX_WISHLIST_ITEMS,
  WishlistFullError,
  addToWishlist,
  listWishlist,
  mergeWishlist,
  removeFromWishlist,
} from './wishlist';

/**
 * The wishlist, as Server Actions.
 *
 * **Identity comes from `currentUser()` on every call and from nowhere else.**
 * No action here takes a user id, and there is no parameter a caller could set
 * to act on another account. The only thing the client sends is which product,
 * and the data layer scopes every statement by the session's own id — so a
 * request naming somebody else's product simply operates on the caller's own
 * (empty) row and reports nothing.
 *
 * Signed-out callers are answered, not refused. The wishlist works without an
 * account — it lives in localStorage — so these actions return
 * `signedIn: false` and let the client carry on locally rather than throwing an
 * error onto a page where saving a product is supposed to be a heart that fills
 * in. Nothing is written in that case.
 */

export interface WishlistResult {
  signedIn: boolean;
  /** The account's full list, or null when signed out and nothing was read. */
  ids: string[] | null;
  /** The account this list belongs to, so the client can mark itself synced. */
  userId: number | null;
  error?: string;
}

const SIGNED_OUT: WishlistResult = { signedIn: false, ids: null, userId: null };

/** A product id is an opaque catalogue key; length is the only shape we know. */
const productIdSchema = z.string().trim().min(1).max(200);

const localIdsSchema = z.array(productIdSchema).max(MAX_WISHLIST_ITEMS);

/**
 * Read the account's wishlist, folding in anything saved locally first.
 *
 * Called once per page load by `<WishlistSync />`. The two jobs are one action
 * because they are one round trip: "who am I, what have I saved, and take these
 * while you are there".
 *
 * `alreadySyncedFor` is the client's own record of which account this browser
 * has already merged into. It decides **whether to merge**, never who the
 * caller is — a client that lies about it can only cause its own local ids to
 * be folded into its own wishlist, which is what the merge does anyway. It is
 * compared against the session's id, so it cannot select a different account.
 */
export async function syncWishlistAction(input: {
  localIds: string[];
  alreadySyncedFor: number | null;
}): Promise<WishlistResult> {
  const user = await currentUser();
  if (!user) return SIGNED_OUT;

  const limit = await consume(`wishlist:${user.id}`, LIMITS.accountUpdate);
  if (!limit.allowed) {
    // Throttled reads fall back to whatever the browser already has rather than
    // blanking a list the customer can see.
    return { signedIn: true, ids: null, userId: user.id, error: 'Please try again in a moment.' };
  }

  const parsed = localIdsSchema.safeParse(input.localIds);
  const localIds = parsed.success ? parsed.data : [];

  // Merge only on the first sign-in for this browser and account. Without this
  // guard a stale local copy would be re-sent on every load, and an item the
  // customer removed on another device would keep coming back — a deletion
  // that will not stay deleted.
  const firstTimeForThisAccount = input.alreadySyncedFor !== user.id;

  const ids =
    firstTimeForThisAccount && localIds.length > 0
      ? await mergeWishlist(user.id, localIds)
      : await listWishlist(user.id);

  return { signedIn: true, ids, userId: user.id };
}

export async function addWishlistItemAction(productId: string): Promise<WishlistResult> {
  const user = await currentUser();
  if (!user) return SIGNED_OUT;

  const limit = await consume(`wishlist:${user.id}`, LIMITS.accountUpdate);
  if (!limit.allowed) {
    return { signedIn: true, ids: null, userId: user.id, error: 'Please try again in a moment.' };
  }

  const parsed = productIdSchema.safeParse(productId);
  if (!parsed.success) {
    return { signedIn: true, ids: null, userId: user.id, error: 'That product could not be saved.' };
  }

  try {
    await addToWishlist(user.id, parsed.data);
  } catch (error) {
    if (error instanceof WishlistFullError) {
      return { signedIn: true, ids: await listWishlist(user.id), userId: user.id, error: error.message };
    }
    throw error;
  }

  return { signedIn: true, ids: await listWishlist(user.id), userId: user.id };
}

export async function removeWishlistItemAction(productId: string): Promise<WishlistResult> {
  const user = await currentUser();
  if (!user) return SIGNED_OUT;

  const limit = await consume(`wishlist:${user.id}`, LIMITS.accountUpdate);
  if (!limit.allowed) {
    return { signedIn: true, ids: null, userId: user.id, error: 'Please try again in a moment.' };
  }

  const parsed = productIdSchema.safeParse(productId);
  if (!parsed.success) {
    return { signedIn: true, ids: await listWishlist(user.id), userId: user.id };
  }

  // Scoped by `user_id` in SQL. Another account's saved product matches
  // nothing, which is the same answer as a product that was never saved.
  await removeFromWishlist(user.id, parsed.data);

  return { signedIn: true, ids: await listWishlist(user.id), userId: user.id };
}
