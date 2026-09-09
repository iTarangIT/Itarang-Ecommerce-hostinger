import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query, transaction } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import {
  claimNotificationSends,
  hasStockNotification,
  interestedCustomers,
  markRequestsNotified,
  notifyMeCountFor,
  releaseNotificationSend,
  requestStockNotification,
  cancelStockNotification,
} from './notifications';
import {
  claimStockAlert,
  latestRestock,
  pendingStockAlerts,
  recordStockTransitions,
  releaseStockAlert,
} from './transitions';
import {
  STOCK_NOTIFICATIONS_DEFAULT,
  setStockNotificationsEnabled,
  stockNotificationSettingsOf,
} from './settings';
import { listOutOfStock } from './out-of-stock';

/**
 * The stock notification subsystem, against the local `itarang_dev` database.
 *
 * Three properties matter and none can be checked without a database:
 *
 *   **A transition alerts once.** Not once per attempt, not once per process —
 *   once. The guard is `UPDATE ... WHERE alert_sent_at IS NULL`, so it has to
 *   be exercised against a real row.
 *
 *   **A customer is never told twice about one restock.** The guard is a
 *   primary key on `(transition_id, email)` and an `ON CONFLICT DO NOTHING`
 *   that returns only the rows it inserted.
 *
 *   **The out-of-stock list shows sold quantity without storing it.** Derived
 *   from `order_items` joined to paid orders, which needs both tables.
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
      ? '\n  [skipped] Stock notification integration tests write real rows and DATABASE_URL is ' +
          'remote. Set DB_ALLOW_REMOTE_TESTS=true to run them anyway.\n'
      : '\n  [skipped] Stock notification integration tests need DATABASE_URL pointing at a ' +
          'local itarang_dev database. See README → Database.\n',
  );
}

const KEY = 'stock-notify-fixture';
const SKU = 'SN-FIXTURE-1';
const ALICE = 'alice.notify@example.com';
const BOB = 'bob.notify@example.com';
const ACTOR = 'notifications.integration.test@itarang.com';

async function cleanUp(): Promise<void> {
  await query(`DELETE FROM stock_notification_requests WHERE product_id = $1`, [KEY]);
  await query(`DELETE FROM stock_transitions WHERE product_id = $1`, [KEY]);
  await query(`DELETE FROM products WHERE product_key = $1`, [KEY]);
  await query(`DELETE FROM users WHERE email = ANY($1::text[])`, [[ALICE, BOB]]);
  await query(`DELETE FROM app_settings WHERE key = 'stock_notifications'`);
}

async function seedProduct(stock: number): Promise<void> {
  await query(
    `INSERT INTO products (product_key, slug, status, title, category, subcategory)
     VALUES ($1, $1, 'published', 'Stock notify fixture', 'batteries', 'lithium')`,
    [KEY],
  );
  await query(
    `INSERT INTO product_variants (product_id, variant_key, sku, mrp, selling, stock, availability)
     SELECT id, 'default', $2, 120000, 100000, $3, 'in-stock' FROM products WHERE product_key = $1`,
    [KEY, SKU, stock],
  );
}

/** One transition, committed, as the write paths produce it. */
async function seedTransition(
  direction: 'out-of-stock' | 'back-in-stock',
): Promise<number> {
  return transaction(async (client) => {
    const [id] = await recordStockTransitions(client, [
      { productId: KEY, sku: SKU, direction, source: 'admin' },
    ]);
    return id!;
  });
}

describe.skipIf(!CONFIGURED)('notify me requests', () => {
  beforeEach(async () => {
    await cleanUp();
    await seedProduct(0);
  });

  afterAll(async () => {
    await cleanUp();
    await closePool();
  });

  it('records a request and finds it again', async () => {
    const result = await requestStockNotification({
      productId: KEY,
      sku: SKU,
      email: ALICE,
      userId: null,
    });
    expect(result.alreadyRequested).toBe(false);
    expect(await hasStockNotification(KEY, SKU, ALICE)).toBe(true);
  });

  it('treats a second request as the same request', async () => {
    await requestStockNotification({ productId: KEY, sku: SKU, email: ALICE, userId: null });
    const again = await requestStockNotification({
      productId: KEY,
      sku: SKU,
      email: ALICE,
      userId: null,
    });

    expect(again.alreadyRequested).toBe(true);
    expect(await notifyMeCountFor(KEY)).toBe(1);
  });

  it('matches an address whatever case it is typed in', async () => {
    await requestStockNotification({ productId: KEY, sku: SKU, email: ALICE, userId: null });
    const shouty = await requestStockNotification({
      productId: KEY,
      sku: SKU,
      email: ALICE.toUpperCase(),
      userId: null,
    });

    expect(shouty.alreadyRequested).toBe(true);
    expect(await notifyMeCountFor(KEY)).toBe(1);
  });

  it('drops a cancelled request from the count, and restores it on re-request', async () => {
    await requestStockNotification({ productId: KEY, sku: SKU, email: ALICE, userId: null });
    await cancelStockNotification(KEY, SKU, ALICE);

    expect(await hasStockNotification(KEY, SKU, ALICE)).toBe(false);
    expect(await notifyMeCountFor(KEY)).toBe(0);

    // Asking again is a person changing their mind, not a duplicate.
    await requestStockNotification({ productId: KEY, sku: SKU, email: ALICE, userId: null });
    expect(await hasStockNotification(KEY, SKU, ALICE)).toBe(true);
  });
});

