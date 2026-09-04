import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { hashPassword } from '@/lib/auth/password';
import { createUser } from '@/lib/auth/users';
import {
  MAX_WISHLIST_ITEMS,
  WishlistFullError,
  addToWishlist,
  clearWishlist,
  countWishlist,
  listWishlist,
  mergeWishlist,
  removeFromWishlist,
} from './wishlist';

/**
 * The server-backed wishlist against a live PostgreSQL.
 *
 * Two things can only be shown here: that one customer's statements can never
 * reach another's rows, which is a property of a WHERE clause; and that a
 * duplicate is impossible rather than merely avoided, which is a property of a
 * primary key.
 *
 * Rows hang off users with an `@wishlist.invalid` address and the delete
 * cascades, so cleanup is one statement.
 */

function targetsRemote(): boolean {
  const raw = process.env.DATABASE_URL;
  if (!raw) return false;
  try {
    return !isLocalHost(inspectDatabaseUrl(raw).host);
  } catch {
    return false;
  }
}

const REMOTE = targetsRemote();
const CONFIGURED =
  Boolean(process.env.DATABASE_URL) && (!REMOTE || process.env.DB_ALLOW_REMOTE_TESTS === 'true');

if (!CONFIGURED) {
  console.warn('\n  [skipped] Wishlist tests need DATABASE_URL and DB_ALLOW_REMOTE_TESTS.\n');
}

const DB_TIMEOUT = 30_000;
const DOMAIN = '@wishlist.invalid';

/** Real catalogue keys, so the ids under test are the shape the store holds. */
const POWERCUBE = 'trontek-tk12100';
const TK_LIFE = 'trontek-tk-life-5145';

async function makeCustomer(tag: string) {
  const user = await createUser({
    email: `${tag}${DOMAIN}`,
    passwordHash: hashPassword('irrelevant to these tests'),
    role: 'customer',
  });
  return user!;
}

