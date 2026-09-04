import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query, queryOne } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { hashPassword } from '@/lib/auth/password';
import { createUser } from '@/lib/auth/users';
import { orders } from '@/lib/orders/postgres-repository';

/**
 * Order history belongs to one account and is filtered in SQL.
 *
 * `security.test.ts` already asserts that `listOrdersForUser` mentions
 * `user_id` in its query text. That is a tripwire against the constraint being
 * deleted; it is not evidence that the isolation works. This runs the real
 * repository against real rows and checks that one customer's history cannot
 * contain another's order.
 *
 * **Fixture orders are cleaned up by order number, not by deleting the user.**
 * `orders.user_id` is `ON DELETE SET NULL` by design — a guest order outlives
 * the account that placed it — so removing the fixture customers would leave
 * orphaned order rows behind in a real table. Every row this suite creates is
 * numbered `ITG-OWNTEST-*` and deleted explicitly, and a final assertion proves
 * none survived.
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
  console.warn('\n  [skipped] Order history tests need DATABASE_URL and DB_ALLOW_REMOTE_TESTS.\n');
}

const DB_TIMEOUT = 30_000;
const DOMAIN = '@orderhistory.invalid';
const ORDER_PREFIX = 'ITG-OWNTEST-';

const ADDRESS = {
  line1: '12 MG Road',
  city: 'Lucknow',
  state: 'Uttar Pradesh',
  pincode: '226001',
};

async function makeCustomer(tag: string) {
  const user = await createUser({
    email: `${tag}${DOMAIN}`,
    passwordHash: hashPassword('irrelevant to these tests'),
    role: 'customer',
  });
  return user!;
}

/** A minimal, clearly-marked test order owned by one account. */
async function makeOrder(userId: number, suffix: string) {
  const orderNumber = `${ORDER_PREFIX}${suffix}`;
  await query(
    `INSERT INTO orders
       (order_number, user_id, customer_name, customer_phone, shipping_address,
        subtotal, total, payment_method, is_test)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $6, 'mock', true)`,
    [orderNumber, userId, 'Test Person', '9876543210', JSON.stringify(ADDRESS), 100_00],
  );
  return orderNumber;
}

async function removeFixtureOrders() {
  await query(`DELETE FROM orders WHERE order_number LIKE $1`, [`${ORDER_PREFIX}%`]);
}

describe.skipIf(!CONFIGURED)('order history', () => {
  beforeEach(async () => {
    await removeFixtureOrders();
    await query(`DELETE FROM users WHERE email LIKE $1`, [`%${DOMAIN}`]);
  });

  afterEach(async () => {
    // Before the users go, or `ON DELETE SET NULL` orphans them.
    await removeFixtureOrders();
  });

  afterAll(async () => {
    await removeFixtureOrders();
    await query(`DELETE FROM users WHERE email LIKE $1`, [`%${DOMAIN}`]);

    const leftover = await queryOne<{ n: string }>(
      `SELECT count(*) AS n FROM orders WHERE order_number LIKE $1`,
      [`${ORDER_PREFIX}%`],
    );
    // Proving the cleanup rather than assuming it: these rows live in the real
    // orders table alongside genuine ones.
    expect(Number(leftover!.n)).toBe(0);

    await closePool();
  });

  it(
    'returns a customer’s own orders',
    async () => {
      const user = await makeCustomer('mine');
      const number = await makeOrder(user.id, 'MINE-1');

      const result = await orders().listOrdersForUser(user.id, 20);

      expect(result.orders.map((o) => o.orderNumber)).toContain(number);
    },
    DB_TIMEOUT,
  );

  it(
    'never includes another customer’s order',
    async () => {
      const a = await makeCustomer('iso-a');
      const b = await makeCustomer('iso-b');
      const aNumber = await makeOrder(a.id, 'ISO-A');
      const bNumber = await makeOrder(b.id, 'ISO-B');

      const forA = await orders().listOrdersForUser(a.id, 20);
      const numbers = forA.orders.map((o) => o.orderNumber);

      expect(numbers).toContain(aNumber);
      // Filtered in SQL, so B's order is never in hand — there is no moment at
      // which a forgotten check could leak it.
      expect(numbers).not.toContain(bNumber);
    },
    DB_TIMEOUT,
  );

  it(
    'returns nothing for an account with no orders',
    async () => {
      const user = await makeCustomer('empty');
      const result = await orders().listOrdersForUser(user.id, 20);
      expect(result.orders).toHaveLength(0);
    },
    DB_TIMEOUT,
  );

  it(
    'does not reach guest orders that belong to nobody',
    async () => {
      const user = await makeCustomer('guest');
      await query(
        `INSERT INTO orders
           (order_number, user_id, customer_name, customer_phone, shipping_address,
            subtotal, total, payment_method, is_test)
         VALUES ($1, NULL, $2, $3, $4::jsonb, $5, $5, 'mock', true)`,
        [`${ORDER_PREFIX}GUEST`, 'A Guest', '9876543211', JSON.stringify(ADDRESS), 100_00],
      );

      const result = await orders().listOrdersForUser(user.id, 20);
      expect(result.orders.map((o) => o.orderNumber)).not.toContain(`${ORDER_PREFIX}GUEST`);
    },
    DB_TIMEOUT,
  );

  it(
    'leaves the order and its address snapshot exactly as written',
    async () => {
      // Stage 2C touches no order data. Asserted rather than assumed, because
      // the account page now reads three things for one customer and it would
      // be easy for one of them to start writing.
      const user = await makeCustomer('snapshot');
      const number = await makeOrder(user.id, 'SNAP');

      const before = await queryOne<{ shipping_address: unknown; total: string }>(
        `SELECT shipping_address, total FROM orders WHERE order_number = $1`,
        [number],
      );

      await orders().listOrdersForUser(user.id, 20);

      const after = await queryOne<{ shipping_address: unknown; total: string }>(
        `SELECT shipping_address, total FROM orders WHERE order_number = $1`,
        [number],
      );

      expect(after).toEqual(before);
      expect(after!.shipping_address).toEqual(ADDRESS);
    },
    DB_TIMEOUT,
  );
});