describe.skipIf(!CONFIGURED)('the internal out-of-stock alert', () => {
  beforeEach(async () => {
    await cleanUp();
    await seedProduct(0);
  });

  afterAll(async () => {
    await cleanUp();
    await closePool();
  });

  it('is pending once a transition is recorded', async () => {
    await seedTransition('out-of-stock');
    const pending = await pendingStockAlerts();
    expect(pending.filter((alert) => alert.sku === SKU)).toHaveLength(1);
  });

  it('can be claimed exactly once', async () => {
    const id = await seedTransition('out-of-stock');

    expect(await claimStockAlert(id)).toBe(true);
    // The second attempt is the double-send this guard exists to prevent —
    // two processes, a retry, a restarted worker.
    expect(await claimStockAlert(id)).toBe(false);
  });

  it('leaves nothing pending once claimed', async () => {
    const id = await seedTransition('out-of-stock');
    await claimStockAlert(id);

    const pending = await pendingStockAlerts();
    expect(pending.some((alert) => alert.id === id)).toBe(false);
  });

  it('becomes claimable again when released after a failed send', async () => {
    const id = await seedTransition('out-of-stock');
    await claimStockAlert(id);
    await releaseStockAlert(id);

    expect(await claimStockAlert(id)).toBe(true);
  });

  it('does not alert for a restock', async () => {
    // The business asked to be told when something sells out. Coming back is
    // something they did themselves.
    const id = await seedTransition('back-in-stock');
    const pending = await pendingStockAlerts();
    expect(pending.some((alert) => alert.id === id)).toBe(false);
  });

  it('produces one pending alert per crossing, not per read', async () => {
    await seedTransition('out-of-stock');
    const first = (await pendingStockAlerts()).filter((a) => a.sku === SKU).length;
    const second = (await pendingStockAlerts()).filter((a) => a.sku === SKU).length;
    expect(first).toBe(1);
    expect(second).toBe(1);
  });
});

describe.skipIf(!CONFIGURED)('back-in-stock sends', () => {
  beforeEach(async () => {
    await cleanUp();
    await seedProduct(4);
  });

  afterAll(async () => {
    await cleanUp();
    await closePool();
  });

  it('claims each address once for one restock', async () => {
    const id = await seedTransition('back-in-stock');

    expect(await claimNotificationSends(id, [ALICE, BOB], ACTOR)).toEqual(
      expect.arrayContaining([ALICE, BOB]),
    );
    // The second call is the double-clicked button. Nothing is claimed, so
    // nothing is sent.
    expect(await claimNotificationSends(id, [ALICE, BOB], ACTOR)).toEqual([]);
  });

  it('claims only the addresses not already told', async () => {
    const id = await seedTransition('back-in-stock');
    await claimNotificationSends(id, [ALICE], ACTOR);

    expect(await claimNotificationSends(id, [ALICE, BOB], ACTOR)).toEqual([BOB]);
  });

  it('treats a differently cased address as the same person', async () => {
    const id = await seedTransition('back-in-stock');
    await claimNotificationSends(id, [ALICE], ACTOR);

    expect(await claimNotificationSends(id, [ALICE.toUpperCase()], ACTOR)).toEqual([]);
  });

  it('allows a retry after a failed send', async () => {
    const id = await seedTransition('back-in-stock');
    await claimNotificationSends(id, [ALICE], ACTOR);
    await releaseNotificationSend(id, ALICE);

    expect(await claimNotificationSends(id, [ALICE], ACTOR)).toEqual([ALICE]);
  });

  it('treats a later restock as a new event', async () => {
    // A customer who asked again after a second sell-out is owed a second
    // message. The key is (transition, email), not (product, email).
    const first = await seedTransition('back-in-stock');
    await claimNotificationSends(first, [ALICE], ACTOR);

    const second = await seedTransition('back-in-stock');
    expect(await claimNotificationSends(second, [ALICE], ACTOR)).toEqual([ALICE]);
  });

  it('reports the most recent restock', async () => {
    await seedTransition('back-in-stock');
    const newest = await seedTransition('back-in-stock');
    expect((await latestRestock(KEY))?.id).toBe(newest);
  });

  it('reports no restock for a product that has never come back', async () => {
    await seedTransition('out-of-stock');
    expect(await latestRestock(KEY)).toBeNull();
  });
});

