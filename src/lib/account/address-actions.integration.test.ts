import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closePool, query, queryOne } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';

/**
 * The address book through its Server Actions.
 *
 * `addresses.integration.test.ts` proves the data layer scopes every statement
 * by `user_id`. This proves the layer above it never lets a caller *choose*
 * that id — which is the half an attacker actually touches. The actions are
 * driven for real; only `currentUser()` is stood in for, because there is no
 * request here to read a cookie from.
 *
 * Also fixes the guarantee Stage 2D depends on: editing or deleting a saved
 * address must not disturb a single `orders.shipping_address` snapshot.
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
  console.warn('\n  [skipped] Address action tests need DATABASE_URL and DB_ALLOW_REMOTE_TESTS.\n');
}

const DB_TIMEOUT = 30_000;
const DOMAIN = '@addressactions.invalid';

/* ------------------------------------------------------------------ mocks */

/** Whose session the actions will see. Swapped per test. */
let signedInAs: { id: number; role: 'customer' | 'admin' } | null = null;

vi.mock('@/lib/auth/session', () => ({
  currentUser: async () => signedInAs,
}));

vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}));

const {
  addAddressAction,
  archiveAddressAction,
  setDefaultAddressAction,
  updateAddressAction,
  updateProfileAction,
} = await import('./address-actions');
const { addAddress, findAddress, listAddresses } = await import('./addresses');
const { createUser } = await import('@/lib/auth/users');
const { hashPassword } = await import('@/lib/auth/password');

/* --------------------------------------------------------------- fixtures */

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

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
};

const addressForm = (overrides: Record<string, string> = {}) =>
  form({ ...ADDRESS, ...overrides });

async function makeCustomer(tag: string) {
  const user = await createUser({
    email: `${tag}${DOMAIN}`,
    passwordHash: hashPassword('irrelevant to these tests'),
    role: 'customer',
  });
  return user!;
}

