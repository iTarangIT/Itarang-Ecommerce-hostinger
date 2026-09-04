import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';

/**
 * The wishlist through its Server Actions.
 *
 * `wishlist.integration.test.ts` proves the data layer scopes every statement
 * by `user_id`. This proves the layer above it never lets a caller *choose*
 * that id — the half an attacker actually reaches. Only `currentUser()` is
 * stood in for; there is no request here to read a cookie from.
 *
 * Also covers the merge rule the whole design turns on: local ids are folded in
 * once per browser and account, and never on later loads. Without that, a
 * product removed on one device is resurrected by another's stale copy.
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
  console.warn('\n  [skipped] Wishlist action tests need DATABASE_URL and DB_ALLOW_REMOTE_TESTS.\n');
}

const DB_TIMEOUT = 30_000;
const DOMAIN = '@wishlistactions.invalid';

/** Whose session the actions see. Swapped per test. */
let signedInAs: { id: number; role: 'customer' | 'admin' } | null = null;

vi.mock('@/lib/auth/session', () => ({
  currentUser: async () => signedInAs,
}));

const { addWishlistItemAction, removeWishlistItemAction, syncWishlistAction } = await import(
  './wishlist-actions'
);
const { addToWishlist, listWishlist } = await import('./wishlist');
const { createUser } = await import('@/lib/auth/users');
const { hashPassword } = await import('@/lib/auth/password');

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

