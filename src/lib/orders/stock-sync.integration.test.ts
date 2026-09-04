import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { generateOrderNumber } from './numbering';
import { PostgresOrderRepository } from './postgres-repository';
import type { NewOrder } from './types';

/**
 * A paid order moves the catalogue quantity, exactly once.
 *
 * Before this existed, capturing a payment consumed the stock reservation and
 * stopped. `product_variants.stock` — the number the product page, the product
 * card and the admin table all read — never moved, so a unit could be sold and
 * the shop would go on advertising it. The live database still carries the
 * evidence: order `ITG-2609-XNRMB2` is paid, its reservation is consumed, and
 * the variant it sold still reported its pre-sale count.
 *
 * **These tests do not touch the eight real products.** They create one draft
 * fixture product, exercise the whole capture path against it, and delete it
 * again. A draft is never publicly purchasable, so the fixture cannot leak into
 * the storefront even while it exists, and the eight real rows — their stock,
 * their prices and their net quantities — are never written to. The real
 * catalogue is asserted separately, read-only, at the end.
 */

const REMOTE = (() => {
  try {
    return !isLocalHost(inspectDatabaseUrl(process.env.DATABASE_URL ?? '').host);
  } catch {
    return false;
  }
})();

const CONFIGURED =
  Boolean(process.env.DATABASE_URL) && (!REMOTE || process.env.DB_ALLOW_REMOTE_TESTS === 'true');

if (!CONFIGURED) {
  console.warn(
    '\n  [skipped] Stock-synchronisation tests need a database. ' +
      'Set DB_ALLOW_REMOTE_TESTS=true to run them against a remote one.\n',
  );
}

/** Deliberately unlike any real key, and deleted in `afterAll`. */
const KEY = 'stocksync-fixture-product';
const VARIANT_ID = `${KEY}:default`;
/** A variant id that resolves to nothing — the "not ours" branch. */
const FOREIGN_VARIANT = 'variant_01FOREIGNHOSTINGERVARIANT';
const PHONE = '9000000055';
/**
 * Thirty seconds, not vitest's default five.
 *
 * Every assertion here is a chain of round-trips to a managed database that is
 * an internet hop away, and the fixture is rebuilt before each one. Five
 * seconds is a budget for a local socket; against a remote pooler it fails
 * tests that are doing nothing wrong, and it fails a different one each run.
 * A real hang still fails, six times later than it used to.
 */
const DB_TIMEOUT = 30_000;


async function setStock(stock: number | null): Promise<void> {
  await query(
    `UPDATE product_variants v SET stock = $2
       FROM products p WHERE p.id = v.product_id AND p.product_key = $1`,
    [KEY, stock],
  );
}

async function currentStock(): Promise<number | null> {
  const rows = await query<{ stock: number | null }>(
    `SELECT v.stock FROM product_variants v
       JOIN products p ON p.id = v.product_id WHERE p.product_key = $1`,
    [KEY],
  );
  return rows[0]?.stock ?? null;
}

async function netQuantity(): Promise<string | null> {
  const rows = await query<{ net_quantity: string | null }>(
    `SELECT net_quantity FROM products WHERE product_key = $1`,
    [KEY],
  );
  return rows[0]?.net_quantity ?? null;
}

