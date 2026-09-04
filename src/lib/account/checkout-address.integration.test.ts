import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query, queryOne } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { hashPassword } from '@/lib/auth/password';
import { createUser } from '@/lib/auth/users';
import { placeOrderSchema } from '@/lib/checkout/validation';
import {
  addAddress,
  archiveAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from './addresses';

/**
 * Checkout's use of the saved address book.
 *
 * The integration is deliberately thin: a saved address is copied into the same
 * `address` object the shopper could have typed, and that object is posted. No
 * address id is sent, `placeOrderSchema` is unchanged, and `place-order.ts`
 * still builds `orders.shipping_address` from the submitted values.
 *
 * That shape is what these tests are really about. It means:
 *
 *   - there is no id for the server to resolve, so the "customer A submits
 *     customer B's address id" class of bug is closed by the field not
 *     existing rather than by a check somebody has to remember;
 *   - the order snapshot is a copy from the moment of placement, so editing,
 *     archiving or re-defaulting the saved address afterwards cannot reach it.
 *
 * Fixture orders are numbered `ITG-ADDRTEST-*` and removed explicitly:
 * `orders.user_id` is `ON DELETE SET NULL`, so deleting the fixture customers
 * would orphan real rows rather than clean them up.
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
  console.warn('\n  [skipped] Checkout address tests need DATABASE_URL and DB_ALLOW_REMOTE_TESTS.\n');
}

const DB_TIMEOUT = 30_000;
const DOMAIN = '@checkoutaddr.invalid';
const ORDER_PREFIX = 'ITG-ADDRTEST-';

const HOME = {
  line1: '12 MG Road',
  line2: 'Near the depot',
  landmark: 'Opposite the bus stand',
  city: 'Lucknow',
  state: 'Uttar Pradesh',
  pincode: '226001',
  recipientName: 'A Person',
  recipientPhone: '9876543210',
};

const OFFICE = {
  ...HOME,
  line1: '5 Nariman Point',
  line2: '',
  landmark: '',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400021',
  recipientName: 'A Colleague',
};

async function makeCustomer(tag: string) {
  const user = await createUser({
    email: `${tag}${DOMAIN}`,
    passwordHash: hashPassword('irrelevant to these tests'),
    role: 'customer',
  });
  return user!;
}

/**
 * What the browser posts once an address is chosen.
 *
 * Built the way `checkout-flow.tsx` builds it — the saved row flattened into
 * the plain address object — so the payload under test is the real one.
 */
function checkoutPayload(saved: {
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
}) {
  return {
    lines: [{ variantId: 'trontek-tk12100:default', quantity: 1 }],
    contact: { name: 'A Person', phone: '9876543210', email: 'buyer@example.invalid' },
    address: {
      line1: saved.line1,
      line2: saved.line2 ?? '',
      landmark: saved.landmark ?? '',
      city: saved.city,
      state: saved.state,
      pincode: saved.pincode,
    },
    paymentMethod: 'razorpay-test' as const,
  };
}

/** A minimal order carrying the snapshot, as `place-order.ts` would write it. */
async function placeOrderWithAddress(
  userId: number,
  suffix: string,
  address: { line1: string; line2?: string; landmark?: string; city: string; state: string; pincode: string },
) {
  const orderNumber = `${ORDER_PREFIX}${suffix}`;
  const snapshot = {
    line1: address.line1,
    line2: address.line2 || undefined,
    landmark: address.landmark || undefined,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
  };
  await query(
    `INSERT INTO orders
       (order_number, user_id, customer_name, customer_phone, shipping_address,
        subtotal, total, payment_method, is_test)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $6, 'razorpay-test', true)`,
    [orderNumber, userId, 'A Person', '9876543210', JSON.stringify(snapshot), 100_00],
  );
  return orderNumber;
}

const snapshotOf = (orderNumber: string) =>
  queryOne<{ shipping_address: Record<string, string> }>(
    `SELECT shipping_address FROM orders WHERE order_number = $1`,
    [orderNumber],
  ).then((row) => row!.shipping_address);

async function removeFixtureOrders() {
  await query(`DELETE FROM orders WHERE order_number LIKE $1`, [`${ORDER_PREFIX}%`]);
}

describe.skipIf(!CONFIGURED)('checkout address integration', () => {
  beforeEach(async () => {
    await removeFixtureOrders();
    await query(`DELETE FROM users WHERE email LIKE $1`, [`%${DOMAIN}`]);
  });

  afterEach(async () => {
    await removeFixtureOrders();
  });

  afterAll(async () => {
    await removeFixtureOrders();
    await query(`DELETE FROM users WHERE email LIKE $1`, [`%${DOMAIN}`]);

    const leftover = await queryOne<{ n: string }>(
      `SELECT count(*) AS n FROM orders WHERE order_number LIKE $1`,
      [`${ORDER_PREFIX}%`],
    );
    expect(Number(leftover!.n)).toBe(0);

    await closePool();
  });

  /* ------------------------------------------------- loading and defaults */

  it(
    'offers the default address first, so checkout can take the head of the list',
    async () => {
      const user = await makeCustomer('default');
      await addAddress(user.id, HOME, false);
      const office = await addAddress(user.id, OFFICE, true);

      // `checkout/page.tsx` seeds the selection from `savedAddresses[0]`.
      const saved = await listAddresses(user.id);
      expect(saved[0]!.id).toBe(office.id);
      expect(saved[0]!.isDefault).toBe(true);
    },
    DB_TIMEOUT,
  );

  it(
    'offers every live address to choose between',
    async () => {
      const user = await makeCustomer('multiple');
      await addAddress(user.id, HOME, true);
      await addAddress(user.id, OFFICE, false);

      expect(await listAddresses(user.id)).toHaveLength(2);
    },
    DB_TIMEOUT,
  );

  it(
    'gives a customer with no saved addresses an empty list, not an error',
    async () => {
      // Checkout must stay possible for them — the picker is simply not drawn.
      const user = await makeCustomer('none');
      expect(await listAddresses(user.id)).toEqual([]);
    },
    DB_TIMEOUT,
  );

  it(
    'never offers an archived address',
    async () => {
      const user = await makeCustomer('archived');
      const home = await addAddress(user.id, HOME, false);
      await addAddress(user.id, OFFICE, false);
      await archiveAddress(user.id, home.id);

      const saved = await listAddresses(user.id);
      expect(saved.map((a) => a.id)).not.toContain(home.id);
    },
    DB_TIMEOUT,
  );

  /* ------------------------------------------------------ ownership / IDOR */

  it(
    'never loads another customer’s address into checkout',
    async () => {
      const a = await makeCustomer('load-a');
      const b = await makeCustomer('load-b');
      await addAddress(b.id, HOME, true);

      // The page reads with the session's own id, so B's address is not merely
      // hidden from A's screen — it never leaves the database for A's request.
      expect(await listAddresses(a.id)).toEqual([]);
    },
    DB_TIMEOUT,
  );

  it(
    'ignores an address id posted with an order, because the schema has no such field',
    async () => {
      // The explicit IDOR scenario: customer A submits customer B's address id.
      // There is nothing to resolve — `placeOrderSchema` strips unknown keys,
      // so the id cannot reach `place-order.ts` and cannot select an address.
      await makeCustomer('idor-a');
      const b = await makeCustomer('idor-b');
      const bAddress = await addAddress(b.id, HOME, true);

      const parsed = placeOrderSchema.parse({
        ...checkoutPayload(OFFICE),
        addressId: bAddress.id,
        address_id: bAddress.id,
        userId: b.id,
      } as Record<string, unknown>);

      expect('addressId' in parsed).toBe(false);
      expect('address_id' in parsed).toBe(false);
      expect('userId' in parsed).toBe(false);
      // Only the address A actually submitted survives.
      expect(parsed.address.line1).toBe(OFFICE.line1);
      expect(parsed.address.city).toBe(OFFICE.city);
    },
    DB_TIMEOUT,
  );

  it(
    'cannot put another customer’s address into an order through an id',
    async () => {
      const a = await makeCustomer('order-a');
      const b = await makeCustomer('order-b');
      const bAddress = await addAddress(b.id, HOME, true);

      // A can only order to values A submitted. B's saved row is untouched and
      // unreadable, and A's order carries A's own address.
      const number = await placeOrderWithAddress(a.id, 'IDOR', OFFICE);
      const snapshot = await snapshotOf(number);

      expect(snapshot.line1).toBe(OFFICE.line1);
      expect(snapshot.city).toBe(OFFICE.city);
      expect(snapshot.line1).not.toBe(HOME.line1);
      // And nothing about B changed.
      expect((await listAddresses(b.id))[0]!.id).toBe(bAddress.id);
    },
    DB_TIMEOUT,
  );

  /* ----------------------------------------------------- the order snapshot */

  it(
    'copies the selected address into the order, field for field',
    async () => {
      const user = await makeCustomer('snapshot');
      const home = await addAddress(user.id, HOME, true);
      const saved = (await listAddresses(user.id)).find((a) => a.id === home.id)!;

      const number = await placeOrderWithAddress(user.id, 'COPY', saved);
      const snapshot = await snapshotOf(number);

      expect(snapshot).toEqual({
        line1: HOME.line1,
        line2: HOME.line2,
        landmark: HOME.landmark,
        city: HOME.city,
        state: HOME.state,
        pincode: HOME.pincode,
      });
    },
    DB_TIMEOUT,
  );

  it(
    'records the non-default address when one is chosen for this order',
    async () => {
      const user = await makeCustomer('switch');
      await addAddress(user.id, HOME, true);
      const office = await addAddress(user.id, OFFICE, false);
      const chosen = (await listAddresses(user.id)).find((a) => a.id === office.id)!;

      const number = await placeOrderWithAddress(user.id, 'SWITCH', chosen);

      expect((await snapshotOf(number)).city).toBe(OFFICE.city);
      // Choosing for one order is not a statement about the next one.
      const stillDefault = (await listAddresses(user.id)).find((a) => a.isDefault)!;
      expect(stillDefault.city).toBe(HOME.city);
    },
    DB_TIMEOUT,
  );

  it(
    'does not change the order when the saved address is later edited',
    async () => {
      const user = await makeCustomer('edit');
      const home = await addAddress(user.id, HOME, true);
      const number = await placeOrderWithAddress(user.id, 'EDIT', HOME);
      const before = await snapshotOf(number);

      await updateAddress(user.id, home.id, {
        ...HOME,
        line1: '99 Somewhere Else',
        city: 'Kanpur',
      });

      // The order copied the values; it does not point at the row. This is the
      // whole reason `shipping_address` is jsonb and not a foreign key.
      expect(await snapshotOf(number)).toEqual(before);
      expect((await snapshotOf(number)).line1).toBe(HOME.line1);
    },
    DB_TIMEOUT,
  );

  it(
    'does not change the order when the saved address is later archived',
    async () => {
      const user = await makeCustomer('archive');
      const home = await addAddress(user.id, HOME, false);
      await addAddress(user.id, OFFICE, false);
      const number = await placeOrderWithAddress(user.id, 'ARCH', HOME);
      const before = await snapshotOf(number);

      await archiveAddress(user.id, home.id);

      expect(await snapshotOf(number)).toEqual(before);
    },
    DB_TIMEOUT,
  );

  it(
    'does not change the order when the default address is later changed',
    async () => {
      const user = await makeCustomer('redefault');
      await addAddress(user.id, HOME, true);
      const office = await addAddress(user.id, OFFICE, false);
      const number = await placeOrderWithAddress(user.id, 'REDEF', HOME);
      const before = await snapshotOf(number);

      await setDefaultAddress(user.id, office.id);

      expect(await snapshotOf(number)).toEqual(before);
      expect((await snapshotOf(number)).city).toBe(HOME.city);
    },
    DB_TIMEOUT,
  );

  /* ------------------------------------------------ validation is reused */

  it(
    'passes a saved address straight through the existing order schema',
    async () => {
      // The reason `customer_addresses` mirrors `ShippingAddress` field for
      // field: there is no mapping layer between the address book and
      // placement, so there is nothing to drop a landmark or swap two lines.
      const user = await makeCustomer('roundtrip');
      await addAddress(user.id, HOME, true);
      const saved = (await listAddresses(user.id))[0]!;

      const parsed = placeOrderSchema.parse(checkoutPayload(saved));

      expect(parsed.address).toEqual({
        line1: HOME.line1,
        line2: HOME.line2,
        landmark: HOME.landmark,
        city: HOME.city,
        state: HOME.state,
        pincode: HOME.pincode,
      });
    },
    DB_TIMEOUT,
  );

  it(
    'still rejects a malformed address, so checkout validation has not regressed',
    async () => {
      // Stage 2D adds a way to *choose* an address, not a way to skip the rules.
      const bad = checkoutPayload({ ...HOME, pincode: '12' });
      expect(placeOrderSchema.safeParse(bad).success).toBe(false);

      const noStreet = checkoutPayload({ ...HOME, line1: '12' });
      expect(placeOrderSchema.safeParse(noStreet).success).toBe(false);

      const noCity = checkoutPayload({ ...HOME, city: '' });
      expect(placeOrderSchema.safeParse(noCity).success).toBe(false);
    },
    DB_TIMEOUT,
  );

  it(
    'holds no foreign key from an order to a saved address',
    async () => {
      // The structural guarantee behind the three tests above. A reference here
      // is what a later change might reach for, and it would make delivery
      // history mutable.
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

  it(
    'has no address id column on orders',
    async () => {
      const columns = await query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'orders'`,
      );
      const names = columns.map((c) => c.column_name);
      expect(names).toContain('shipping_address');
      expect(names).not.toContain('address_id');
      expect(names).not.toContain('shipping_address_id');
    },
    DB_TIMEOUT,
  );
});