describe.skipIf(!CONFIGURED)('address actions', () => {
  beforeEach(async () => {
    signedInAs = null;
    await query(`DELETE FROM users WHERE email LIKE $1`, [`%${DOMAIN}`]);
    await query(`DELETE FROM rate_limits WHERE bucket LIKE 'account:%'`);
  });

  afterAll(async () => {
    await query(`DELETE FROM users WHERE email LIKE $1`, [`%${DOMAIN}`]);
    await query(`DELETE FROM rate_limits WHERE bucket LIKE 'account:%'`);
    await closePool();
  });

  /* ------------------------------------------------------ signed out */

  it(
    'refuses every write when nobody is signed in',
    async () => {
      signedInAs = null;

      for (const [name, action, data] of [
        ['add', addAddressAction, addressForm()],
        ['update', updateAddressAction, addressForm({ id: '1' })],
        ['default', setDefaultAddressAction, form({ id: '1' })],
        ['archive', archiveAddressAction, form({ id: '1' })],
        ['profile', updateProfileAction, form({ fullName: 'A Person', phone: '' })],
      ] as const) {
        const result = await action(null, data);
        expect(result?.ok, `${name} succeeded while signed out`).toBe(false);
      }
    },
    DB_TIMEOUT,
  );

  /* ---------------------------------------------------------- ownership */

  it(
    'gives customer A no way to name customer B as the owner',
    async () => {
      const a = await makeCustomer('owner-a');
      const b = await makeCustomer('owner-b');

      signedInAs = { id: a.id, role: 'customer' };
      // A `userId` field in the payload is the obvious attack, and there is no
      // code path that reads one — the id comes from the session every time.
      const result = await addAddressAction(
        null,
        addressForm({ userId: String(b.id), user_id: String(b.id) }),
      );

      expect(result?.ok).toBe(true);
      expect(await listAddresses(b.id)).toHaveLength(0);
      expect(await listAddresses(a.id)).toHaveLength(1);
    },
    DB_TIMEOUT,
  );

  it(
    'refuses to update an address belonging to somebody else',
    async () => {
      const a = await makeCustomer('upd-a');
      const b = await makeCustomer('upd-b');
      const bAddress = await addAddress(b.id, ADDRESS, false);

      signedInAs = { id: a.id, role: 'customer' };
      const result = await updateAddressAction(
        null,
        addressForm({ id: String(bAddress.id), line1: '99 Hijacked Lane' }),
      );

      expect(result?.ok).toBe(false);
      expect((await findAddress(b.id, bAddress.id))!.line1).toBe(ADDRESS.line1);
    },
    DB_TIMEOUT,
  );

  it(
    'refuses to archive an address belonging to somebody else',
    async () => {
      const a = await makeCustomer('arc-a');
      const b = await makeCustomer('arc-b');
      const bAddress = await addAddress(b.id, ADDRESS, false);

      signedInAs = { id: a.id, role: 'customer' };
      const result = await archiveAddressAction(null, form({ id: String(bAddress.id) }));

      expect(result?.ok).toBe(false);
      expect(await findAddress(b.id, bAddress.id)).not.toBeNull();
    },
    DB_TIMEOUT,
  );

  it(
    'refuses to make somebody else’s address the default',
    async () => {
      const a = await makeCustomer('def-a');
      const b = await makeCustomer('def-b');
      const bAddress = await addAddress(b.id, ADDRESS, false);

      signedInAs = { id: a.id, role: 'customer' };
      const result = await setDefaultAddressAction(null, form({ id: String(bAddress.id) }));

      expect(result?.ok).toBe(false);
      expect(await listAddresses(a.id)).toHaveLength(0);
    },
    DB_TIMEOUT,
  );

  it(
    'rejects an id that is not a positive integer before it reaches a query',
    async () => {
      const a = await makeCustomer('badid');
      signedInAs = { id: a.id, role: 'customer' };

      for (const id of ['0', '-1', 'abc', '1; DROP TABLE customer_addresses', '1.5', '']) {
        const result = await archiveAddressAction(null, form({ id }));
        expect(result?.ok, `id "${id}" was accepted`).toBe(false);
      }

      // The table is still there, which is the point of the last one.
      expect(await queryOne(`SELECT 1 AS ok FROM customer_addresses LIMIT 1`)).toBeDefined();
    },
    DB_TIMEOUT,
  );

  /* ---------------------------------------------------------- validation */

  it(
    'refuses an invalid pincode and saves nothing',
    async () => {
      const user = await makeCustomer('pincode');
      signedInAs = { id: user.id, role: 'customer' };

      const result = await addAddressAction(null, addressForm({ pincode: '12' }));

      expect(result?.ok).toBe(false);
      if (result && !result.ok) expect(result.fields?.pincode).toBeTruthy();
      expect(await listAddresses(user.id)).toHaveLength(0);
    },
    DB_TIMEOUT,
  );

  it(
    'refuses an unknown state and saves nothing',
    async () => {
      const user = await makeCustomer('state');
      signedInAs = { id: user.id, role: 'customer' };

      const result = await addAddressAction(null, addressForm({ state: 'Uttar Pradsh' }));

      expect(result?.ok).toBe(false);
      if (result && !result.ok) expect(result.fields?.state).toBeTruthy();
      expect(await listAddresses(user.id)).toHaveLength(0);
    },
    DB_TIMEOUT,
  );

  it(
    'stores the canonical spelling of a state typed in another casing',
    async () => {
      const user = await makeCustomer('canonical');
      signedInAs = { id: user.id, role: 'customer' };

      await addAddressAction(null, addressForm({ state: 'uttar pradesh' }));

      // So `stateCode()` can resolve it when an invoice needs place-of-supply.
      expect((await listAddresses(user.id))[0]!.state).toBe('Uttar Pradesh');
    },
    DB_TIMEOUT,
  );

  /* ------------------------------------------------------------- profile */

  it(
    'saves a name and phone on the signed-in account only',
    async () => {
      const a = await makeCustomer('prof-a');
      const b = await makeCustomer('prof-b');

      signedInAs = { id: a.id, role: 'customer' };
      const result = await updateProfileAction(
        null,
        form({ fullName: 'Real Name', phone: '9876500001' }),
      );
      expect(result?.ok).toBe(true);

      const rowA = await queryOne<{ full_name: string; phone: string }>(
        `SELECT full_name, phone FROM users WHERE id = $1`,
        [a.id],
      );
      const rowB = await queryOne<{ full_name: string | null }>(
        `SELECT full_name FROM users WHERE id = $1`,
        [b.id],
      );

      expect(rowA!.full_name).toBe('Real Name');
      expect(rowA!.phone).toBe('9876500001');
      expect(rowB!.full_name).toBeNull();
    },
    DB_TIMEOUT,
  );

  it(
    'reports a phone already used by another account rather than failing opaquely',
    async () => {
      const a = await makeCustomer('phone-a');
      const b = await makeCustomer('phone-b');

      signedInAs = { id: a.id, role: 'customer' };
      await updateProfileAction(null, form({ fullName: 'First', phone: '9876500002' }));

      signedInAs = { id: b.id, role: 'customer' };
      const clash = await updateProfileAction(null, form({ fullName: 'Second', phone: '9876500002' }));

      // One number, one account — the constraint that lets phone become a
      // sign-in identifier later.
      expect(clash?.ok).toBe(false);
      if (clash && !clash.ok) expect(clash.fields?.phone).toBeTruthy();
    },
    DB_TIMEOUT,
  );

  it(
    'cannot be used to change the email, because that is a credential',
    async () => {
      const user = await makeCustomer('email');
      signedInAs = { id: user.id, role: 'customer' };

      await updateProfileAction(
        null,
        form({ fullName: 'A Person', phone: '', email: 'attacker@example.invalid' }),
      );

      const row = await queryOne<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [
        user.id,
      ]);
      expect(row!.email).toBe(`email${DOMAIN}`);
    },
    DB_TIMEOUT,
  );

  /* ------------------------------------------- the order snapshot is inert */

  it(
    'leaves every existing order shipping address untouched',
    async () => {
      // Stage 2D's whole safety argument: `orders.shipping_address` is a jsonb
      // copy, not a reference, so editing or deleting a saved address cannot
      // rewrite delivery history. Asserted against the real orders in the
      // database — read only, never written.
      const before = await query<{ id: string; shipping_address: unknown }>(
        `SELECT id, shipping_address FROM orders ORDER BY id`,
      );
      expect(before.length).toBeGreaterThan(0);

      const user = await makeCustomer('snapshot');
      signedInAs = { id: user.id, role: 'customer' };

      await addAddressAction(null, addressForm());
      const saved = (await listAddresses(user.id))[0]!;
      await updateAddressAction(
        null,
        addressForm({ id: String(saved.id), line1: '99 Somewhere Else', city: 'Kanpur' }),
      );
      await archiveAddressAction(null, form({ id: String(saved.id) }));

      const after = await query<{ id: string; shipping_address: unknown }>(
        `SELECT id, shipping_address FROM orders ORDER BY id`,
      );

      expect(after).toEqual(before);
    },
    DB_TIMEOUT,
  );

  it(
    'has no foreign key pointing an order at a saved address',
    async () => {
      // The structural half of the same guarantee. A reference here is what a
      // future change might reach for, and it would make history mutable.
      const fks = await query<{ constraint_name: string }>(
        `SELECT tc.constraint_name
           FROM information_schema.table_constraints tc
           JOIN information_schema.constraint_column_usage ccu
             ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = 'orders'
            AND ccu.table_name = 'customer_addresses'`,
      );
      expect(fks).toHaveLength(0);
    },
    DB_TIMEOUT,
  );
});