describe.skipIf(!CONFIGURED)('interested customers', () => {
  beforeEach(async () => {
    await cleanUp();
    await seedProduct(0);
  });

  afterAll(async () => {
    await cleanUp();
    await closePool();
  });

  it('lists an explicit request', async () => {
    await requestStockNotification({ productId: KEY, sku: SKU, email: ALICE, userId: null });

    const { waiting } = await interestedCustomers(KEY, null);
    expect(waiting).toHaveLength(1);
    expect(waiting[0]).toMatchObject({ email: ALICE, source: 'notify-me' });
  });

  it('includes a customer who only saved the product, labelled as such', async () => {
    const [user] = await query<{ id: number }>(
      `INSERT INTO users (email, password_hash, role) VALUES ($1, 'x', 'customer') RETURNING id`,
      [BOB],
    );
    await query(`INSERT INTO wishlist_items (user_id, product_id) VALUES ($1, $2)`, [
      user!.id,
      KEY,
    ]);

    const { waiting } = await interestedCustomers(KEY, null);
    expect(waiting.find((c) => c.email === BOB)?.source).toBe('wishlist');
  });

  it('keeps the strongest signal when somebody did both', async () => {
    const [user] = await query<{ id: number }>(
      `INSERT INTO users (email, password_hash, role) VALUES ($1, 'x', 'customer') RETURNING id`,
      [ALICE],
    );
    await query(`INSERT INTO wishlist_items (user_id, product_id) VALUES ($1, $2)`, [
      user!.id,
      KEY,
    ]);
    await requestStockNotification({
      productId: KEY,
      sku: SKU,
      email: ALICE,
      userId: user!.id,
    });

    const { waiting } = await interestedCustomers(KEY, null);
    const alice = waiting.filter((c) => c.email === ALICE);
    expect(alice).toHaveLength(1);
    expect(alice[0]!.source).toBe('notify-me');
  });

  /**
   * The rule the business asked for: somebody who has been told is off the
   * list. Both halves of it are exercised, because they are enforced by
   * different mechanisms — a request is spent by `notified_at`, and a wishlist
   * entry, which has no request to spend, by its send row.
   */
  it('drops a customer who has been told about this restock', async () => {
    await requestStockNotification({ productId: KEY, sku: SKU, email: ALICE, userId: null });
    const id = await seedTransition('back-in-stock');
    await claimNotificationSends(id, [ALICE], ACTOR);

    const { waiting, alreadyNotified } = await interestedCustomers(KEY, id);
    expect(waiting.find((c) => c.email === ALICE)).toBeUndefined();
    expect(alreadyNotified).toBe(1);
  });

  it('drops a wishlist customer who has been told, who has no request to spend', async () => {
    const [user] = await query<{ id: number }>(
      `INSERT INTO users (email, password_hash, role) VALUES ($1, 'x', 'customer') RETURNING id`,
      [BOB],
    );
    await query(`INSERT INTO wishlist_items (user_id, product_id) VALUES ($1, $2)`, [
      user!.id,
      KEY,
    ]);
    const id = await seedTransition('back-in-stock');
    await claimNotificationSends(id, [BOB], ACTOR);

    const { waiting, alreadyNotified } = await interestedCustomers(KEY, id);
    expect(waiting).toHaveLength(0);
    expect(alreadyNotified).toBe(1);
  });

  it('drops a fulfilled request even against a later restock', async () => {
    // The send row is keyed on one transition, so it stops covering the person
    // the moment a second restock happens. `notified_at` is what makes a spent
    // opt-in stay spent: the customer asked for one message and got it.
    await requestStockNotification({ productId: KEY, sku: SKU, email: ALICE, userId: null });
    expect(await markRequestsNotified(KEY, [ALICE])).toBe(1);

    const later = await seedTransition('back-in-stock');
    const { waiting } = await interestedCustomers(KEY, later);
    expect(waiting).toHaveLength(0);
  });

  it('puts a customer back on the list when they ask again', async () => {
    await requestStockNotification({ productId: KEY, sku: SKU, email: ALICE, userId: null });
    await markRequestsNotified(KEY, [ALICE]);

    // The second sign-up updates the same row — the unique index guarantees
    // one per person per variant — and must re-open it rather than being
    // swallowed as a duplicate.
    const again = await requestStockNotification({
      productId: KEY,
      sku: SKU,
      email: ALICE,
      userId: null,
    });
    expect(again.alreadyRequested).toBe(false);

    const { waiting } = await interestedCustomers(KEY, null);
    expect(waiting.map((c) => c.email)).toEqual([ALICE]);
  });

  it('reports a live request as already made', async () => {
    await requestStockNotification({ productId: KEY, sku: SKU, email: ALICE, userId: null });
    const again = await requestStockNotification({
      productId: KEY,
      sku: SKU,
      email: ALICE,
      userId: null,
    });
    expect(again.alreadyRequested).toBe(true);
  });

  it('leaves a request the customer re-opened mid-send alone', async () => {
    // `markRequestsNotified` only spends live requests, so a person who signed
    // up again between the mail going out and the bookkeeping is not silently
    // removed by it. Modelled here as a cancelled request: neither is live.
    await requestStockNotification({ productId: KEY, sku: SKU, email: ALICE, userId: null });
    await cancelStockNotification(KEY, SKU, ALICE);

    expect(await markRequestsNotified(KEY, [ALICE])).toBe(0);
  });

  it('does not count someone who has never been told', async () => {
    await requestStockNotification({ productId: KEY, sku: SKU, email: ALICE, userId: null });
    const id = await seedTransition('back-in-stock');

    const { waiting, alreadyNotified } = await interestedCustomers(KEY, id);
    expect(waiting).toHaveLength(1);
    expect(alreadyNotified).toBe(0);
  });
});

