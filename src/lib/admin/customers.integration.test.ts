import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { customerPlaces, customerProfiles, customerPurchases } from './customers';

/**
 * Customer profiles by place, and what each of them bought.
 *
 * Three properties matter here and none can be checked without a database.
 *
 *   **Identity.** A signed-in buyer is one customer however many orders they
 *   place; a guest is identified by the address on their order, so two guest
 *   orders from one mailbox are one person rather than two. This is the rule
 *   `geography()` deliberately does not use, and the difference is asserted
 *   below so nobody "fixes" one to match the other by accident.
 *
 *   **Provenance.** Location comes from `orders.shipping_address`, the jsonb
 *   snapshot of somewhere goods were delivered, never from
 *   `customer_addresses`, which a customer can edit at any time.
 *   `geography.integration.test.ts` holds the same line for the analytics page;
 *   this holds it for the profile list.
 *
 *   **Aggregation.** One row per product per customer, quantities summed across
 *   orders. A shopper who bought the same battery twice is one line saying two,
 *   not two lines saying one.
 *
 * Fixtures sit in 2099 for the reason the other analytics suites do: these
 * functions aggregate every paid order in their window, so a fixture in a real
 * trading month would sum live data into the assertions.
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
      ? '\n  [skipped] Customer profile tests write real rows and DATABASE_URL is remote. ' +
          'Set DB_ALLOW_REMOTE_TESTS=true to run them anyway.\n'
      : '\n  [skipped] Customer profile tests need DATABASE_URL pointing at a local ' +
          'itarang_dev database. See README → Database.\n',
  );
}

const PHONE = '9000000078';
const ACCOUNT = 'profiles.fixture@example.com';
const GUEST = 'profiles.guest@example.com';

const FROM = new Date('2099-08-01T00:00:00Z');
const TO = new Date('2099-09-01T00:00:00Z');
const WHEN = '2099-08-15T09:00:00Z';

let counter = 0;

interface SeedItem {
  title: string;
  sku: string;
  variantTitle?: string | null;
  quantity: number;
  /** Paise, per unit. */
  price: number;
}

async function seedOrder(options: {
  city: string;
  state: string;
  userId?: number | null;
  email?: string | null;
  name?: string;
  items: SeedItem[];
  capturedAt?: string;
  paymentStatus?: 'paid' | 'pending';
  paymentMethod?: 'razorpay-test' | 'cod';
}): Promise<number> {
  counter += 1;
  const {
    city,
    state,
    userId = null,
    email = null,
    name = 'Profile Buyer',
    items,
    capturedAt = WHEN,
    paymentStatus = 'paid',
    paymentMethod = 'razorpay-test',
  } = options;

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const rows = await query<{ id: number }>(
    `INSERT INTO orders (
       order_number, user_id, status, payment_status, customer_name, customer_phone,
       customer_email, shipping_address, subtotal, total, payment_method, is_test, created_at
     ) VALUES (
       $1, $2, 'confirmed', $3, $4, $5, $6,
       jsonb_build_object('line1', '1 Test St', 'city', $7::text, 'state', $8::text,
                          'pincode', '411001'),
       $9, $9, $10, true, $11
     )
     RETURNING id`,
    [
      `ITG-CP-${String(counter).padStart(6, '0')}`,
      userId,
      paymentStatus,
      name,
      PHONE,
      email,
      city,
      state,
      total,
      paymentMethod,
      capturedAt,
    ],
  );

  const orderId = rows[0]!.id;

  for (const item of items) {
    await query(
      `INSERT INTO order_items (
         order_id, product_id, variant_id, sku, title, variant_title,
         unit_mrp, unit_price, quantity, line_total
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9)`,
      [
        orderId,
        `prod-${item.sku}`,
        `var-${item.sku}`,
        item.sku,
        item.title,
        item.variantTitle ?? null,
        item.price,
        item.quantity,
        item.price * item.quantity,
      ],
    );
  }

  if (paymentStatus === 'paid' && paymentMethod !== 'cod') {
    await query(
      `INSERT INTO payments (order_id, provider, gateway_payment_id, status, amount,
                             signature_verified, created_at)
       VALUES ($1, $2, $3, 'paid', $4, true, $5)`,
      [orderId, paymentMethod, `pay_cp_${counter}`, total, capturedAt],
    );
  }

  return orderId;
}