describe.skipIf(!CONFIGURED)('wishlist actions', () => {
  beforeEach(async () => {
    signedInAs = null;
    await query(`DELETE FROM users WHERE email LIKE $1`, [`%${DOMAIN}`]);
    await query(`DELETE FROM rate_limits WHERE bucket LIKE 'wishlist:%'`);
  });

  afterAll(async () => {
    await query(`DELETE FROM users WHERE email LIKE $1`, [`%${DOMAIN}`]);
    await query(`DELETE FROM rate_limits WHERE bucket LIKE 'wishlist:%'`);
    await closePool();
  });

  /* -------------------------------------------------------- signed out */

  it(
    'writes nothing and reports signed-out when there is no session',
    async () => {
      signedInAs = null;

      expect(await addWishlistItemAction(POWERCUBE)).toEqual({
        signedIn: false,
        ids: null,
        userId: null,
      });
      expect(await removeWishlistItemAction(POWERCUBE)).toEqual({
        signedIn: false,
        ids: null,
        userId: null,
      });
      expect(
        await syncWishlistAction({ localIds: [POWERCUBE], alreadySyncedFor: null }),
      ).toEqual({ signedIn: false, ids: null, userId: null });

      // A visitor keeps their wishlist locally, so being signed out is not an
      // error — but nothing may be written without an account to write it to.
      const orphaned = await query<{ n: string }>(
        `SELECT count(*) AS n FROM wishlist_items WHERE product_id = $1`,
        [POWERCUBE],
      );
      expect(Number(orphaned[0]!.n)).toBe(0);
    },
    DB_TIMEOUT,
  );

  /* ---------------------------------------------------------- ownership */

  it(
    'saves against the session’s account, not one named by the caller',
    async () => {
      const a = await makeCustomer('own-a');
      const b = await makeCustomer('own-b');

      signedInAs = { id: a.id, role: 'customer' };
      const result = await addWishlistItemAction(POWERCUBE);

      expect(result.userId).toBe(a.id);
      expect(await listWishlist(a.id)).toEqual([POWERCUBE]);
      // There is no parameter that could have named B, which is the point.
      expect(await listWishlist(b.id)).toEqual([]);
    },
    DB_TIMEOUT,
  );

  it(
    'never returns another customer’s list',
    async () => {
      const a = await makeCustomer('list-a');
      const b = await makeCustomer('list-b');
      await addToWishlist(b.id, POWERCUBE);
      await addToWishlist(b.id, TK_LIFE);

      signedInAs = { id: a.id, role: 'customer' };
      const result = await syncWishlistAction({ localIds: [], alreadySyncedFor: a.id });

      expect(result.ids).toEqual([]);
      expect(result.userId).toBe(a.id);
    },
    DB_TIMEOUT,
  );

  it(
    'cannot remove a product from another customer’s list',
    async () => {
      const a = await makeCustomer('rm-a');
      const b = await makeCustomer('rm-b');
      await addToWishlist(b.id, POWERCUBE);

      signedInAs = { id: a.id, role: 'customer' };
      await removeWishlistItemAction(POWERCUBE);

      // A's statement matched nothing; B still has it.
      expect(await listWishlist(b.id)).toEqual([POWERCUBE]);
    },
    DB_TIMEOUT,
  );

  it(
    'cannot be steered to another account by a forged sync marker',
    async () => {
      // `alreadySyncedFor` decides *whether to merge*, never *whose list*. The
      // worst a lie achieves is folding the caller's own ids into the caller's
      // own wishlist — which is what the merge does anyway.
      const a = await makeCustomer('forge-a');
      const b = await makeCustomer('forge-b');

      signedInAs = { id: a.id, role: 'customer' };
      const result = await syncWishlistAction({
        localIds: [POWERCUBE],
        alreadySyncedFor: b.id,
      });

      expect(result.userId).toBe(a.id);
      expect(await listWishlist(a.id)).toEqual([POWERCUBE]);
      expect(await listWishlist(b.id)).toEqual([]);
    },
    DB_TIMEOUT,
  );

  /* --------------------------------------------------------- validation */

  it(
    'handles an invalid product id without writing a row',
    async () => {
      const user = await makeCustomer('invalid');
      signedInAs = { id: user.id, role: 'customer' };

      for (const bad of ['', '   ', 'x'.repeat(201)]) {
        const result = await addWishlistItemAction(bad);
        expect(result.signedIn).toBe(true);
        expect(result.error).toBeTruthy();
      }
      expect(await listWishlist(user.id)).toEqual([]);
    },
    DB_TIMEOUT,
  );

  it(
    'tolerates removing a product that is not saved',
    async () => {
      const user = await makeCustomer('rm-missing');
      signedInAs = { id: user.id, role: 'customer' };

      const result = await removeWishlistItemAction('never-saved');
      expect(result.signedIn).toBe(true);
      expect(result.ids).toEqual([]);
    },
    DB_TIMEOUT,
  );

  it(
    'keeps an id the catalogue cannot resolve',
    async () => {
      // Unpublished or withdrawn products stay on the list. Deleting somebody's
      // saved product because it is temporarily unavailable would be worse than
      // a grid that shows fewer cards than the count.
      const user = await makeCustomer('unresolvable');
      signedInAs = { id: user.id, role: 'customer' };

      await addWishlistItemAction('withdrawn-product-key');
      expect((await syncWishlistAction({ localIds: [], alreadySyncedFor: user.id })).ids).toEqual([
        'withdrawn-product-key',
      ]);
    },
    DB_TIMEOUT,
  );

  /* -------------------------------------------------------------- merge */

  it(
    'merges the local list on the first sync for this account',
    async () => {
      const user = await makeCustomer('merge-first');
      signedInAs = { id: user.id, role: 'customer' };

      const result = await syncWishlistAction({
        localIds: [POWERCUBE, TK_LIFE],
        alreadySyncedFor: null,
      });

      expect(result.ids?.sort()).toEqual([POWERCUBE, TK_LIFE].sort());
      expect(result.userId).toBe(user.id);
    },
    DB_TIMEOUT,
  );

  it(
    'does NOT re-merge once this browser has synced, so a removal stays removed',
    async () => {
      // The subtlest bug in the stage, and the reason the marker exists.
      // Device A holds [POWERCUBE], the customer removes it on device B, then
      // device A loads again. Without the marker its stale copy resurrects it.
      const user = await makeCustomer('merge-marker');
      signedInAs = { id: user.id, role: 'customer' };

      await syncWishlistAction({ localIds: [POWERCUBE], alreadySyncedFor: null });
      await removeWishlistItemAction(POWERCUBE);

      const afterRemoval = await syncWishlistAction({
        localIds: [POWERCUBE],
        alreadySyncedFor: user.id,
      });

      expect(afterRemoval.ids).toEqual([]);
      expect(await listWishlist(user.id)).toEqual([]);
    },
    DB_TIMEOUT,
  );

  it(
    'creates no duplicates when the same first sync is repeated',
    async () => {
      const user = await makeCustomer('merge-retry');
      signedInAs = { id: user.id, role: 'customer' };

      await syncWishlistAction({ localIds: [POWERCUBE], alreadySyncedFor: null });
      const retry = await syncWishlistAction({ localIds: [POWERCUBE], alreadySyncedFor: null });

      expect(retry.ids).toEqual([POWERCUBE]);
    },
    DB_TIMEOUT,
  );

  it(
    'merges more than 24 items, the old truncation point',
    async () => {
      const user = await makeCustomer('merge-40');
      signedInAs = { id: user.id, role: 'customer' };

      const many = Array.from({ length: 40 }, (_, i) => `bulk-${i}`);
      const result = await syncWishlistAction({ localIds: many, alreadySyncedFor: null });

      expect(result.ids).toHaveLength(40);
    },
    DB_TIMEOUT,
  );

  it(
    'reads without merging when the browser is already synced',
    async () => {
      const user = await makeCustomer('read-only');
      await addToWishlist(user.id, TK_LIFE);
      signedInAs = { id: user.id, role: 'customer' };

      const result = await syncWishlistAction({
        localIds: [POWERCUBE],
        alreadySyncedFor: user.id,
      });

      // POWERCUBE was in the local list but is not folded in: this browser has
      // already contributed once.
      expect(result.ids).toEqual([TK_LIFE]);
    },
    DB_TIMEOUT,
  );

  it(
    'survives a local list containing junk without failing the sync',
    async () => {
      const user = await makeCustomer('junk');
      signedInAs = { id: user.id, role: 'customer' };

      // An oversized entry fails the schema, so the whole local list is
      // discarded rather than partially trusted — the account's own list still
      // comes back and the customer is not left staring at an error.
      const result = await syncWishlistAction({
        localIds: ['x'.repeat(500)],
        alreadySyncedFor: null,
      });

      expect(result.signedIn).toBe(true);
      expect(result.ids).toEqual([]);
    },
    DB_TIMEOUT,
  );
});
