import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { PostgresOrderRepository } from './postgres-repository';
import { generateOrderNumber } from './numbering';
import { trackView } from './tracking';
import type { NewOrder } from './types';

/**
 * The whole fulfilment lifecycle against the local `itarang_dev` database:
 * waiting for payment → paid/confirmed → packed → shipped (with courier) →
 * delivered, checking that each stage gets its date, notes reach the
 * customer's view unless marked internal, and courier details are kept.
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

const VARIANT = 'lifecycle-suite-variant';
const PHONE = '9000000077';

function draftOrder(overrides: Partial<NewOrder> = {}): NewOrder {
  return {
    orderNumber: generateOrderNumber(),
    contact: { name: 'Lifecycle Buyer', phone: PHONE },
    shippingAddress: { line1: '1 Test Street', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
    amounts: {
      subtotal: 100000,
      productSavings: 0,
      couponDiscount: 0,
      paymentDiscount: 0,
      shipping: 0,
      codFee: 0,
      total: 100000,
      gstAmount: 15254,
      gstRate: 0.18,
    },
    items: [
      {
        productId: 'p',
        variantId: VARIANT,
        sku: 'LC-SKU',
        title: 'Lifecycle product',
        unitMrp: 100000,
        unitPrice: 100000,
        quantity: 1,
        lineTotal: 100000,
        taxRate: 0.18,
        installationIncluded: false,
      },
    ],
    paymentMethod: 'mock',
    isTest: true,
    status: 'pending_payment',
    paymentStatus: 'pending',
    ...overrides,
  };
}

describe.skipIf(!CONFIGURED)('order lifecycle', () => {
  const repository = new PostgresOrderRepository();

  beforeEach(async () => {
    await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
    await query(
      `INSERT INTO inventory_baseline (variant_id, hostinger_quantity) VALUES ($1, 50)
       ON CONFLICT (variant_id) DO UPDATE SET hostinger_quantity = 50`,
      [VARIANT],
    );
  });

  afterAll(async () => {
    await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
    await query(`DELETE FROM inventory_baseline WHERE variant_id = $1`, [VARIANT]);
    await closePool();
  });

  async function newOrder(overrides: Partial<NewOrder> = {}) {
    const result = await repository.createOrder({
      order: draftOrder(overrides),
      reservations: [{ variantId: VARIANT, quantity: 1 }],
      availableByVariant: { [VARIANT]: 50 },
      reservationTtlMinutes: 15,
    });
    if (!result.ok) throw new Error('fixture order could not be created');
    return result.order;
  }

  it('dates every stage from payment to delivery and keeps the courier details', async () => {
    const order = await newOrder();
    expect(order.status).toBe('pending_payment');
    expect(order.stages).toEqual({});

    const paid = await repository.applyPaymentStatus(order.id, 'paid', 'webhook');
    expect(paid!.status).toBe('confirmed');
    expect(paid!.stages.paidAt).toBeDefined();
    expect(paid!.stages.confirmedAt).toBeDefined();

    const packed = await repository.transitionOrderStatus(order.id, 'packed', 'admin@itarang.com', 'Packed in a crate');
    expect(packed!.stages.packedAt).toBeDefined();

    const shipped = await repository.transitionOrderStatus(
      order.id,
      'shipped',
      'admin@itarang.com',
      'Customer asked us to call before delivery',
      {
        customerVisible: false,
        shipment: {
          courierName: 'Delhivery',
          trackingNumber: 'AWB123456',
          trackingUrl: 'https://www.delhivery.com/track/package/AWB123456',
          deliveryPerson: 'Ravi',
          deliveryPhone: '9876543210',
        },
      },
    );
    expect(shipped!.status).toBe('shipped');
    expect(shipped!.stages.shippedAt).toBeDefined();
    expect(shipped!.shipment).toEqual({
      courierName: 'Delhivery',
      trackingNumber: 'AWB123456',
      trackingUrl: 'https://www.delhivery.com/track/package/AWB123456',
      deliveryPerson: 'Ravi',
      deliveryPhone: '9876543210',
    });

    const delivered = await repository.transitionOrderStatus(order.id, 'delivered', 'admin@itarang.com', 'Handed to the customer');
    expect(delivered!.stages.deliveredAt).toBeDefined();

    // Dates only move forward through the lifecycle.
    const s = delivered!.stages;
    expect([s.paidAt!, s.packedAt!, s.shippedAt!, s.deliveredAt!]).toEqual(
      [s.paidAt!, s.packedAt!, s.shippedAt!, s.deliveredAt!].slice().sort(),
    );

    // What the customer sees: every step done with its date, the public notes,
    // and not the internal one.
    const events = await repository.listEvents(order.id);
    const visible = events.filter((event) => event.customerVisible);
    expect(visible.map((event) => event.note)).toContain('Packed in a crate');
    expect(visible.map((event) => event.note)).toContain('Handed to the customer');
    expect(visible.map((event) => event.note)).not.toContain('Customer asked us to call before delivery');
    expect(events.find((event) => event.note === 'Customer asked us to call before delivery')?.customerVisible).toBe(false);

    const view = trackView(delivered!.status, delivered!.createdAt, [], delivered!.stages);
    expect(view.steps.every((step) => step.state === 'done' && step.at)).toBe(true);
  });

  it('may skip Packed and go straight to Shipped', async () => {
    const order = await newOrder({ status: 'confirmed' });
    const shipped = await repository.transitionOrderStatus(order.id, 'shipped', 'admin@itarang.com');
    expect(shipped!.status).toBe('shipped');
    expect(shipped!.stages.packedAt).toBeUndefined();
  });

  it('dates a cash-on-delivery order as confirmed when it is created', async () => {
    const order = await newOrder({ status: 'confirmed', paymentMethod: 'cod' });
    expect(order.stages.confirmedAt).toBeDefined();
  });

  it('records a cancellation date and the first arrival time is never overwritten', async () => {
    const order = await newOrder({ status: 'confirmed' });
    const first = (await repository.findByOrderNumber(order.orderNumber))!.stages.confirmedAt;
    await repository.applyPaymentStatus(order.id, 'paid', 'webhook');
    const after = (await repository.findByOrderNumber(order.orderNumber))!;
    expect(after.stages.confirmedAt).toBe(first);

    const cancelled = await repository.transitionOrderStatus(order.id, 'cancelled', 'admin@itarang.com');
    expect(cancelled!.stages.cancelledAt).toBeDefined();
  });

  it('updates delivery details later and logs it for the customer', async () => {
    const order = await newOrder({ status: 'confirmed' });
    await repository.transitionOrderStatus(order.id, 'shipped', 'admin@itarang.com');
    const updated = await repository.updateShipment(order.id, { courierName: 'Blue Dart', trackingNumber: 'BD1' }, 'admin@itarang.com');
    expect(updated!.shipment).toEqual({ courierName: 'Blue Dart', trackingNumber: 'BD1' });

    const events = await repository.listEvents(order.id);
    expect(events.at(-1)?.note).toBe('Shipping details updated');
  });
});
