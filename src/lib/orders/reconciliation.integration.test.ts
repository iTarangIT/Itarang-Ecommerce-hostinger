import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { PostgresOrderRepository } from './postgres-repository';
import { generateOrderNumber } from './numbering';
import type { NewOrder } from './types';

/**
 * Inventory reconciliation against the local `itarang_dev` database.
 *
 * Hostinger has no inventory write API, so a sale here never moves the
 * merchant's own stock figure. The admin deducts sold units by hand in hPanel
 * and then resyncs — and the whole hazard of that arrangement is the moment
 * *after* they deduct, when Hostinger's number already accounts for the sale
 * and our consumed reservation is still subtracting it too.
 *
 * The double-count case below is the reason `reconciled_at` exists. It is the
 * test to read first.
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
      ? '\n  [skipped] Reconciliation integration tests write real rows and DATABASE_URL is ' +
          'remote. Set DB_ALLOW_REMOTE_TESTS=true to run them anyway.\n'
      : '\n  [skipped] Reconciliation integration tests need DATABASE_URL pointing at a local ' +
          'itarang_dev database. See README → Database.\n',
  );
}

const VARIANT = 'test-variant-reconcile';
const PHONE = '9000000077';

function draftOrder(): NewOrder {
  return {
    orderNumber: generateOrderNumber(),
    contact: { name: 'Reconcile Buyer', phone: PHONE },
    shippingAddress: {
      line1: '1 Test Street',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
    },
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
        productId: 'test-product',
        variantId: VARIANT,
        sku: 'TEST-SKU-RECONCILE',
        title: 'Test product',
        unitMrp: 120000,
        unitPrice: 100000,
        quantity: 1,
        lineTotal: 100000,
        taxRate: 0.18,
        installationIncluded: false,
      },
    ],
    paymentMethod: 'cod',
    isTest: true,
    status: 'confirmed',
    paymentStatus: 'pending',
  };
}

describe.skipIf(!CONFIGURED)('inventory reconciliation', () => {
  const repository = new PostgresOrderRepository();

  /** Place `count` orders and mark their reservations sold. */
  async function sell(count: number, available: number) {
    for (let i = 0; i < count; i += 1) {
      const result = await repository.createOrder({
        order: draftOrder(),
        reservations: [{ variantId: VARIANT, quantity: 1 }],
        availableByVariant: { [VARIANT]: available },
        reservationTtlMinutes: 15,
      });
      expect(result.ok).toBe(true);
      if (result.ok) await repository.consumeReservations(result.order.id);
    }
  }

  const availability = async () => (await repository.availability([VARIANT]))[VARIANT];

  beforeEach(async () => {
    await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
    await query(`DELETE FROM stock_reservations WHERE variant_id = $1`, [VARIANT]);
    await query(
      `INSERT INTO inventory_baseline (variant_id, hostinger_quantity, synced_at)
       VALUES ($1, 5, now())
       ON CONFLICT (variant_id)
       DO UPDATE SET hostinger_quantity = 5, synced_at = now()`,
      [VARIANT],
    );
  });

  afterAll(async () => {
    await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
    await query(`DELETE FROM stock_reservations WHERE variant_id = $1`, [VARIANT]);
    await query(`DELETE FROM inventory_baseline WHERE variant_id = $1`, [VARIANT]);
    await closePool();
  });

  it('does not subtract a sale twice once it has been deducted in hPanel', async () => {
    // 5 on the shelf, two of them sold here.
    await sell(2, 5);
    expect(await availability()).toBe(3);

    // The admin deducts those two in hPanel, so Hostinger now reports 3, and
    // resyncs. Before `reconciled_at` this produced 3 - 2 = 1: the same two
    // units removed a second time.
    await repository.reconcileInventory([{ variantId: VARIANT, quantity: 3 }]);

    expect(await availability()).toBe(3);
  });

  it('lets a restock in hPanel raise availability again', async () => {
    // The ratchet: the baseline was written once and never moved, so a
    // restock upstream could never be seen.
    await sell(2, 5);
    expect(await availability()).toBe(3);

    // Deducted *and* restocked to 10.
    await repository.reconcileInventory([{ variantId: VARIANT, quantity: 10 }]);

    expect(await availability()).toBe(10);
  });

  it('drops reconciled sales from the outstanding report', async () => {
    await sell(2, 5);

    const before = await repository.reconciliationReport();
    expect(before.find((row) => row.variantId === VARIANT)?.sold).toBe(2);

    await repository.reconcileInventory([{ variantId: VARIANT, quantity: 3 }]);

    const after = await repository.reconciliationReport();
    expect(after.find((row) => row.variantId === VARIANT)).toBeUndefined();
  });

  it('leaves an unsold reservation still holding its unit', async () => {
    // An active, unexpired reservation is not a sale and must survive a
    // resync — otherwise reconciling would release stock somebody is paying
    // for right now.
    const result = await repository.createOrder({
      order: draftOrder(),
      reservations: [{ variantId: VARIANT, quantity: 1 }],
      availableByVariant: { [VARIANT]: 5 },
      reservationTtlMinutes: 15,
    });
    expect(result.ok).toBe(true);
    expect(await availability()).toBe(4);

    await repository.reconcileInventory([{ variantId: VARIANT, quantity: 5 }]);

    expect(await availability()).toBe(4);

    const rows = await query<{ reconciled_at: Date | null }>(
      `SELECT reconciled_at FROM stock_reservations WHERE variant_id = $1 AND state = 'active'`,
      [VARIANT],
    );
    expect(rows.every((row) => row.reconciled_at === null)).toBe(true);
  });

  it('is idempotent — a second resync changes nothing', async () => {
    await sell(2, 5);
    const first = await repository.reconcileInventory([{ variantId: VARIANT, quantity: 3 }]);
    expect(first.reservations).toBe(2);

    const second = await repository.reconcileInventory([{ variantId: VARIANT, quantity: 3 }]);
    expect(second.reservations).toBe(0);
    expect(await availability()).toBe(3);
  });

  it('counts a sale made after reconciling', async () => {
    await sell(2, 5);
    await repository.reconcileInventory([{ variantId: VARIANT, quantity: 3 }]);
    expect(await availability()).toBe(3);

    // A fresh sale is unreconciled again and must subtract normally.
    await sell(1, 3);
    expect(await availability()).toBe(2);
  });
});