function draftOrder(variantId: string, quantity: number): NewOrder {
  return {
    orderNumber: generateOrderNumber(),
    contact: { name: 'Stock Sync', phone: PHONE },
    shippingAddress: { line1: '1 Test Street', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
    amounts: {
      subtotal: 100000,
      productSavings: 0,
      couponDiscount: 0,
      shipping: 0,
      codFee: 0,
      total: 100000,
      gstAmount: 15254,
      gstRate: 0.18,
    },
    items: [
      {
        productId: KEY,
        variantId,
        sku: `SS-${variantId}`,
        title: 'Stock sync fixture',
        unitMrp: 120000,
        unitPrice: 100000,
        quantity,
        lineTotal: 100000 * quantity,
        taxRate: 0.18,
        installationIncluded: false,
      },
    ],
    paymentMethod: 'razorpay-test',
    isTest: true,
    status: 'pending_payment',
    paymentStatus: 'pending',
  };
}

describe.skipIf(!CONFIGURED)('a paid order moves the catalogue quantity', { timeout: DB_TIMEOUT }, () => {
  const repository = new PostgresOrderRepository();

  /** Place an order that reserves `quantity`, then capture payment. */
  async function sell(quantity: number, variantId = VARIANT_ID) {
    const available = (await currentStock()) ?? 0;
    const created = await repository.createOrder({
      order: draftOrder(variantId, quantity),
      reservations: [{ variantId, quantity }],
      availableByVariant: { [variantId]: available },
      reservationTtlMinutes: 15,
    });
    if (!created.ok) return { created, order: null };
    await repository.applyPaymentStatus(created.order.id, 'paid', 'test');
    return { created, order: created.order };
  }

  beforeEach(async () => {
    // Remove this suite's own rows, then rebuild the fixture from scratch.
    await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
    await query(`DELETE FROM stock_reservations WHERE variant_id = ANY($1::text[])`, [
      [VARIANT_ID, FOREIGN_VARIANT],
    ]);
    await query(`DELETE FROM inventory_baseline WHERE variant_id = ANY($1::text[])`, [
      [VARIANT_ID, FOREIGN_VARIANT],
    ]);
    await query(`DELETE FROM products WHERE product_key = $1`, [KEY]);

    await query(
      `INSERT INTO products (product_key, slug, status, title, category, subcategory, net_quantity)
       VALUES ($1, $1, 'draft', 'Stock sync fixture', 'batteries', 'lithium', '1 Count')`,
      [KEY],
    );
    await query(
      `INSERT INTO product_variants (product_id, variant_key, sku, mrp, selling, stock, availability)
       SELECT id, 'default', $2, 120000, 100000, 2, 'in-stock' FROM products WHERE product_key = $1`,
      [KEY, `SS-${VARIANT_ID}`],
    );
  });

  afterAll(async () => {
    await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
    await query(`DELETE FROM stock_reservations WHERE variant_id = ANY($1::text[])`, [
      [VARIANT_ID, FOREIGN_VARIANT],
    ]);
    await query(`DELETE FROM inventory_baseline WHERE variant_id = ANY($1::text[])`, [
      [VARIANT_ID, FOREIGN_VARIANT],
    ]);
    await query(`DELETE FROM products WHERE product_key = $1`, [KEY]);
    await closePool();
  });

  /* ------------------------------------------------------ A, B, C, D */

  it('A · stock 2, one unit sold, stock 1', async () => {
    expect(await currentStock()).toBe(2);
    await sell(1);
    expect(await currentStock()).toBe(1);
  });

  it('B · stock 1, one unit sold, stock 0', async () => {
    await setStock(1);
    await sell(1);
    expect(await currentStock()).toBe(0);
  });

  it('C · stock 0, the order is refused and nothing moves', async () => {
    await setStock(0);
    const { created } = await sell(1);
    expect(created.ok).toBe(false);
    expect(await currentStock()).toBe(0);
  });

  it('D · three units cannot be sold out of two', async () => {
    const { created } = await sell(3);
    expect(created.ok).toBe(false);
    if (!created.ok && created.reason === 'insufficient_stock') {
      expect(created.available).toBe(2);
    }
    // Never negative, and never touched by a refused order.
    expect(await currentStock()).toBe(2);
  });

  it('sells the whole shelf and then refuses, without ever going negative', async () => {
    await sell(1);
    expect(await currentStock()).toBe(1);
    await sell(1);
    expect(await currentStock()).toBe(0);
    const { created } = await sell(1);
    expect(created.ok).toBe(false);
    expect(await currentStock()).toBe(0);
  });

  /* ------------------------------------------------------------ E, F */

  it('E · a failed payment leaves the quantity alone', async () => {
    const created = await repository.createOrder({
      order: draftOrder(VARIANT_ID, 1),
      reservations: [{ variantId: VARIANT_ID, quantity: 1 }],
      availableByVariant: { [VARIANT_ID]: 2 },
      reservationTtlMinutes: 15,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await repository.applyPaymentStatus(created.order.id, 'failed', 'test');
    expect(await currentStock()).toBe(2);
  });

  it('F · an abandoned payment leaves the quantity alone', async () => {
    const created = await repository.createOrder({
      order: draftOrder(VARIANT_ID, 1),
      reservations: [{ variantId: VARIANT_ID, quantity: 1 }],
      availableByVariant: { [VARIANT_ID]: 2 },
      reservationTtlMinutes: 15,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // Nothing is applied at all — the reservation is left to its TTL.
    expect(await currentStock()).toBe(2);
    await repository.releaseReservations(created.order.id);
    expect(await currentStock()).toBe(2);
  });

  /* ------------------------------------------------------------ G, H */

  it('G · a redelivered success webhook deducts exactly once', async () => {
    const { order } = await sell(1);
    expect(order).not.toBeNull();
    expect(await currentStock()).toBe(1);

    // The same event, three more times.
    await repository.applyPaymentStatus(order!.id, 'paid', 'webhook');
    await repository.applyPaymentStatus(order!.id, 'paid', 'webhook');
    await repository.applyPaymentStatus(order!.id, 'paid', 'webhook');

    expect(await currentStock()).toBe(1);
  });

  it('H · a retry after the capture does not deduct again', async () => {
    const { order } = await sell(1);
    expect(await currentStock()).toBe(1);

    // A late `authorized` and a repeated `paid`, in either order.
    await repository.applyPaymentStatus(order!.id, 'authorized', 'webhook');
    await repository.applyPaymentStatus(order!.id, 'paid', 'callback');

    expect(await currentStock()).toBe(1);
  });

  it('marks the reservation reconciled, so it stops being counted twice', async () => {
    const { order } = await sell(1);
    const rows = await query<{ state: string; reconciled: boolean }>(
      `SELECT state, reconciled_at IS NOT NULL AS reconciled
         FROM stock_reservations WHERE order_id = $1`,
      [order!.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.state).toBe('consumed');
    // Without this the column has gone down *and* the reservation still counts
    // against availability — the same unit subtracted twice.
    expect(rows[0]!.reconciled).toBe(true);
  });

  /* --------------------------------------------------------------- I */

  it('I · two buyers race for the last unit and only one gets it', async () => {
    await setStock(1);

    const attempt = () =>
      repository.createOrder({
        order: draftOrder(VARIANT_ID, 1),
        reservations: [{ variantId: VARIANT_ID, quantity: 1 }],
        availableByVariant: { [VARIANT_ID]: 1 },
        reservationTtlMinutes: 15,
      });

    const [a, b] = await Promise.all([attempt(), attempt()]);
    const winners = [a, b].filter((r) => r.ok);
    expect(winners).toHaveLength(1);

    const winner = winners[0]!;
    if (winner.ok) await repository.applyPaymentStatus(winner.order.id, 'paid', 'test');

    expect(await currentStock()).toBe(0);
  });

  /* ------------------------------------------------------------ J, K */

  it('J/K · a variant that is not ours is never deducted here', async () => {
    // A Hostinger-shaped id, and any unknown id, resolves to no row in our
    // catalogue. The join is the eligibility check: nothing of ours moves.
    const before = await currentStock();

    const created = await repository.createOrder({
      order: draftOrder(FOREIGN_VARIANT, 1),
      reservations: [{ variantId: FOREIGN_VARIANT, quantity: 1 }],
      availableByVariant: { [FOREIGN_VARIANT]: 5 },
      reservationTtlMinutes: 15,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await repository.applyPaymentStatus(created.order.id, 'paid', 'test');

    expect(await currentStock()).toBe(before);
  });

  it('files no Hostinger sync job for a product of ours', async () => {
    const { order } = await sell(1);
    const jobs = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM inventory_sync_jobs WHERE order_id = $1`,
      [order!.id],
    );
    // It used to file one, keyed on our own product key in a column meant for
    // a Hostinger id. Our catalogue is deducted directly; there is nothing to
    // send anywhere.
    expect(jobs[0]!.n).toBe(0);
  });

  /* --------------------------------------------------------------- Q */

  it('Q · net quantity is untouched — it is a pack size, not a count', async () => {
    expect(await netQuantity()).toBe('1 Count');
    await sell(1);
    expect(await currentStock()).toBe(1);
    expect(await netQuantity()).toBe('1 Count');
  });

  it('leaves an untracked variant untracked rather than inventing a zero', async () => {
    await setStock(null);
    const created = await repository.createOrder({
      order: draftOrder(VARIANT_ID, 1),
      reservations: [{ variantId: VARIANT_ID, quantity: 1 }],
      availableByVariant: { [VARIANT_ID]: 99 },
      reservationTtlMinutes: 15,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await repository.applyPaymentStatus(created.order.id, 'paid', 'test');

    // NULL means "not counted", which is not the same as none left.
    expect(await currentStock()).toBeNull();
  });
});

/* ------------------------------------------- the real catalogue, read-only */

describe.skipIf(!CONFIGURED)('the eight real products read one authoritative number', { timeout: DB_TIMEOUT }, () => {
  it('N/O · the admin column and the shopper projection are the same column', async () => {
    const rows = await query<{
      product_key: string;
      status: string;
      stock: number | null;
      availability: string | null;
      net_quantity: string | null;
    }>(
      `SELECT p.product_key, p.status, v.stock, v.availability, p.net_quantity
         FROM product_variants v JOIN products p ON p.id = v.product_id
        ORDER BY p.popularity_rank`,
    );

    expect(rows.length).toBeGreaterThanOrEqual(8);

    const { toDomainProduct } = await import('@/lib/products/to-domain');
    const { productRepository } = await import('@/lib/products/postgres-repository');

    // What the admin table renders.
    const admin = await productRepository().listForAdmin({ limit: 100, offset: 0 });
    const adminStock = new Map(admin.items.map((item) => [item.productKey, item.primaryStock]));

    // What a shopper is served.
    const published = await productRepository().listPublished();

    for (const row of rows) {
      // The admin quantity is the column, never a separate source.
      if (adminStock.has(row.product_key)) {
        expect(adminStock.get(row.product_key), `${row.product_key} admin quantity`).toBe(row.stock);
      }

      const record = published.find((entry) => entry.productKey === row.product_key);
      if (!record) continue;

      const variant = toDomainProduct(record).variants[0]!;
      if (row.stock === null) {
        // Untracked projects to the documented sentinel, not to zero.
        expect(variant.stock).toBe(99);
      } else {
        expect(variant.stock, `${row.product_key} shopper-facing stock`).toBe(row.stock);
        // And the badge follows the count rather than a stale label.
        const expected =
          row.stock <= 0 ? 'out-of-stock' : row.stock <= 5 ? 'low-stock' : 'in-stock';
        expect(variant.availability, `${row.product_key} availability`).toBe(expected);
      }
    }
  });

  it('no real product carries a Hostinger id, so none can take that branch', async () => {
    const rows = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM products WHERE hostinger_product_id IS NOT NULL`,
    );
    expect(rows[0]!.n).toBe(0);
  });
});
