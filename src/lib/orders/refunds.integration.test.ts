import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { listCallbacks, markCalled } from '@/lib/admin/callbacks';
import { PostgresOrderRepository } from './postgres-repository';
import { generateOrderNumber } from './numbering';
import { cancelAndRefund } from './refunds';
import type { NewOrder, Order } from './types';

/**
 * Cancel and refund (R-12), staff payment links (R-18) and the call-back list
 * (R-13), against a real database with the mock payment provider.
 *
 * The cap is the money question: no sequence of refunds may return more than
 * the order took. Same gating as the other database suites.
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

const CONFIGURED =
  Boolean(process.env.DATABASE_URL) &&
  (!targetsRemote() || process.env.DB_ALLOW_REMOTE_TESTS === 'true') &&
  (process.env.PAYMENT_PROVIDER ?? 'mock') === 'mock';

const VARIANT = 'refund-suite-variant';
const PHONE = '9000000077';
const TOTAL = 100000;

function draftOrder(overrides: Partial<NewOrder> = {}): NewOrder {
  return {
    orderNumber: generateOrderNumber(),
    contact: { name: 'Refund Buyer', phone: PHONE },
    shippingAddress: { line1: '1 Test Street', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
    amounts: {
      subtotal: TOTAL,
      productSavings: 0,
      couponDiscount: 0,
      paymentDiscount: 0,
      shipping: 0,
      codFee: 0,
      total: TOTAL,
      gstAmount: 15254,
      gstRate: 0.18,
    },
    items: [
      {
        productId: 'p',
        variantId: VARIANT,
        sku: 'RF-SKU',
        title: 'Refund product',
        unitMrp: TOTAL,
        unitPrice: TOTAL,
        quantity: 1,
        lineTotal: TOTAL,
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

describe.skipIf(!CONFIGURED)('cancel and refund', () => {
  const repository = new PostgresOrderRepository();

  async function placed(overrides: Partial<NewOrder> = {}): Promise<Order> {
    const created = await repository.createOrder({
      order: draftOrder(overrides),
      reservations: [{ variantId: VARIANT, quantity: 1 }],
      availableByVariant: { [VARIANT]: 50 },
      reservationTtlMinutes: 15,
    });
    if (!created.ok) throw new Error('order not created');
    return created.order;
  }

  async function paid(): Promise<Order> {
    const order = await placed();
    await repository.recordPayment({
      orderId: order.id,
      provider: 'mock',
      gatewayPaymentId: `mock_pay_${order.orderNumber}`,
      status: 'paid',
      amount: TOTAL,
      signatureVerified: true,
    });
    return (await repository.applyPaymentStatus(order.id, 'paid', 'test'))!;
  }

  async function clean() {
    await query(
      `DELETE FROM order_refunds WHERE order_id IN (SELECT id FROM orders WHERE customer_phone = $1)`,
      [PHONE],
    );
    await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
  }

  beforeEach(async () => {
    await clean();
    await query(
      `INSERT INTO inventory_baseline (variant_id, hostinger_quantity) VALUES ($1, 50)
       ON CONFLICT (variant_id) DO UPDATE SET hostinger_quantity = 50`,
      [VARIANT],
    );
  });

  afterAll(async () => {
    await clean();
    await query(`DELETE FROM inventory_baseline WHERE variant_id = $1`, [VARIANT]);
    await closePool();
  });

  it('refunds in parts, cancels on the first, and refuses anything above what was paid', async () => {
    const order = await paid();

    const first = await cancelAndRefund({ order, amount: 40000, reason: 'Customer asked', actor: 'a@x.in' });
    expect(first.ok).toBe(true);

    let current = (await repository.findById(order.id))!;
    expect(current.status).toBe('cancelled');
    // Partly refunded: the payment is still `paid` until the whole amount is back.
    expect(current.paymentStatus).toBe('paid');

    const over = await cancelAndRefund({ order: current, amount: 70000, reason: 'Again', actor: 'b@x.in' });
    expect(over.ok).toBe(false);
    expect(over.message).toMatch(/600\.00|600/);

    const rest = await cancelAndRefund({ order: current, amount: 60000, reason: 'The rest', actor: 'b@x.in' });
    expect(rest.ok).toBe(true);

    current = (await repository.findById(order.id))!;
    expect(current.paymentStatus).toBe('refunded');

    const refunds = await repository.listRefunds(order.id);
    expect(refunds.map((refund) => [refund.amount, refund.status, refund.requestedBy])).toEqual([
      [40000, 'processed', 'a@x.in'],
      [60000, 'processed', 'b@x.in'],
    ]);

    const again = await cancelAndRefund({ order: current, amount: 1, reason: 'More', actor: 'c@x.in' });
    expect(again.ok).toBe(false);
  });

  it('refuses a refund on an order that was never paid', async () => {
    const order = await placed();
    const outcome = await cancelAndRefund({ order, amount: 100, reason: 'r', actor: 'a@x.in' });
    expect(outcome.ok).toBe(false);
    expect(await repository.listRefunds(order.id)).toEqual([]);
  });

  it('settles a pending refund from the webhook, and records one made in the dashboard', async () => {
    const order = await paid();
    const reserved = await repository.beginRefund({
      orderId: order.id,
      amount: 30000,
      reason: 'r',
      requestedBy: 'a@x.in',
      provider: 'razorpay',
      gatewayPaymentId: 'pay_x',
    });
    if (!reserved.ok) throw new Error('not reserved');
    await repository.recordRefundResponse(reserved.refundId, { gatewayRefundId: 'rfnd_a', status: 'pending' });

    expect(
      (await repository.settleRefund({ orderId: order.id, provider: 'razorpay', gatewayRefundId: 'rfnd_a', status: 'processed' }))
        .fullyRefunded,
    ).toBe(false);

    // Never seen before: refunded in the Razorpay dashboard.
    const dashboard = await repository.settleRefund({
      orderId: order.id,
      provider: 'razorpay',
      gatewayRefundId: 'rfnd_b',
      gatewayPaymentId: 'pay_x',
      amount: 70000,
      status: 'processed',
    });
    expect(dashboard.fullyRefunded).toBe(true);

    // A redelivered webhook changes nothing.
    await repository.settleRefund({
      orderId: order.id,
      provider: 'razorpay',
      gatewayRefundId: 'rfnd_b',
      gatewayPaymentId: 'pay_x',
      amount: 70000,
      status: 'processed',
    });
    const refunds = await repository.listRefunds(order.id);
    expect(refunds).toHaveLength(2);
    expect(refunds[1]!.requestedBy).toBe('gateway dashboard');
  });

  it('records a cancellation request once, before dispatch only', async () => {
    const order = await paid();
    expect((await repository.requestCancellation(order.id, 'Bought elsewhere'))?.cancellationRequest?.note).toBe(
      'Bought elsewhere',
    );
    expect(await repository.requestCancellation(order.id)).toBeNull();

    const unpaid = await placed();
    expect(await repository.requestCancellation(unpaid.id)).toBeNull();
  });

  it('finds a staff-placed order by its payment link', async () => {
    const order = await placed({ placedBy: 'staff@x.in' });
    await repository.setPaymentLink(order.id, { id: `plink_${order.orderNumber}`, url: 'https://rzp.io/i/x' }, 'staff@x.in');

    const found = await repository.findByPaymentLinkId(`plink_${order.orderNumber}`);
    expect(found?.placedBy).toBe('staff@x.in');
    expect(found?.paymentLink?.url).toBe('https://rzp.io/i/x');
  });

  it('lists an unpaid checkout for a call-back until it is paid or called', async () => {
    const order = await placed();
    const listed = () =>
      listCallbacks().then((rows) => rows.some((row) => row.kind === 'order' && row.subjectId === order.id));

    expect(await listed()).toBe(true);
    await markCalled({ kind: 'order', subjectId: order.id, calledBy: 'sales@x.in', note: 'Will pay tonight' });
    expect(await listed()).toBe(false);
    const all = await listCallbacks({ includeCalled: true });
    expect(all.find((row) => row.subjectId === order.id)?.calledBy).toBe('sales@x.in');

    const second = await placed();
    await repository.applyPaymentStatus(second.id, 'paid', 'test');
    const rows = await listCallbacks({ includeCalled: true });
    expect(rows.some((row) => row.kind === 'order' && row.subjectId === second.id)).toBe(false);
  });
});
