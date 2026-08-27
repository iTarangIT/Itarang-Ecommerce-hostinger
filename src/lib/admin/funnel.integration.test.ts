import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import {
  anonymousConversion,
  anonymousVisitorDetail,
  anonymousVisitors,
  attributionCoverage,
  beaconCoverage,
  conversions,
  customerActivity,
  customerDetail,
  funnelCounts,
  funnelVisitorCounts,
  productAudience,
  productFunnel,
} from './funnel';

/**
 * Funnel reporting against the local `itarang_dev` database.
 *
 * These write only to the three funnel tables and read everything else. No
 * order, payment, reservation or inventory row is created, modified or deleted
 * — the existing development data is fixture, not scratch space.
 *
 * The case worth reading first is "counts sessions, not events": a shopper who
 * views five products has reached the product-view stage once. Getting that
 * wrong inflates every stage in proportion to engagement, which would make the
 * funnel worse than having none.
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
      ? '\n  [skipped] Funnel reporting tests write real rows and DATABASE_URL is remote. ' +
          'Set DB_ALLOW_REMOTE_TESTS=true to run them anyway.\n'
      : '\n  [skipped] Funnel reporting tests need DATABASE_URL pointing at a local ' +
          'itarang_dev.\n',
  );
}

/** A window chosen to be empty of real orders, so browsing maths is unambiguous. */
const FROM = new Date('2031-03-01T00:00:00Z');
const TO = new Date('2031-03-02T00:00:00Z');
const AT = '2031-03-01T10:00:00Z';

/** Every visitor id this file creates, so cleanup can be scoped to them. */
const CREATED: string[] = [];

function track(visitorId: string): string {
  CREATED.push(visitorId);
  return visitorId;
}

async function addEvent(input: {
  event: string;
  sessionId: string;
  visitorId?: string;
  userId?: number | null;
  productId?: string | null;
  at?: string;
}): Promise<void> {
  await query(
    `INSERT INTO funnel_events
       (event, occurred_at, visitor_id, session_id, user_id, product_id, dedupe_key)
     VALUES ($1::funnel_event, $2::timestamptz, $3::uuid, $4::uuid, $5, $6, $7)`,
    [
      input.event,
      input.at ?? AT,
      track(input.visitorId ?? randomUUID()),
      input.sessionId,
      input.userId ?? null,
      input.productId ?? null,
      randomUUID(),
    ],
  );
}