async function makeCustomer(fullName: string): Promise<number> {
  const rows = await query<{ id: number }>(
    `INSERT INTO users (email, password_hash, role, full_name)
     VALUES ($1, 'x', 'customer', $2) RETURNING id`,
    [ACCOUNT, fullName],
  );
  return rows[0]!.id;
}

async function cleanUp(): Promise<void> {
  await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
  await query(`DELETE FROM users WHERE email = $1`, [ACCOUNT]);
  counter = 0;
}

const BATTERY: SeedItem = {
  title: 'Powercube 1.4',
  sku: 'TK12100-01',
  variantTitle: '12V 100Ah',
  quantity: 1,
  price: 4200000,
};

const CHARGER: SeedItem = {
  title: 'Lithium charger',
  sku: 'TK-CHG-01',
  variantTitle: null,
  quantity: 1,
  price: 500000,
};

describe.skipIf(!CONFIGURED)('customer profiles', () => {
  beforeEach(cleanUp);

  afterAll(async () => {
    await cleanUp();
    await closePool();
  });

  it('lists a signed-in customer with their location and purchases', async () => {
    const userId = await makeCustomer('Asha Rao');
    await seedOrder({ city: 'Pune', state: 'Maharashtra', userId, items: [BATTERY] });

    const { rows, total } = await customerProfiles(FROM, TO);

    expect(total).toBe(1);
    expect(rows[0]).toMatchObject({
      userId,
      name: 'Asha Rao',
      email: ACCOUNT,
      city: 'Pune',
      state: 'Maharashtra',
      stateCode: '27',
      orders: 1,
      gross: 4200000,
    });
    expect(rows[0]!.products).toEqual([
      {
        title: 'Powercube 1.4',
        variantTitle: '12V 100Ah',
        sku: 'TK12100-01',
        quantity: 1,
        value: 4200000,
      },
    ]);
  });

  it('collapses a customer’s several orders into one profile', async () => {
    const userId = await makeCustomer('Asha Rao');
    await seedOrder({ city: 'Pune', state: 'Maharashtra', userId, items: [BATTERY] });
    await seedOrder({ city: 'Pune', state: 'Maharashtra', userId, items: [CHARGER] });

    const { rows, total } = await customerProfiles(FROM, TO);

    expect(total).toBe(1);
    expect(rows[0]).toMatchObject({ orders: 2, gross: 4700000 });
    expect(rows[0]!.products.map((p) => p.sku)).toEqual(['TK12100-01', 'TK-CHG-01']);
  });

  it('sums quantities for a product bought more than once', async () => {
    const userId = await makeCustomer('Asha Rao');
    await seedOrder({ city: 'Pune', state: 'Maharashtra', userId, items: [BATTERY] });
    await seedOrder({
      city: 'Pune',
      state: 'Maharashtra',
      userId,
      items: [{ ...BATTERY, quantity: 2 }],
    });

    const { rows } = await customerProfiles(FROM, TO);
    expect(rows[0]!.products).toHaveLength(1);
    expect(rows[0]!.products[0]).toMatchObject({ quantity: 3, value: 12600000 });
  });

  it('treats two guest orders from one address as one customer', async () => {
    // The rule geography() deliberately does not use. A row here is a person.
    await seedOrder({ city: 'Jaipur', state: 'Rajasthan', email: GUEST, items: [BATTERY] });
    await seedOrder({ city: 'Jaipur', state: 'Rajasthan', email: GUEST, items: [CHARGER] });

    const { rows, total } = await customerProfiles(FROM, TO);
    expect(total).toBe(1);
    expect(rows[0]).toMatchObject({ userId: null, orders: 2, email: GUEST });
  });

  it('keeps guest orders with no address apart', async () => {
    // Nothing links them, so claiming they are one person would be an invention.
    await seedOrder({ city: 'Jaipur', state: 'Rajasthan', items: [BATTERY] });
    await seedOrder({ city: 'Jaipur', state: 'Rajasthan', items: [CHARGER] });

    expect((await customerProfiles(FROM, TO)).total).toBe(2);
  });

  it('reads location from the order, so a later delivery moves the profile', async () => {
    const userId = await makeCustomer('Asha Rao');
    await seedOrder({
      city: 'Pune',
      state: 'Maharashtra',
      userId,
      items: [BATTERY],
      capturedAt: '2099-08-02T09:00:00Z',
    });
    await seedOrder({
      city: 'Jaipur',
      state: 'Rajasthan',
      userId,
      items: [CHARGER],
      capturedAt: '2099-08-20T09:00:00Z',
    });

    const { rows } = await customerProfiles(FROM, TO);
    // The most recent delivery is where they are now; both orders still count.
    expect(rows[0]).toMatchObject({ city: 'Jaipur', state: 'Rajasthan', orders: 2 });
  });

  it('folds the spelling of a place typed by a shopper', async () => {
    await seedOrder({ city: '  pune ', state: 'MAHARASHTRA', email: GUEST, items: [BATTERY] });
    const { rows } = await customerProfiles(FROM, TO);
    expect(rows[0]).toMatchObject({ city: 'Pune', state: 'Maharashtra' });
  });

  it('orders by spend, biggest first', async () => {
    await seedOrder({ city: 'Pune', state: 'Maharashtra', email: GUEST, items: [CHARGER] });
    await seedOrder({ city: 'Jaipur', state: 'Rajasthan', items: [BATTERY] });

    const { rows } = await customerProfiles(FROM, TO);
    expect(rows.map((r) => r.gross)).toEqual([4200000, 500000]);
  });
});

