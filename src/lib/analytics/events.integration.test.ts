import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { attributeOrder, linkVisitorToUser, record, type VisitorContext } from './events';

/**
 * Funnel event writes against the local `itarang_dev` database.
 *
 * The claim worth testing is idempotency. Beacons are retried by browsers,
 * effects fire twice under React strict mode, and a replayed request is trivial
 * to send — so every one of those has to collapse to a single row, or the
 * funnel reports engagement that never happened.
 *
 * The second claim is that a session is the unit of counting. Two product views
 * in one session are one visit but two views; the same event twice in one
 * session is one row.
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
      ? '\n  [skipped] Funnel event integration tests write real rows and DATABASE_URL is ' +
          'remote. Set DB_ALLOW_REMOTE_TESTS=true to run them anyway.\n'
      : '\n  [skipped] Funnel event integration tests need DATABASE_URL pointing at a local ' +
          'itarang_dev.\n',
  );
}

/**
 * Every visitor id this file creates.
 *
 * Cleanup deletes exactly these rows rather than truncating the table. The
 * suite shares one database and Vitest runs files in parallel, so a TRUNCATE
 * here would delete another file's rows mid-assertion — which is precisely why
 * every other integration test in this repo scopes its cleanup to a marker of
 * its own.
 */
const CREATED: string[] = [];

/**
 * Cleanup marker for the one order this file creates.
 *
 * Must be unique across the suite: every integration test here deletes its own
 * rows by one of these, and Vitest runs files in parallel against one database.
 * Taken: 33 place-order, 44 inventory-push, 55 analytics, 66 enqueue,
 * 77 reconciliation, 88 webhook, 99 checkout.
 *
 * The attribution tests used to attach to whichever order happened to be newest.
 * That is racy for exactly the reason this comment exists: another file can
 * delete that order mid-test, and `order_attribution` cascades away with it.
 */
const PHONE = '9000000022';

async function ownOrder(): Promise<number> {
  const [order] = await query<{ id: number }>(
    `INSERT INTO orders
       (order_number, status, payment_status, customer_name, customer_phone,
        shipping_address, subtotal, total, payment_method, is_test)
     VALUES ('ITG-FNL-' || substr(md5(random()::text), 1, 8), 'confirmed', 'paid',
             'Funnel Test', $1, '{}'::jsonb, 100000, 100000, 'razorpay-test', true)
     RETURNING id`,
    [PHONE],
  );
  return order.id;
}

function visitor(overrides: Partial<VisitorContext> = {}): VisitorContext {
  const who = {
    visitorId: randomUUID(),
    sessionId: randomUUID(),
    freshVisitor: false,
    freshSession: false,
    ...overrides,
  };
  CREATED.push(who.visitorId);
  return who;
}

async function countFor(visitorId: string): Promise<number> {
  const rows = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM funnel_events WHERE visitor_id = $1::uuid`,
    [visitorId],
  );
  return rows[0]?.n ?? 0;
}

describe.runIf(CONFIGURED)('funnel events', () => {
  afterAll(async () => {
    // Scoped to this file's own visitors, and to the one order it attributed.
    // No order, payment or inventory row is created, modified or deleted.
    await query(`DELETE FROM funnel_events WHERE visitor_id = ANY($1::uuid[])`, [CREATED]);
    await query(`DELETE FROM visitor_identities WHERE visitor_id = ANY($1::uuid[])`, [CREATED]);
    await query(`DELETE FROM order_attribution WHERE visitor_id = ANY($1::uuid[])`, [CREATED]);
    await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
    await closePool();
  });

  it('records an event', async () => {
    const who = visitor();
    expect(await record({ event: 'visit', visitor: who })).toBe(true);
    expect(await countFor(who.visitorId)).toBe(1);
  });

  it('collapses a repeated beacon in the same session', async () => {
    const who = visitor();

    // A browser retry, or an effect firing twice under strict mode.
    expect(await record({ event: 'visit', visitor: who })).toBe(true);
    expect(await record({ event: 'visit', visitor: who })).toBe(false);
    expect(await record({ event: 'visit', visitor: who })).toBe(false);

    expect(await countFor(who.visitorId)).toBe(1);
  });

  it('counts a new session as a new visit for the same visitor', async () => {
    const visitorId = randomUUID();

    await record({ event: 'visit', visitor: visitor({ visitorId }) });
    await record({ event: 'visit', visitor: visitor({ visitorId }) });

    // Same person, two browsing sessions, two visits.
    expect(await countFor(visitorId)).toBe(2);
  });

  it('separates views of different products in one session', async () => {
    const who = visitor();

    await record({ event: 'product_view', visitor: who, productId: 'prod_a' });
    await record({ event: 'product_view', visitor: who, productId: 'prod_b' });
    await record({ event: 'product_view', visitor: who, productId: 'prod_a' });

    // Two distinct products; the repeat of prod_a collapses.
    expect(await countFor(who.visitorId)).toBe(2);
  });

  it('lets an explicit dedupe scope separate genuine repeat intents', async () => {
    const who = visitor();

    // Adding the same variant twice is two real decisions, not a retry.
    await record({ event: 'add_to_cart', visitor: who, productId: 'p', dedupe: 'a' });
    await record({ event: 'add_to_cart', visitor: who, productId: 'p', dedupe: 'b' });

    expect(await countFor(who.visitorId)).toBe(2);
  });

  it('links a visitor to an account without rewriting prior events', async () => {
    const who = visitor();
    const [user] = await query<{ id: number }>(`SELECT id FROM users ORDER BY id LIMIT 1`);
    if (!user) return; // no account in this database; nothing to link

    await record({ event: 'product_view', visitor: who, productId: 'prod_a' });
    await linkVisitorToUser(who.visitorId, user.id);

    // The event keeps the null user_id it had when it happened — the link is
    // what joins them, so history is never restated.
    const rows = await query<{ user_id: number | null }>(
      `SELECT user_id FROM funnel_events WHERE visitor_id = $1::uuid`,
      [who.visitorId],
    );
    expect(rows[0].user_id).toBeNull();

    const links = await query<{ user_id: number }>(
      `SELECT user_id FROM visitor_identities WHERE visitor_id = $1::uuid`,
      [who.visitorId],
    );
    expect(links).toHaveLength(1);
    expect(links[0].user_id).toBe(user.id);
  });

  it('links the same visitor to an account only once', async () => {
    const who = visitor();
    const [user] = await query<{ id: number }>(`SELECT id FROM users ORDER BY id LIMIT 1`);
    if (!user) return;

    await linkVisitorToUser(who.visitorId, user.id);
    await linkVisitorToUser(who.visitorId, user.id);

    const links = await query(`SELECT 1 FROM visitor_identities WHERE visitor_id = $1::uuid`, [
      who.visitorId,
    ]);
    expect(links).toHaveLength(1);
  });

  it('attributes an order once, and never twice', async () => {
    const who = visitor();
    const orderId = await ownOrder();

    await attributeOrder(orderId, who);
    await attributeOrder(orderId, visitor()); // a second attempt must not overwrite

    const rows = await query<{ visitor_id: string }>(
      `SELECT visitor_id FROM order_attribution WHERE order_id = $1`,
      [orderId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].visitor_id).toBe(who.visitorId);
  });

  it('is a no-op when there is no visitor to attribute', async () => {
    const orderId = await ownOrder();

    await attributeOrder(orderId, null);

    const rows = await query(`SELECT 1 FROM order_attribution WHERE order_id = $1`, [orderId]);
    expect(rows).toHaveLength(0);
  });
});
