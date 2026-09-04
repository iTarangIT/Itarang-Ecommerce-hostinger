import { query } from '@/lib/db/pool';

/**
 * The server-backed wishlist.
 *
 * Data access only — no session reading, no policy about who may call it.
 * `wishlist-actions.ts` owns that, the same split `addresses.ts` uses.
 *
 * **Every function takes `userId` and every statement filters on it**, for the
 * same reason as the address book: ownership belongs in the WHERE clause, not
 * in an `if` after the read. There is no function here that can return or
 * modify a row without being told whose it is, so forgetting a check is not a
 * mistake the shape of this module allows.
 *
 * Ids are the catalogue's own `Product.id`. Nothing here resolves them against
 * the catalogue — see `listWishlist` for why that separation matters.
 */

/**
 * How many products one customer may keep.
 *
 * Not a business rule so much as a bound: an unbounded list is an unbounded
 * insert loop for anyone with a session, and an unbounded `?ids=` query string
 * afterwards. Generous enough that no real shopper meets it.
 */
export const MAX_WISHLIST_ITEMS = 200;

export class WishlistFullError extends Error {
  constructor() {
    super(`A wishlist holds up to ${MAX_WISHLIST_ITEMS} products.`);
    this.name = 'WishlistFullError';
  }
}

/**
 * The product ids this customer has saved, newest first.
 *
 * Returns ids, not products, and that is deliberate. Resolving them against the
 * catalogue is the caller's job because the catalogue is provider-dependent and
 * may not know an id at all — a product that was unpublished, withdrawn, or
 * saved while a different `COMMERCE_PROVIDER` was active. Keeping the two apart
 * means an unresolvable id is a rendering decision rather than a query that
 * fails or a row that gets deleted behind the customer's back.
 */
export async function listWishlist(userId: number): Promise<string[]> {
  const rows = await query<{ product_id: string }>(
    `SELECT product_id FROM wishlist_items
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map((row) => row.product_id);
}

export async function countWishlist(userId: number): Promise<number> {
  const rows = await query<{ n: string }>(
    `SELECT count(*) AS n FROM wishlist_items WHERE user_id = $1`,
    [userId],
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Save one product. Saving something already saved is a no-op, not an error.
 *
 * `ON CONFLICT DO NOTHING` against the primary key, so the "already there" case
 * is settled by the database rather than by a read followed by a write that
 * could race with itself. A heart tapped twice quickly cannot produce two rows.
 */
export async function addToWishlist(userId: number, productId: string): Promise<void> {
  const id = productId.trim();
  if (!id) return;

  // Counted before inserting rather than enforced by a trigger: the limit is a
  // guard against abuse, not an invariant worth paying for on every write.
  if ((await countWishlist(userId)) >= MAX_WISHLIST_ITEMS) {
    const existing = await query<{ product_id: string }>(
      `SELECT product_id FROM wishlist_items WHERE user_id = $1 AND product_id = $2`,
      [userId, id],
    );
    // Re-saving something already in a full list is still a no-op, not a
    // refusal — the list does not grow, so there is nothing to refuse.
    if (existing.length === 0) throw new WishlistFullError();
    return;
  }

  await query(
    `INSERT INTO wishlist_items (user_id, product_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, product_id) DO NOTHING`,
    [userId, id],
  );
}

/**
 * Remove one product.
 *
 * Returns whether a row went. Removing something that is not there is `false`
 * rather than an error — which is also the answer for a product id belonging to
 * somebody else's wishlist, and deliberately indistinguishable from it.
 */
export async function removeFromWishlist(userId: number, productId: string): Promise<boolean> {
  const rows = await query<{ product_id: string }>(
    `DELETE FROM wishlist_items
      WHERE user_id = $1 AND product_id = $2
      RETURNING product_id`,
    [userId, productId.trim()],
  );
  return rows.length > 0;
}

/**
 * Fold a browser's local wishlist into the account's.
 *
 * Additive and idempotent: `ON CONFLICT DO NOTHING` means running it twice
 * changes nothing, and it never removes. That matters because the merge is
 * driven by a client that may retry, and because a customer who saved items on
 * two devices before signing in should end up with both sets rather than
 * whichever one synced last.
 *
 * Deliberately does **not** delete anything the server already holds. The
 * client's local list is not authoritative — treating it as a replacement is
 * exactly how an item removed on one device gets resurrected by another.
 *
 * Returns the full list afterwards, so the caller has one round trip.
 */
export async function mergeWishlist(userId: number, productIds: string[]): Promise<string[]> {
  const ids = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))].slice(
    0,
    MAX_WISHLIST_ITEMS,
  );

  if (ids.length > 0) {
    const room = MAX_WISHLIST_ITEMS - (await countWishlist(userId));
    if (room > 0) {
      // One statement rather than a loop: `unnest` expands the array into rows,
      // so a fifty-item merge is a single round trip to a remote database.
      await query(
        `INSERT INTO wishlist_items (user_id, product_id)
         SELECT $1, id FROM unnest($2::text[]) AS id
         ON CONFLICT (user_id, product_id) DO NOTHING`,
        [userId, ids.slice(0, room)],
      );
    }
  }

  return listWishlist(userId);
}

/** Empty the account's wishlist. Used by tests and account deletion, not by the UI. */
export async function clearWishlist(userId: number): Promise<void> {
  await query(`DELETE FROM wishlist_items WHERE user_id = $1`, [userId]);
}
