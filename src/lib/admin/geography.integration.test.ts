import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { geography } from './analytics';
import { customerDetail } from './funnel';

/**
 * Customer geography — the analytics dimension and the profile field.
 *
 * The property that matters most here is the *source*. Both surfaces read
 * `orders.shipping_address`, a jsonb snapshot of an address goods were actually
 * delivered to, rather than `customer_addresses`, which the customer can edit
 * or delete at any time. `0015_customer_addresses.sql` argues that distinction
 * at length for order history; reporting revenue by geography has exactly the
 * same exposure — sourcing it from the address book would move last quarter's
 * revenue to a new city the moment somebody moved house. There is a test below
 * that holds that line.
 *
 * Fixtures sit in 2099 for the same reason the existing analytics tests do:
 * `geography()` aggregates every paid order in its window, so a fixture in a
 * real trading month would sum live data into the assertions.
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
  console.warn(
    REMOTE
      ? '\n  [skipped] Geography integration tests write real rows and DATABASE_URL is remote. ' +
          'Set DB_ALLOW_REMOTE_TESTS=true to run them anyway.\n'
      : '\n  [skipped] Geography integration tests need DATABASE_URL pointing at a local ' +
          'itarang_dev database. See README → Database.\n',
  );
}

const PHONE = '9000000077';
const EMAIL = 'geography.fixture@example.com';

/** A window far enough out that no real or seeded order falls inside it. */
const FROM = new Date('2099-06-01T00:00:00Z');
const TO = new Date('2099-07-01T00:00:00Z');
const WHEN = '2099-06-15T09:00:00Z';

let counter = 0;

async function seedOrder(options: {
  city: string;
  state: string;
  total: number;
  userId?: number | null;
  createdAt?: string;
  paymentStatus?: 'paid' | 'pending';
  paymentMethod?: 'razorpay-test' | 'cod';
}): Promise<number> {
  counter += 1;
  const {
    city,
    state,
    total,
    userId = null,
    createdAt = WHEN,
    paymentStatus = 'paid',
    paymentMethod = 'razorpay-test',
  } = options;

  const rows = await query<{ id: number }>(
    `INSERT INTO orders (
       order_number, user_id, status, payment_status, customer_name, customer_phone,
       shipping_address, subtotal, total, payment_method, is_test, created_at
     ) VALUES (
       $1, $2, 'confirmed', $3, 'Geography Buyer', $4,
       jsonb_build_object('line1', '1 Test St', 'city', $5::text, 'state', $6::text,
                          'pincode', '411001'),
       $7, $7, $8, true, $9
     )
     RETURNING id`,
    [
      `ITG-GEO-${String(counter).padStart(6, '0')}`,
      userId,
      paymentStatus,
      PHONE,
      city,
      state,
      total,
      paymentMethod,
      createdAt,
    ],
  );

  const orderId = rows[0]!.id;

  if (paymentStatus === 'paid' && paymentMethod !== 'cod') {
    await query(
      `INSERT INTO payments (order_id, provider, gateway_payment_id, status, amount,
                             signature_verified, created_at)
       VALUES ($1, $2, $3, 'paid', $4, true, $5)`,
      [orderId, paymentMethod, `pay_geo_${counter}`, total, createdAt],
    );
  }

  return orderId;
}

