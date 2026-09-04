import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query, queryOne } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { hashPassword } from '@/lib/auth/password';
import { createUser } from '@/lib/auth/users';
import {
  DuplicateAddressError,
  addAddress,
  archiveAddress,
  countAddresses,
  defaultAddress,
  findAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from './addresses';

/**
 * The address book against a live PostgreSQL.
 *
 * Two kinds of guarantee live here and neither can be shown against a mock:
 * that one customer can never reach another's rows, which is a property of a
 * WHERE clause; and that exactly one default survives every path, which is a
 * property of a unique index and a transaction.
 *
 * Every row hangs off a user with an `@addressbook.invalid` address, and
 * deleting the user cascades — so cleanup is one statement and cannot miss.
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
  Boolean(process.env.DATABASE_URL) &&
  (!REMOTE || process.env.DB_ALLOW_REMOTE_TESTS === 'true');

if (!CONFIGURED) {
  console.warn(
    '\n  [skipped] Address book integration tests need DATABASE_URL, and ' +
      'DB_ALLOW_REMOTE_TESTS=true against a remote database.\n',
  );
}

const DB_TIMEOUT = 30_000;
const DOMAIN = '@addressbook.invalid';

const ADDRESS = {
  line1: '12 MG Road',
  line2: 'Near the depot',
  landmark: 'Opposite the bus stand',
  city: 'Lucknow',
  state: 'Uttar Pradesh',
  pincode: '226001',
  recipientName: 'A Person',
  recipientPhone: '9876543210',
};

const other = (n: number) => ({ ...ADDRESS, line1: `${n} Another Street` });

async function makeCustomer(tag: string) {
  const user = await createUser({
    email: `${tag}${DOMAIN}`,
    passwordHash: hashPassword('irrelevant to these tests'),
    role: 'customer',
  });
  return user!;
}

describe.skipIf(!CONFIGURED)('the customer address book', () => {
  beforeEach(async () => {
    await query(`DELETE FROM users WHERE email LIKE $1`, [`%${DOMAIN}`]);
  });

  afterAll(async () => {
    await query(`DELETE FROM users WHERE email LIKE $1`, [`%${DOMAIN}`]);
    await closePool();
  });

  /* ------------------------------------------------------------- basics */

  it(
    'saves an address and reads it back field for field',
    async () => {
      const user = await makeCustomer('basic');
      const saved = await addAddress(user.id, ADDRESS, false);

      expect(saved.line1).toBe(ADDRESS.line1);
      expect(saved.line2).toBe(ADDRESS.line2);
      expect(saved.landmark).toBe(ADDRESS.landmark);
      expect(saved.city).toBe(ADDRESS.city);
      expect(saved.state).toBe(ADDRESS.state);
      expect(saved.pincode).toBe(ADDRESS.pincode);
      expect(saved.recipientName).toBe(ADDRESS.recipientName);
      expect(saved.recipientPhone).toBe(ADDRESS.recipientPhone);
    },
    DB_TIMEOUT,
  );

  it(
    'returns absent optional fields as undefined, matching ShippingAddress',
    async () => {
      // Not null: `orders.shipping_address` snapshots are written from this
      // shape, and a null would land in the order JSON where every existing
      // snapshot simply omits the key.
      const user = await makeCustomer('optional');
      const saved = await addAddress(user.id, { ...ADDRESS, line2: '', landmark: '' }, false);

      expect(saved.line2).toBeUndefined();
      expect(saved.landmark).toBeUndefined();
    },
    DB_TIMEOUT,
  );

  it(
    'refuses a second identical address for the same customer',
    async () => {
      const user = await makeCustomer('dupe');
      await addAddress(user.id, ADDRESS, false);

      // Checkout's "save this address" would otherwise add a near-copy per
      // order until the book is unusable.
      await expect(addAddress(user.id, ADDRESS, false)).rejects.toThrow(DuplicateAddressError);
      expect(await countAddresses(user.id)).toBe(1);
    },
    DB_TIMEOUT,
  );

  it(
    'treats casing and spacing differences as the same address',
    async () => {
      const user = await makeCustomer('normalise');
      await addAddress(user.id, ADDRESS, false);

      await expect(
        addAddress(user.id, { ...ADDRESS, line1: '12  mg   ROAD' }, false),
      ).rejects.toThrow(DuplicateAddressError);
    },
    DB_TIMEOUT,
  );

  it(
    'allows the same street address for a different recipient',
    async () => {
      // A parcel goes to a person at a place. Same house, different person, is
      // two genuine entries — which is why the recipient is part of the key.
      const user = await makeCustomer('recipients');
      await addAddress(user.id, ADDRESS, false);
      await addAddress(user.id, { ...ADDRESS, recipientName: 'Someone Else' }, false);

      expect(await countAddresses(user.id)).toBe(2);
    },
    DB_TIMEOUT,
  );

  it(
    'lets two different customers save the very same address',
    async () => {
      const a = await makeCustomer('shared-a');
      const b = await makeCustomer('shared-b');

      await addAddress(a.id, ADDRESS, false);
      await addAddress(b.id, ADDRESS, false);

      expect(await countAddresses(a.id)).toBe(1);
      expect(await countAddresses(b.id)).toBe(1);
    },
    DB_TIMEOUT,
  );

  /* ---------------------------------------------------- ownership / IDOR */

  it(
    'does not let customer A read customer B’s address',
    async () => {
      const a = await makeCustomer('read-a');
      const b = await makeCustomer('read-b');
      const bAddress = await addAddress(b.id, ADDRESS, false);

      // The id is a small integer and trivially guessable, which is exactly
      // why ownership is a WHERE clause rather than a check after the read.
      expect(await findAddress(a.id, bAddress.id)).toBeNull();
      expect(await listAddresses(a.id)).toHaveLength(0);
    },
    DB_TIMEOUT,
  );

  it(
    'does not let customer A modify customer B’s address',
    async () => {
      const a = await makeCustomer('write-a');
      const b = await makeCustomer('write-b');
      const bAddress = await addAddress(b.id, ADDRESS, false);

      const result = await updateAddress(a.id, bAddress.id, {
        ...ADDRESS,
        line1: '99 Hijacked Lane',
      });

      expect(result).toBeNull();
      // And B's row is untouched, not merely un-returned.
      const stillB = await findAddress(b.id, bAddress.id);
      expect(stillB!.line1).toBe(ADDRESS.line1);
    },
    DB_TIMEOUT,
  );

  it(
    'does not let customer A archive customer B’s address',
    async () => {
      const a = await makeCustomer('archive-a');
      const b = await makeCustomer('archive-b');
      const bAddress = await addAddress(b.id, ADDRESS, false);

      expect(await archiveAddress(a.id, bAddress.id)).toBe(false);
      expect(await findAddress(b.id, bAddress.id)).not.toBeNull();
    },
    DB_TIMEOUT,
  );

  it(
    'does not let customer A make customer B’s address their default',
    async () => {
      const a = await makeCustomer('default-a');
      const b = await makeCustomer('default-b');
      const bAddress = await addAddress(b.id, ADDRESS, false);

      expect(await setDefaultAddress(a.id, bAddress.id)).toBe(false);
      expect(await defaultAddress(a.id)).toBeNull();
    },
    DB_TIMEOUT,
  );

  it(
    'answers an id that never existed exactly as it answers somebody else’s',
    async () => {
      // Telling the two apart would confirm that a row exists and belongs to
      // someone, for no benefit to the person asking.
      const a = await makeCustomer('unknown-a');
      const b = await makeCustomer('unknown-b');
      const bAddress = await addAddress(b.id, ADDRESS, false);

      expect(await findAddress(a.id, bAddress.id)).toBeNull();
      expect(await findAddress(a.id, 2_147_483_000)).toBeNull();
      expect(await archiveAddress(a.id, bAddress.id)).toBe(false);
      expect(await archiveAddress(a.id, 2_147_483_000)).toBe(false);
    },
    DB_TIMEOUT,
  );

  /* -------------------------------------------------------- the default */

  it(
    'makes the first saved address the default without being asked',
    async () => {
      const user = await makeCustomer('first-default');
      const saved = await addAddress(user.id, ADDRESS, false);

      expect(saved.isDefault).toBe(true);
      expect((await defaultAddress(user.id))!.id).toBe(saved.id);
    },
    DB_TIMEOUT,
  );

  it(
    'keeps exactly one default when a later address claims it',
    async () => {
      const user = await makeCustomer('one-default');
      const first = await addAddress(user.id, ADDRESS, false);
      const second = await addAddress(user.id, other(2), true);

      const live = await listAddresses(user.id);
      expect(live.filter((entry) => entry.isDefault)).toHaveLength(1);
      expect(live.find((entry) => entry.isDefault)!.id).toBe(second.id);
      expect((await findAddress(user.id, first.id))!.isDefault).toBe(false);
    },
    DB_TIMEOUT,
  );

  it(
    'keeps exactly one default across a run of changes',
    async () => {
      const user = await makeCustomer('churn');
      const a = await addAddress(user.id, ADDRESS, false);
      const b = await addAddress(user.id, other(2), true);
      const c = await addAddress(user.id, other(3), false);

      await setDefaultAddress(user.id, c.id);
      await setDefaultAddress(user.id, a.id);
      await setDefaultAddress(user.id, b.id);

      // The unique index is the arbiter, not the order the code happened to
      // run in — so this is asserted against the table, not the return value.
      const count = await queryOne<{ n: string }>(
        `SELECT count(*) AS n FROM customer_addresses
          WHERE user_id = $1 AND is_default AND archived_at IS NULL`,
        [user.id],
      );
      expect(Number(count!.n)).toBe(1);
      expect((await defaultAddress(user.id))!.id).toBe(b.id);
    },
    DB_TIMEOUT,
  );

  it(
    'lists the default first, so checkout can take the head of the list',
    async () => {
      const user = await makeCustomer('ordering');
      await addAddress(user.id, ADDRESS, false);
      const second = await addAddress(user.id, other(2), true);

      expect((await listAddresses(user.id))[0]!.id).toBe(second.id);
    },
    DB_TIMEOUT,
  );

  it(
    'falls back to the newest address when none is marked default',
    async () => {
      const user = await makeCustomer('fallback');
      const only = await addAddress(user.id, ADDRESS, false);
      await query(`UPDATE customer_addresses SET is_default = false WHERE user_id = $1`, [
        user.id,
      ]);

      // A customer with one saved address should never have to nominate it
      // before checkout will offer it.
      expect((await defaultAddress(user.id))!.id).toBe(only.id);
    },
    DB_TIMEOUT,
  );

  /* ------------------------------------------------------------ archiving */

  it(
    'hides an archived address from every listing but keeps the row',
    async () => {
      const user = await makeCustomer('archived');
      const first = await addAddress(user.id, ADDRESS, false);
      await addAddress(user.id, other(2), false);

      expect(await archiveAddress(user.id, first.id)).toBe(true);

      expect(await findAddress(user.id, first.id)).toBeNull();
      expect(await listAddresses(user.id)).toHaveLength(1);
      expect(await countAddresses(user.id)).toBe(1);

      // Soft, not hard: the row survives so a half-finished checkout holding
      // it does not crash, and "where did it go" stays answerable.
      const raw = await queryOne<{ archived_at: Date | null }>(
        `SELECT archived_at FROM customer_addresses WHERE id = $1`,
        [first.id],
      );
      expect(raw!.archived_at).not.toBeNull();
    },
    DB_TIMEOUT,
  );

  it(
    'never leaves an archived address holding the default slot',
    async () => {
      const user = await makeCustomer('archive-default');
      const first = await addAddress(user.id, ADDRESS, true);
      const second = await addAddress(user.id, other(2), false);

      await archiveAddress(user.id, first.id);

      const raw = await queryOne<{ is_default: boolean }>(
        `SELECT is_default FROM customer_addresses WHERE id = $1`,
        [first.id],
      );
      expect(raw!.is_default).toBe(false);
      // The survivor is promoted, so deleting the default does not leave the
      // customer with none.
      expect((await defaultAddress(user.id))!.id).toBe(second.id);
    },
    DB_TIMEOUT,
  );

  it(
    'refuses at the database level to archive a row that is still default',
    async () => {
      // The CHECK constraint, not the application, is what makes this
      // impossible — so it is asserted by going around the application.
      const user = await makeCustomer('check-constraint');
      const only = await addAddress(user.id, ADDRESS, true);

      await expect(
        query(`UPDATE customer_addresses SET archived_at = now() WHERE id = $1`, [only.id]),
      ).rejects.toThrow(/customer_addresses_archived_not_default|violates check constraint/i);
    },
    DB_TIMEOUT,
  );

  it(
    'cannot archive the same address twice',
    async () => {
      const user = await makeCustomer('twice');
      const saved = await addAddress(user.id, ADDRESS, false);

      expect(await archiveAddress(user.id, saved.id)).toBe(true);
      expect(await archiveAddress(user.id, saved.id)).toBe(false);
    },
    DB_TIMEOUT,
  );

  it(
    'lets an archived address be added again',
    async () => {
      // The dedupe index is partial on `archived_at`, so deleting and
      // re-adding is allowed — otherwise a customer who removed an address by
      // mistake could never restore it.
      const user = await makeCustomer('readd');
      const saved = await addAddress(user.id, ADDRESS, false);
      await archiveAddress(user.id, saved.id);

      const again = await addAddress(user.id, ADDRESS, false);
      expect(again.id).not.toBe(saved.id);
      expect(await countAddresses(user.id)).toBe(1);
    },
    DB_TIMEOUT,
  );

  it(
    'archives everything belonging to a deleted account',
    async () => {
      const user = await makeCustomer('cascade');
      const saved = await addAddress(user.id, ADDRESS, false);

      await query(`DELETE FROM users WHERE id = $1`, [user.id]);

      expect(
        await queryOne(`SELECT id FROM customer_addresses WHERE id = $1`, [saved.id]),
      ).toBeNull();
    },
    DB_TIMEOUT,
  );

  /* -------------------------------------------------------------- editing */

  it(
    'updates an address in place, keeping its id and its default flag',
    async () => {
      const user = await makeCustomer('edit');
      const saved = await addAddress(user.id, ADDRESS, true);

      const updated = await updateAddress(user.id, saved.id, {
        ...ADDRESS,
        line1: '99 New Road',
        city: 'Kanpur',
      });

      expect(updated!.id).toBe(saved.id);
      expect(updated!.line1).toBe('99 New Road');
      expect(updated!.city).toBe('Kanpur');
      expect(updated!.isDefault).toBe(true);
    },
    DB_TIMEOUT,
  );

  it(
    'refuses an edit that would duplicate another saved address',
    async () => {
      const user = await makeCustomer('edit-dupe');
      await addAddress(user.id, ADDRESS, false);
      const second = await addAddress(user.id, other(2), false);

      await expect(updateAddress(user.id, second.id, ADDRESS)).rejects.toThrow(
        DuplicateAddressError,
      );
    },
    DB_TIMEOUT,
  );

  it(
    'cannot edit an archived address',
    async () => {
      const user = await makeCustomer('edit-archived');
      const saved = await addAddress(user.id, ADDRESS, false);
      await archiveAddress(user.id, saved.id);

      expect(await updateAddress(user.id, saved.id, { ...ADDRESS, city: 'Kanpur' })).toBeNull();
    },
    DB_TIMEOUT,
  );
});