describe.runIf(CONFIGURED)('funnel reporting', () => {
  // Scoped to this file's own far-future window and its own visitors, never a
  // TRUNCATE: the suite shares one database and Vitest runs files in parallel,
  // so truncating would delete another file's rows mid-assertion.
  async function clear(): Promise<void> {
    // By visitor id, not by window: the boundary test deliberately writes rows
    // just outside [FROM, TO), and a window-scoped delete would strand them.
    await query(`DELETE FROM funnel_events WHERE visitor_id = ANY($1::uuid[])`, [CREATED]);
    await query(`DELETE FROM visitor_identities WHERE visitor_id = ANY($1::uuid[])`, [CREATED]);
    await query(`DELETE FROM order_attribution WHERE visitor_id = ANY($1::uuid[])`, [CREATED]);
  }

  beforeEach(clear);

  afterAll(async () => {
    await clear();
    await closePool();
  });

  it('counts sessions, not events', async () => {
    const session = randomUUID();

    // One shopper, one session, five product views.
    await addEvent({ event: 'visit', sessionId: session });
    for (const productId of ['p1', 'p2', 'p3', 'p4', 'p5']) {
      await addEvent({ event: 'product_view', sessionId: session, productId });
    }

    const counts = await funnelCounts(FROM, TO);

    expect(counts.visit).toBe(1);
    // Five views, one session that reached the product-view stage.
    expect(counts.product_view).toBe(1);
  });

  it('counts separate sessions separately', async () => {
    for (const _ of [1, 2, 3]) {
      const session = randomUUID();
      await addEvent({ event: 'visit', sessionId: session });
      await addEvent({ event: 'product_view', sessionId: session, productId: 'p1' });
    }
    await addEvent({ event: 'visit', sessionId: randomUUID() });

    const counts = await funnelCounts(FROM, TO);

    expect(counts.visit).toBe(4);
    expect(counts.product_view).toBe(3);
  });

  it('excludes activity outside the window', async () => {
    await addEvent({ event: 'visit', sessionId: randomUUID(), at: '2031-02-28T23:59:59Z' });
    await addEvent({ event: 'visit', sessionId: randomUUID(), at: '2031-03-02T00:00:00Z' });
    await addEvent({ event: 'visit', sessionId: randomUUID(), at: AT });

    // Half-open [from, to): the boundary instant belongs to the next window.
    expect((await funnelCounts(FROM, TO)).visit).toBe(1);
  });

  it('derives payment and order stages from the authoritative tables', async () => {
    // Order 43 in the development data: prepaid, captured, signature-verified,
    // with a payment attempt and a confirmed event. Nothing about it is
    // modified here — only an attribution row is added alongside it.
    const [order] = await query<{ id: number; created_at: Date }>(
      `SELECT o.id, o.created_at FROM orders o
        WHERE o.payment_method <> 'cod'
          AND EXISTS (SELECT 1 FROM payments p
                       WHERE p.order_id = o.id AND p.status = 'paid' AND p.signature_verified)
        ORDER BY o.id LIMIT 1`,
    );
    if (!order) return;

    const session = randomUUID();
    await query(
      `INSERT INTO order_attribution (order_id, visitor_id, session_id)
       VALUES ($1, $2::uuid, $3::uuid)`,
      // Tracked so beforeEach can remove it again — otherwise it would leak
      // into the coverage test below, which asserts nothing is attributed yet.
      [order.id, track(randomUUID()), session],
    );

    // A window around that order's own day.
    const from = new Date(order.created_at);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 1);

    const counts = await funnelCounts(from, to);

    expect(counts.payment_initiated).toBeGreaterThanOrEqual(1);
    expect(counts.payment_completed).toBeGreaterThanOrEqual(1);
    expect(counts.order_placed).toBeGreaterThanOrEqual(1);
  });

  it('reports attribution coverage so gaps are visible, not silent', async () => {
    const [order] = await query<{ id: number; created_at: Date }>(
      `SELECT id, created_at FROM orders WHERE payment_method <> 'cod' ORDER BY id LIMIT 1`,
    );
    if (!order) return;

    const from = new Date(order.created_at);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 1);

    const before = await attributionCoverage(from, to);
    expect(before.orders).toBeGreaterThanOrEqual(1);
    // Nothing attributed yet — the funnel must admit this rather than imply a
    // conversion collapse.
    expect(before.attributed).toBe(0);

    await query(
      `INSERT INTO order_attribution (order_id, visitor_id, session_id)
       VALUES ($1, $2::uuid, $3::uuid)`,
      [order.id, track(randomUUID()), randomUUID()],
    );

    expect((await attributionCoverage(from, to)).attributed).toBe(1);
  });

  it('never divides by zero on an empty funnel', async () => {
    const counts = await funnelCounts(FROM, TO);
    const rates = conversions(counts);

    expect(rates).toHaveLength(4);
    expect(rates.every((rate) => rate.rate === null)).toBe(true);
  });

  it('computes conversion rates between stages', async () => {
    // Four sessions view, two add to cart.
    for (let i = 0; i < 4; i += 1) {
      const session = randomUUID();
      await addEvent({ event: 'product_view', sessionId: session, productId: 'p1' });
      if (i < 2) await addEvent({ event: 'add_to_cart', sessionId: session, productId: 'p1' });
    }

    const rates = conversions(await funnelCounts(FROM, TO));
    const viewToCart = rates.find((rate) => rate.from === 'product_view');

    expect(viewToCart?.rate).toBeCloseTo(0.5, 5);
  });

  it('builds a per-product funnel', async () => {
    const a = randomUUID();
    const b = randomUUID();

    await addEvent({ event: 'product_view', sessionId: a, productId: 'prod_x' });
    await addEvent({ event: 'product_view', sessionId: b, productId: 'prod_x' });
    await addEvent({ event: 'add_to_cart', sessionId: a, productId: 'prod_x' });
    await addEvent({ event: 'product_view', sessionId: a, productId: 'prod_y' });
    await addEvent({ event: 'buy_now', sessionId: b, productId: 'prod_y' });

    const rows = await productFunnel(FROM, TO);
    const x = rows.find((row) => row.productId === 'prod_x');
    const y = rows.find((row) => row.productId === 'prod_y');

    expect(x).toMatchObject({ views: 2, cartAdds: 1, buyNows: 0 });
    expect(y).toMatchObject({ views: 1, buyNows: 1, cartAdds: 0 });
    // No purchases in this window, so the rate is a real zero rather than null.
    expect(x?.conversion).toBe(0);
  });

  it('attributes anonymous browsing to a customer once they sign in', async () => {
    const [user] = await query<{ id: number }>(`SELECT id FROM users ORDER BY id LIMIT 1`);
    if (!user) return;

    const visitorId = randomUUID();
    const session = randomUUID();

    // Browsed anonymously — the event carries no user_id, and never will.
    await addEvent({ event: 'product_view', sessionId: session, visitorId, productId: 'prod_x' });
    await query(
      `INSERT INTO visitor_identities (visitor_id, user_id) VALUES ($1::uuid, $2)`,
      [visitorId, user.id],
    );

    const rows = await customerActivity(FROM, TO);
    const row = rows.find((candidate) => candidate.userId === user.id);

    expect(row?.views).toBe(1);

    // And the same link makes the audience question answerable.
    const audience = await productAudience('prod_x', 'product_view', FROM, TO);
    expect(audience.customers.map((c) => c.userId)).toContain(user.id);
    expect(audience.anonymous).toBe(0);
  });

  it('counts anonymous viewers without inventing an identity for them', async () => {
    await addEvent({ event: 'product_view', sessionId: randomUUID(), productId: 'prod_x' });
    await addEvent({ event: 'product_view', sessionId: randomUUID(), productId: 'prod_x' });

    const audience = await productAudience('prod_x', 'product_view', FROM, TO);

    expect(audience.customers).toHaveLength(0);
    expect(audience.anonymous).toBe(2);
  });

  it('builds a customer timeline across browsing and commerce', async () => {
    const [user] = await query<{ id: number }>(`SELECT id FROM users ORDER BY id LIMIT 1`);
    if (!user) return;

    await addEvent({
      event: 'product_view',
      sessionId: randomUUID(),
      userId: user.id,
      productId: 'prod_x',
    });

    const detail = await customerDetail(user.id);

    expect(detail).not.toBeNull();
    expect(detail?.userId).toBe(user.id);
    expect(detail?.timeline.some((entry) => entry.kind === 'product_view')).toBe(true);
    // Newest first.
    const times = detail!.timeline.map((entry) => Date.parse(entry.at));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('returns null for an unknown customer', async () => {
    expect(await customerDetail(2_147_483_600)).toBeNull();
  });

  /* --------------------------------------------------- anonymous funnel */

  it('counts visitors as well as sessions', async () => {
    // One person, three visits — the case a session-only funnel gets wrong.
    // Browsing on Monday and buying on Friday is one success, not two failures.
    const visitorId = randomUUID();
    for (const _ of [1, 2, 3]) {
      await addEvent({ event: 'visit', sessionId: randomUUID(), visitorId });
    }

    expect((await funnelCounts(FROM, TO)).visit).toBe(3);
    expect((await funnelVisitorCounts(FROM, TO)).visit).toBe(1);
  });

  it('counts two visitors behind one address as two visitors', async () => {
    // Identity is a server-minted cookie, and no IP is stored anywhere in the
    // funnel — so a household, an office or a carrier NAT pool cannot collapse
    // separate people into one. This is the property an IP-keyed funnel loses,
    // and the reason the visitor id was chosen over the address.
    await addEvent({ event: 'visit', sessionId: randomUUID(), visitorId: randomUUID() });
    await addEvent({ event: 'visit', sessionId: randomUUID(), visitorId: randomUUID() });

    expect((await funnelVisitorCounts(FROM, TO)).visit).toBe(2);
  });

  it('separates anonymous browsing from registered, without either losing rows', async () => {
    const [user] = await query<{ id: number }>(`SELECT id FROM users ORDER BY id LIMIT 1`);
    if (!user) return;

    await addEvent({ event: 'product_view', sessionId: randomUUID(), productId: 'prod_x' });
    await addEvent({
      event: 'product_view',
      sessionId: randomUUID(),
      userId: user.id,
      productId: 'prod_x',
    });

    const all = await funnelCounts(FROM, TO);
    const anon = await funnelCounts(FROM, TO, 'anonymous');
    const registered = await funnelCounts(FROM, TO, 'registered');

    expect(all.product_view).toBe(2);
    expect(anon.product_view).toBe(1);
    expect(registered.product_view).toBe(1);
  });

  it('ends the anonymous funnel at the login wall', async () => {
    // There is no guest checkout, so an anonymous visitor cannot reach an order.
    // Those stages are zero because the schema guarantees it, not because the
    // data is missing — and the wall itself is the stage that replaces them.
    const session = randomUUID();
    await addEvent({ event: 'add_to_cart', sessionId: session, productId: 'prod_x' });
    await addEvent({ event: 'checkout_intent', sessionId: session });

    const anon = await funnelCounts(FROM, TO, 'anonymous');

    expect(anon.checkout_intent).toBe(1);
    expect(anon.signed_in).toBe(0);
    expect(anon.payment_initiated).toBe(0);
    expect(anon.order_placed).toBe(0);
  });

  it('counts a session as signed in once its visitor is linked to an account', async () => {
    // The regression this stage used to have: `signed_in` asked only for the
    // user_id stamped at write time, so somebody who browsed signed-out and then
    // registered was never counted — which is exactly the population the funnel
    // exists to explain. It now resolves through `visitor_identities`, like
    // every other identity query here.
    const [user] = await query<{ id: number }>(`SELECT id FROM users ORDER BY id LIMIT 1`);
    if (!user) return;

    const visitorId = randomUUID();
    await addEvent({ event: 'product_view', sessionId: randomUUID(), visitorId });

    expect((await funnelCounts(FROM, TO)).signed_in).toBe(0);

    await query(`INSERT INTO visitor_identities (visitor_id, user_id) VALUES ($1::uuid, $2)`, [
      visitorId,
      user.id,
    ]);

    expect((await funnelCounts(FROM, TO)).signed_in).toBe(1);
    // And the event itself still says what was true when it happened.
    const [row] = await query<{ user_id: number | null }>(
      `SELECT user_id FROM funnel_events WHERE visitor_id = $1::uuid`,
      [visitorId],
    );
    expect(row?.user_id).toBeNull();
  });

  it('reports what became of the anonymous visitors', async () => {
    const [user] = await query<{ id: number }>(`SELECT id FROM users ORDER BY id LIMIT 1`);
    if (!user) return;

    // One who bounced, one who reached the wall and registered.
    await addEvent({ event: 'visit', sessionId: randomUUID() });

    const converter = randomUUID();
    const session = randomUUID();
    await addEvent({ event: 'visit', sessionId: session, visitorId: converter });
    await addEvent({ event: 'checkout_intent', sessionId: session, visitorId: converter });
    await query(`INSERT INTO visitor_identities (visitor_id, user_id) VALUES ($1::uuid, $2)`, [
      converter,
      user.id,
    ]);

    const conversion = await anonymousConversion(FROM, TO);

    expect(conversion.visitors).toBe(2);
    expect(conversion.reachedWall).toBe(1);
    expect(conversion.registered).toBe(1);
  });

  it('lists anonymous visitors by behaviour alone', async () => {
    const visitorId = randomUUID();
    const first = randomUUID();
    const second = randomUUID();

    await addEvent({ event: 'product_view', sessionId: first, visitorId, productId: 'prod_x' });
    await addEvent({ event: 'add_to_cart', sessionId: first, visitorId, productId: 'prod_x' });
    await addEvent({ event: 'checkout_intent', sessionId: second, visitorId });

    const rows = await anonymousVisitors(FROM, TO);
    const row = rows.find((candidate) => candidate.visitorId === visitorId);

    expect(row).toMatchObject({ sessions: 2, views: 1, cartAdds: 1, reachedWall: true });
    expect(row?.converted).toBe(false);

    const detail = await anonymousVisitorDetail(visitorId);
    expect(detail?.sessions).toBe(2);
    expect(detail?.timeline).toHaveLength(3);
    // Newest first, and every entry carries the session it belonged to.
    const times = detail!.timeline.map((entry) => Date.parse(entry.at));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(detail!.timeline.every((entry) => entry.sessionId.length > 0)).toBe(true);
  });

  it('excludes a signed-in shopper from the anonymous visitor list', async () => {
    const [user] = await query<{ id: number }>(`SELECT id FROM users ORDER BY id LIMIT 1`);
    if (!user) return;

    const visitorId = randomUUID();
    await addEvent({
      event: 'product_view',
      sessionId: randomUUID(),
      visitorId,
      userId: user.id,
      productId: 'prod_x',
    });

    const rows = await anonymousVisitors(FROM, TO);
    expect(rows.some((row) => row.visitorId === visitorId)).toBe(false);
  });

  it('returns null for a visitor that has done nothing', async () => {
    expect(await anonymousVisitorDetail(randomUUID())).toBeNull();
  });

  it('reports orders whose visitor was never seen browsing', async () => {
    // The blind spot at the top of the funnel: the visitor cookie is minted by
    // the beacon, so a blocked beacon means an order arrives attributed to a
    // visitor with no browsing behind it. Reporting the size of that is the only
    // honest option — hidden, it reads as a conversion collapse.
    const [order] = await query<{ id: number; created_at: Date }>(
      `SELECT id, created_at FROM orders WHERE payment_method <> 'cod' ORDER BY id LIMIT 1`,
    );
    if (!order) return;

    const from = new Date(order.created_at);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 1);

    await query(
      `INSERT INTO order_attribution (order_id, visitor_id, session_id)
       VALUES ($1, $2::uuid, $3::uuid)`,
      [order.id, track(randomUUID()), randomUUID()],
    );

    const coverage = await beaconCoverage(from, to);

    expect(coverage.attributed).toBe(1);
    // That visitor wrote no events, so the funnel can see the order and nothing
    // that led to it.
    expect(coverage.withBrowsing).toBe(0);
  });
});