describe.skipIf(!CONFIGURED)('what a customer profile counts', () => {
  beforeEach(cleanUp);

  afterAll(async () => {
    await cleanUp();
    await closePool();
  });

  it('excludes an unpaid order', async () => {
    await seedOrder({
      city: 'Pune',
      state: 'Maharashtra',
      items: [BATTERY],
      paymentStatus: 'pending',
    });
    expect((await customerProfiles(FROM, TO)).rows).toEqual([]);
  });

  it('excludes cash on delivery, like every other figure in the console', async () => {
    await seedOrder({
      city: 'Pune',
      state: 'Maharashtra',
      items: [BATTERY],
      paymentMethod: 'cod',
    });
    expect((await customerProfiles(FROM, TO)).rows).toEqual([]);
  });

  it('excludes a capture outside the window', async () => {
    await seedOrder({
      city: 'Pune',
      state: 'Maharashtra',
      items: [BATTERY],
      capturedAt: '2099-07-15T09:00:00Z',
    });
    expect((await customerProfiles(FROM, TO)).rows).toEqual([]);
  });
});

describe.skipIf(!CONFIGURED)('filtering and paging', () => {
  beforeEach(cleanUp);

  afterAll(async () => {
    await cleanUp();
    await closePool();
  });

  it('narrows to one state', async () => {
    await seedOrder({ city: 'Pune', state: 'Maharashtra', email: GUEST, items: [BATTERY] });
    await seedOrder({ city: 'Jaipur', state: 'Rajasthan', items: [CHARGER] });

    const { rows, total } = await customerProfiles(FROM, TO, { state: 'Rajasthan' });
    expect(total).toBe(1);
    expect(rows[0]).toMatchObject({ state: 'Rajasthan' });
  });

  it('narrows to one city', async () => {
    await seedOrder({ city: 'Pune', state: 'Maharashtra', email: GUEST, items: [BATTERY] });
    await seedOrder({ city: 'Mumbai', state: 'Maharashtra', items: [CHARGER] });

    const { rows } = await customerProfiles(FROM, TO, { state: 'Maharashtra', city: 'Mumbai' });
    expect(rows.map((r) => r.city)).toEqual(['Mumbai']);
  });

  it('searches name, email and phone alike', async () => {
    const userId = await makeCustomer('Asha Rao');
    await seedOrder({
      city: 'Pune',
      state: 'Maharashtra',
      userId,
      name: 'Asha Rao',
      items: [BATTERY],
    });
    await seedOrder({ city: 'Jaipur', state: 'Rajasthan', name: 'Ravi Kumar', items: [CHARGER] });

    expect((await customerProfiles(FROM, TO, { search: 'asha' })).total).toBe(1);
    expect((await customerProfiles(FROM, TO, { search: PHONE })).total).toBe(2);
  });

  it('reports the unpaged total beside a page of rows', async () => {
    // Otherwise the pager cannot say "1–1 of 2" and pages off the end of a
    // filtered list — the failure the shared scan exists to prevent.
    await seedOrder({ city: 'Pune', state: 'Maharashtra', email: GUEST, items: [BATTERY] });
    await seedOrder({ city: 'Jaipur', state: 'Rajasthan', items: [CHARGER] });

    const page = await customerProfiles(FROM, TO, {}, 1, 0);
    expect(page.rows).toHaveLength(1);
    expect(page.total).toBe(2);

    const second = await customerProfiles(FROM, TO, {}, 1, 1);
    expect(second.rows[0]!.gross).toBe(500000);
  });

  it('offers only places that have customers in the window', async () => {
    await seedOrder({ city: 'Pune', state: 'Maharashtra', email: GUEST, items: [BATTERY] });
    await seedOrder({ city: 'Mumbai', state: 'Maharashtra', items: [CHARGER] });

    const places = await customerPlaces(FROM, TO);
    const maharashtra = places.find((p) => p.state === 'Maharashtra');
    expect(maharashtra?.cities).toEqual(['Mumbai', 'Pune']);
  });
});