async function makeCustomer(): Promise<number> {
  const rows = await query<{ id: number }>(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, 'x', 'customer') RETURNING id`,
    [EMAIL],
  );
  return rows[0]!.id;
}

async function cleanUp(): Promise<void> {
  await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
  await query(`DELETE FROM users WHERE email = $1`, [EMAIL]);
  counter = 0;
}

describe.skipIf(!CONFIGURED)('revenue by geography', () => {
  beforeEach(cleanUp);

  afterAll(async () => {
    await cleanUp();
    await closePool();
  });

  it('groups paid orders by state with their cities', async () => {
    await seedOrder({ city: 'Pune', state: 'Maharashtra', total: 100000 });
    await seedOrder({ city: 'Mumbai', state: 'Maharashtra', total: 300000 });
    await seedOrder({ city: 'Jaipur', state: 'Rajasthan', total: 50000 });

    const rows = await geography(FROM, TO);

    expect(rows.map((row) => row.state)).toEqual(['Maharashtra', 'Rajasthan']);
    expect(rows[0]).toMatchObject({ state: 'Maharashtra', orders: 2, gross: 400000 });
    // Cities ordered by revenue, so the biggest market reads first.
    expect(rows[0].cities.map((c) => c.city)).toEqual(['Mumbai', 'Pune']);
  });

  it('orders states by revenue, not alphabetically', async () => {
    await seedOrder({ city: 'Jaipur', state: 'Rajasthan', total: 900000 });
    await seedOrder({ city: 'Pune', state: 'Maharashtra', total: 100000 });

    expect((await geography(FROM, TO)).map((row) => row.state)).toEqual([
      'Rajasthan',
      'Maharashtra',
    ]);
  });

  it('resolves the GST state code', async () => {
    await seedOrder({ city: 'Pune', state: 'Maharashtra', total: 100000 });
    expect((await geography(FROM, TO))[0].stateCode).toBe('27');
  });

  it('reports no code for a state name the checkout list does not know', async () => {
    // Never invented. An unrecognised name still reports its revenue.
    await seedOrder({ city: 'Nowhere', state: 'Atlantis', total: 100000 });
    const row = (await geography(FROM, TO)).find((r) => r.state === 'Atlantis');
    expect(row?.stateCode).toBeNull();
    expect(row?.gross).toBe(100000);
  });
});

describe.skipIf(!CONFIGURED)('what geography counts', () => {
  beforeEach(cleanUp);

  afterAll(async () => {
    await cleanUp();
    await closePool();
  });

  it('excludes an unpaid order', async () => {
    await seedOrder({ city: 'Pune', state: 'Maharashtra', total: 100000, paymentStatus: 'pending' });
    expect(await geography(FROM, TO)).toEqual([]);
  });

  it('excludes cash on delivery, like every other figure on the screen', async () => {
    await seedOrder({ city: 'Pune', state: 'Maharashtra', total: 100000, paymentMethod: 'cod' });
    expect(await geography(FROM, TO)).toEqual([]);
  });

  it('excludes orders captured outside the window', async () => {
    await seedOrder({
      city: 'Pune',
      state: 'Maharashtra',
      total: 100000,
      createdAt: '2099-05-01T09:00:00Z',
    });
    expect(await geography(FROM, TO)).toEqual([]);
  });

  it('drops an order whose address states no city or state', async () => {
    await seedOrder({ city: '', state: '', total: 100000 });
    expect(await geography(FROM, TO)).toEqual([]);
  });
});

describe.skipIf(!CONFIGURED)('folding what shoppers typed', () => {
  beforeEach(cleanUp);

  afterAll(async () => {
    await cleanUp();
    await closePool();
  });

  it('treats differing case and padding as one place', async () => {
    await seedOrder({ city: 'pune', state: 'maharashtra', total: 100000 });
    await seedOrder({ city: '  PUNE ', state: ' Maharashtra ', total: 200000 });

    const rows = await geography(FROM, TO);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ state: 'Maharashtra', orders: 2, gross: 300000 });
    expect(rows[0].cities).toEqual([{ city: 'Pune', orders: 2, gross: 300000 }]);
  });

  it('collapses internal whitespace', async () => {
    // The regex uses the POSIX class rather than a backslash escape: a
    // JavaScript string literal silently drops an unrecognised escape, so the
    // obvious backslash-s would have reached Postgres as a literal "s" and
    // matched the wrong thing entirely.
    await seedOrder({ city: 'New  Delhi', state: 'Delhi', total: 100000 });
    await seedOrder({ city: 'New Delhi', state: 'Delhi', total: 100000 });

    const rows = await geography(FROM, TO);
    expect(rows[0].cities).toEqual([{ city: 'New Delhi', orders: 2, gross: 200000 }]);
  });
});

describe.skipIf(!CONFIGURED)('customers counted', () => {
  beforeEach(cleanUp);

  afterAll(async () => {
    await cleanUp();
    await closePool();
  });

  it('counts one signed-in customer once across repeat orders', async () => {
    const userId = await makeCustomer();
    await seedOrder({ city: 'Pune', state: 'Maharashtra', total: 100000, userId });
    await seedOrder({ city: 'Pune', state: 'Maharashtra', total: 100000, userId });

    const rows = await geography(FROM, TO);
    expect(rows[0]).toMatchObject({ orders: 2, customers: 1 });
  });

  it('counts each guest order as its own customer', async () => {
    // A guest order has no user_id, so a plain DISTINCT on it would collapse
    // every guest in the country into one.
    await seedOrder({ city: 'Pune', state: 'Maharashtra', total: 100000 });
    await seedOrder({ city: 'Pune', state: 'Maharashtra', total: 100000 });

    expect((await geography(FROM, TO))[0]).toMatchObject({ orders: 2, customers: 2 });
  });
});

describe.skipIf(!CONFIGURED)('a customer location on the profile', () => {
  beforeEach(cleanUp);

  afterAll(async () => {
    await cleanUp();
    await closePool();
  });

  it('is null for a customer with no order and no saved address', async () => {
    const userId = await makeCustomer();
    expect((await customerDetail(userId))?.location).toBeNull();
  });

  it('comes from the most recent order, and says so', async () => {
    const userId = await makeCustomer();
    await seedOrder({
      city: 'Pune',
      state: 'Maharashtra',
      total: 100000,
      userId,
      createdAt: '2099-06-02T09:00:00Z',
    });
    await seedOrder({
      city: 'Jaipur',
      state: 'Rajasthan',
      total: 100000,
      userId,
      createdAt: '2099-06-20T09:00:00Z',
    });

    expect((await customerDetail(userId))?.location).toMatchObject({
      city: 'Jaipur',
      state: 'Rajasthan',
      source: 'order',
    });
  });

  it('falls back to a saved address for somebody who has not ordered', async () => {
    const userId = await makeCustomer();
    await query(
      `INSERT INTO customer_addresses
         (user_id, recipient_name, recipient_phone, line1, city, state, pincode, is_default)
       VALUES ($1, 'Geography Buyer', $2, '1 Test St', 'Kochi', 'Kerala', '682001', true)`,
      [userId, PHONE],
    );

    expect((await customerDetail(userId))?.location).toMatchObject({
      city: 'Kochi',
      state: 'Kerala',
      source: 'saved-address',
    });
  });

  it('prefers a delivered address over an editable saved one', async () => {
    // The whole reason `source` exists. An order address is evidence; a saved
    // address is a current intention the customer can change at any time.
    const userId = await makeCustomer();
    await query(
      `INSERT INTO customer_addresses
         (user_id, recipient_name, recipient_phone, line1, city, state, pincode, is_default)
       VALUES ($1, 'Geography Buyer', $2, '1 Test St', 'Kochi', 'Kerala', '682001', true)`,
      [userId, PHONE],
    );
    await seedOrder({ city: 'Pune', state: 'Maharashtra', total: 100000, userId });

    expect((await customerDetail(userId))?.location).toMatchObject({
      city: 'Pune',
      source: 'order',
    });
  });

  it('ignores an address the customer archived', async () => {
    const userId = await makeCustomer();
    await query(
      `INSERT INTO customer_addresses
         (user_id, recipient_name, recipient_phone, line1, city, state, pincode,
          is_default, archived_at)
       VALUES ($1, 'Geography Buyer', $2, '1 Test St', 'Kochi', 'Kerala', '682001',
               false, now())`,
      [userId, PHONE],
    );

    expect((await customerDetail(userId))?.location).toBeNull();
  });
});