describe.skipIf(!CONFIGURED)('the settings switch', () => {
  beforeEach(cleanUp);

  afterAll(async () => {
    await cleanUp();
    await closePool();
  });

  it('is off until somebody turns it on', async () => {
    expect(await stockNotificationSettingsOf()).toEqual(STOCK_NOTIFICATIONS_DEFAULT);
    expect(STOCK_NOTIFICATIONS_DEFAULT.enabled).toBe(false);
  });

  it('round-trips both ways', async () => {
    await setStockNotificationsEnabled(true, ACTOR);
    expect((await stockNotificationSettingsOf()).enabled).toBe(true);

    await setStockNotificationsEnabled(false, ACTOR);
    expect((await stockNotificationSettingsOf()).enabled).toBe(false);
  });

  it('fails closed on a value it cannot parse', async () => {
    // Hand-edited, or written by an older version. Coercing it into "enabled"
    // would start mailing customers on the strength of a malformed row.
    await query(
      `INSERT INTO app_settings (key, value) VALUES ('stock_notifications', '"yes"'::jsonb)`,
    );
    expect((await stockNotificationSettingsOf()).enabled).toBe(false);
  });
});

describe.skipIf(!CONFIGURED)('the out-of-stock list', () => {
  beforeEach(async () => {
    await cleanUp();
    await seedProduct(0);
  });

  afterAll(async () => {
    await cleanUp();
    await closePool();
  });

  it('lists a variant whose count is zero', async () => {
    const row = (await listOutOfStock()).find((r) => r.sku === SKU);
    expect(row).toBeDefined();
    expect(row).toMatchObject({ productKey: KEY, stock: 0, soldQuantity: 0 });
  });

  it('shows the real figures the storefront no longer does', async () => {
    const row = (await listOutOfStock()).find((r) => r.sku === SKU)!;
    expect(row.stock).toBe(0);
    expect(row.selling).toBe(100000);
    expect(row.mrp).toBe(120000);
    expect(row.category).toBe('batteries');
  });

  it('counts the customers waiting', async () => {
    await requestStockNotification({ productId: KEY, sku: SKU, email: ALICE, userId: null });
    await requestStockNotification({ productId: KEY, sku: SKU, email: BOB, userId: null });

    expect((await listOutOfStock()).find((r) => r.sku === SKU)!.waitingCount).toBe(2);
  });

  it('omits a variant whose stock is not tracked', async () => {
    // Untracked is not sold out. Listing it would fill the page with products
    // nobody counts — which today is the whole catalogue.
    await query(`UPDATE product_variants SET stock = NULL WHERE sku = $1`, [SKU]);
    expect((await listOutOfStock()).some((r) => r.sku === SKU)).toBe(false);
  });

  it('omits a variant that has units', async () => {
    await query(`UPDATE product_variants SET stock = 3 WHERE sku = $1`, [SKU]);
    expect((await listOutOfStock()).some((r) => r.sku === SKU)).toBe(false);
  });
});