describe.skipIf(!CONFIGURED)('the server-backed wishlist', () => {
  beforeEach(async () => {
    await query(`DELETE FROM users WHERE email LIKE $1`, [`%${DOMAIN}`]);
  });

  afterAll(async () => {
    await query(`DELETE FROM users WHERE email LIKE $1`, [`%${DOMAIN}`]);
    await closePool();
  });

  /* --------------------------------------------------------------- basics */

  it(
    'saves a product and lists it back',
    async () => {
      const user = await makeCustomer('basic');
      await addToWishlist(user.id, POWERCUBE);

      expect(await listWishlist(user.id)).toEqual([POWERCUBE]);
      expect(await countWishlist(user.id)).toBe(1);
    },
    DB_TIMEOUT,
  );

  it(
    'removes a product',
    async () => {
      const user = await makeCustomer('remove');
      await addToWishlist(user.id, POWERCUBE);
      await addToWishlist(user.id, TK_LIFE);

      expect(await removeFromWishlist(user.id, POWERCUBE)).toBe(true);
      expect(await listWishlist(user.id)).toEqual([TK_LIFE]);
    },
    DB_TIMEOUT,
  );

  it(
    'reports false when removing something that was never saved',
    async () => {
      const user = await makeCustomer('missing');
      expect(await removeFromWishlist(user.id, POWERCUBE)).toBe(false);
    },
    DB_TIMEOUT,
  );

  it(
    'cannot hold the same product twice',
    async () => {
      // The primary key decides this, so a double-tapped heart cannot produce
      // two rows however fast the taps arrive.
      const user = await makeCustomer('duplicate');
      await addToWishlist(user.id, POWERCUBE);
      await addToWishlist(user.id, POWERCUBE);
      await addToWishlist(user.id, POWERCUBE);

      expect(await listWishlist(user.id)).toEqual([POWERCUBE]);
      expect(await countWishlist(user.id)).toBe(1);
    },
    DB_TIMEOUT,
  );

  it(
    'rejects a duplicate at the database level, not only in code',
    async () => {
      const user = await makeCustomer('pk');
      await addToWishlist(user.id, POWERCUBE);

      await expect(
        query(`INSERT INTO wishlist_items (user_id, product_id) VALUES ($1, $2)`, [
          user.id,
          POWERCUBE,
        ]),
      ).rejects.toThrow(/duplicate key|unique constraint/i);
    },
    DB_TIMEOUT,
  );

  it(
    'lists newest first, which is the order the grid renders',
    async () => {
      const user = await makeCustomer('order');
      await addToWishlist(user.id, POWERCUBE);
      await new Promise((resolve) => setTimeout(resolve, 20));
      await addToWishlist(user.id, TK_LIFE);

      expect(await listWishlist(user.id)).toEqual([TK_LIFE, POWERCUBE]);
    },
    DB_TIMEOUT,
  );

  it(
    'ignores a blank product id rather than storing one',
    async () => {
      const user = await makeCustomer('blank');
      await addToWishlist(user.id, '   ');
      expect(await listWishlist(user.id)).toEqual([]);
    },
    DB_TIMEOUT,
  );

  it(
    'accepts an id the catalogue does not know, and keeps it',
    async () => {
      // No foreign key, on purpose: mock and Hostinger ids have no `products`
      // row, and an unpublished product must not be deleted from somebody's
      // list on our say-so. Resolution is a rendering concern.
      const user = await makeCustomer('unknown');
      await addToWishlist(user.id, 'a-product-that-does-not-exist');

      expect(await listWishlist(user.id)).toEqual(['a-product-that-does-not-exist']);
    },
    DB_TIMEOUT,
  );

  /* ---------------------------------------------------- ownership / IDOR */

  it(
    'does not let customer A read customer B’s wishlist',
    async () => {
      const a = await makeCustomer('read-a');
      const b = await makeCustomer('read-b');
      await addToWishlist(b.id, POWERCUBE);

      expect(await listWishlist(a.id)).toEqual([]);
      expect(await countWishlist(a.id)).toBe(0);
    },
    DB_TIMEOUT,
  );

  it(
    'does not let customer A remove from customer B’s wishlist',
    async () => {
      const a = await makeCustomer('del-a');
      const b = await makeCustomer('del-b');
      await addToWishlist(b.id, POWERCUBE);

      // Scoped in SQL: the row is never in hand, so there is no check to forget.
      expect(await removeFromWishlist(a.id, POWERCUBE)).toBe(false);
      expect(await listWishlist(b.id)).toEqual([POWERCUBE]);
    },
    DB_TIMEOUT,
  );

  it(
    'keeps two customers’ lists apart even for the same product',
    async () => {
      const a = await makeCustomer('same-a');
      const b = await makeCustomer('same-b');
      await addToWishlist(a.id, POWERCUBE);
      await addToWishlist(b.id, POWERCUBE);

      expect(await listWishlist(a.id)).toEqual([POWERCUBE]);
      expect(await listWishlist(b.id)).toEqual([POWERCUBE]);

      await removeFromWishlist(a.id, POWERCUBE);
      // B still has it: the primary key is (user_id, product_id), not product.
      expect(await listWishlist(b.id)).toEqual([POWERCUBE]);
    },
    DB_TIMEOUT,
  );

  it(
    'removes everything belonging to a deleted account',
    async () => {
      const user = await makeCustomer('cascade');
      await addToWishlist(user.id, POWERCUBE);
      const id = user.id;

      await query(`DELETE FROM users WHERE id = $1`, [id]);

      const rows = await query(`SELECT product_id FROM wishlist_items WHERE user_id = $1`, [id]);
      expect(rows).toHaveLength(0);
    },
    DB_TIMEOUT,
  );

  /* ---------------------------------------------------------------- merge */

  it(
    'folds a local list into an empty account wishlist',
    async () => {
      const user = await makeCustomer('merge-empty');
      const merged = await mergeWishlist(user.id, [POWERCUBE, TK_LIFE]);

      expect(merged.sort()).toEqual([POWERCUBE, TK_LIFE].sort());
    },
    DB_TIMEOUT,
  );

  it(
    'merges additively, keeping what the account already had',
    async () => {
      // Two devices, two half-lists, one account. Replacing rather than adding
      // would silently drop whichever set synced first.
      const user = await makeCustomer('merge-add');
      await addToWishlist(user.id, POWERCUBE);

      const merged = await mergeWishlist(user.id, [TK_LIFE]);
      expect(merged.sort()).toEqual([POWERCUBE, TK_LIFE].sort());
    },
    DB_TIMEOUT,
  );

  it(
    'creates no duplicates when the same list is merged twice',
    async () => {
      const user = await makeCustomer('merge-twice');
      await mergeWishlist(user.id, [POWERCUBE, TK_LIFE]);
      const second = await mergeWishlist(user.id, [POWERCUBE, TK_LIFE]);

      expect(second).toHaveLength(2);
      expect(await countWishlist(user.id)).toBe(2);
    },
    DB_TIMEOUT,
  );

  it(
    'never deletes on merge, so a device cannot undo another device’s save',
    async () => {
      const user = await makeCustomer('merge-nodelete');
      await addToWishlist(user.id, POWERCUBE);

      // A local list that does not mention POWERCUBE must not remove it.
      const merged = await mergeWishlist(user.id, [TK_LIFE]);
      expect(merged).toContain(POWERCUBE);
    },
    DB_TIMEOUT,
  );

  it(
    'collapses duplicates inside the incoming list',
    async () => {
      const user = await makeCustomer('merge-dupes');
      const merged = await mergeWishlist(user.id, [POWERCUBE, POWERCUBE, POWERCUBE]);
      expect(merged).toEqual([POWERCUBE]);
    },
    DB_TIMEOUT,
  );

  it(
    'merges a list well past the old 24-item ceiling',
    async () => {
      // The 24 cap was in the products API, not the wishlist, which is exactly
      // why the two disagreed and items vanished from the grid.
      const user = await makeCustomer('merge-many');
      const many = Array.from({ length: 40 }, (_, i) => `bulk-product-${i}`);

      const merged = await mergeWishlist(user.id, many);
      expect(merged).toHaveLength(40);
      expect(await countWishlist(user.id)).toBe(40);
    },
    DB_TIMEOUT,
  );

  it(
    'is a no-op for an empty local list',
    async () => {
      const user = await makeCustomer('merge-none');
      await addToWishlist(user.id, POWERCUBE);
      expect(await mergeWishlist(user.id, [])).toEqual([POWERCUBE]);
    },
    DB_TIMEOUT,
  );

  /* ---------------------------------------------------------------- bound */

  it(
    'refuses to grow past the cap but still tolerates re-saving',
    async () => {
      const user = await makeCustomer('cap');
      const full = Array.from({ length: MAX_WISHLIST_ITEMS }, (_, i) => `capped-${i}`);
      await mergeWishlist(user.id, full);

      expect(await countWishlist(user.id)).toBe(MAX_WISHLIST_ITEMS);
      await expect(addToWishlist(user.id, 'one-too-many')).rejects.toThrow(WishlistFullError);

      // Re-saving something already there does not grow the list, so there is
      // nothing to refuse.
      await expect(addToWishlist(user.id, 'capped-0')).resolves.toBeUndefined();
      expect(await countWishlist(user.id)).toBe(MAX_WISHLIST_ITEMS);
    },
    DB_TIMEOUT,
  );

  it(
    'clears an account’s list without touching anybody else’s',
    async () => {
      const a = await makeCustomer('clear-a');
      const b = await makeCustomer('clear-b');
      await addToWishlist(a.id, POWERCUBE);
      await addToWishlist(b.id, POWERCUBE);

      await clearWishlist(a.id);

      expect(await listWishlist(a.id)).toEqual([]);
      expect(await listWishlist(b.id)).toEqual([POWERCUBE]);
    },
    DB_TIMEOUT,
  );
});