describe.skipIf(!CONFIGURED)('one customer’s purchase history', () => {
  beforeEach(cleanUp);

  afterAll(async () => {
    await cleanUp();
    await closePool();
  });

  it('is not limited to a reporting window', async () => {
    // The profile page asks what this customer has ever bought, which is a
    // different question from what the console is reporting on this month.
    const userId = await makeCustomer('Asha Rao');
    await seedOrder({
      city: 'Pune',
      state: 'Maharashtra',
      userId,
      items: [BATTERY],
      capturedAt: '2099-01-05T09:00:00Z',
    });
    await seedOrder({
      city: 'Pune',
      state: 'Maharashtra',
      userId,
      items: [CHARGER],
      capturedAt: '2099-08-15T09:00:00Z',
    });

    const purchases = await customerPurchases(userId);
    expect(purchases.map((p) => p.sku)).toEqual(['TK12100-01', 'TK-CHG-01']);
  });

  it('excludes unpaid and cash-on-delivery orders', async () => {
    const userId = await makeCustomer('Asha Rao');
    await seedOrder({
      city: 'Pune',
      state: 'Maharashtra',
      userId,
      items: [BATTERY],
      paymentStatus: 'pending',
    });
    await seedOrder({
      city: 'Pune',
      state: 'Maharashtra',
      userId,
      items: [CHARGER],
      paymentMethod: 'cod',
    });

    expect(await customerPurchases(userId)).toEqual([]);
  });

  it('is empty for an account that has never bought anything', async () => {
    expect(await customerPurchases(await makeCustomer('Asha Rao'))).toEqual([]);
  });
});
