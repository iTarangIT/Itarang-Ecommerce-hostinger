import { afterAll, describe, expect, it } from 'vitest';
import type { Order } from '@/lib/orders/types';
import { resetEnvCache } from '@/lib/env';
import { RazorpayTestProvider } from './razorpay-test-provider';

/**
 * Live calls against Razorpay's **test** API.
 *
 * Off by default. It needs network access and real `rzp_test_` credentials, and
 * it creates order objects in the Razorpay test dashboard — harmless, but not
 * something an ordinary `npm run test` should do. Enable deliberately:
 *
 *   RAZORPAY_LIVE_TEST=true npm run test
 *
 * `env.ts` refuses any key that is not `rzp_test_`, so this can never reach a
 * live account even if the environment is wrong.
 */

const ENABLED =
  process.env.RAZORPAY_LIVE_TEST === 'true' &&
  Boolean(process.env.RAZORPAY_KEY_ID) &&
  Boolean(process.env.RAZORPAY_KEY_SECRET) &&
  Boolean(process.env.RAZORPAY_WEBHOOK_SECRET);

if (!ENABLED) {
  console.warn(
    '\n  [skipped] Razorpay live-API tests. Set RAZORPAY_LIVE_TEST=true with rzp_test_ ' +
      'credentials to run them.\n',
  );
}

const AMOUNT = 100_00; // ₹100 in paise — small, and never charged.

function orderFixture(total: number, suffix: string): Order {
  return {
    id: 1,
    orderNumber: `ITG-TEST-${suffix}`,
    status: 'pending_payment',
    paymentStatus: 'pending',
    contact: { name: 'Integration Buyer', phone: '9876543210' },
    shippingAddress: { line1: '1 Road', city: 'Pune', state: 'MH', pincode: '411001' },
    amounts: {
      subtotal: total,
      productSavings: 0,
      couponDiscount: 0,
      shipping: 0,
      codFee: 0,
      total,
      gstAmount: 0,
      gstRate: 0.18,
    },
    items: [],
    paymentMethod: 'razorpay-test',
    isTest: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe.skipIf(!ENABLED)('Razorpay test API', () => {
  const previous = process.env.PAYMENT_PROVIDER;

  // The provider refuses to construct unless it is the selected one.
  process.env.PAYMENT_PROVIDER = 'razorpay-test';
  resetEnvCache();

  afterAll(() => {
    process.env.PAYMENT_PROVIDER = previous;
    resetEnvCache();
  });

  it('authenticates and creates a real test-mode order', async () => {
    const provider = new RazorpayTestProvider();
    const intent = await provider.createIntent(orderFixture(AMOUNT, 'CREATE'));

    // Razorpay order ids are `order_` prefixed.
    expect(intent.gatewayOrderId).toMatch(/^order_/);
    expect(intent.amount).toBe(AMOUNT);
    expect(intent.currency).toBe('INR');
  }, 30_000);

  it('hands the browser the key id and nothing secret', async () => {
    const provider = new RazorpayTestProvider();
    const intent = await provider.createIntent(orderFixture(AMOUNT, 'PARAMS'));
    const serialised = JSON.stringify(intent.clientParams);

    expect(String(intent.clientParams.key)).toMatch(/^rzp_test_/);
    expect(serialised).not.toContain(process.env.RAZORPAY_KEY_SECRET!);
    expect(serialised).not.toContain(process.env.RAZORPAY_WEBHOOK_SECRET!);
  }, 30_000);

  it('creates an order whose recorded amount matches ours exactly', async () => {
    // A paise/rupee unit error would show up here as a factor-of-100 gap, and
    // createIntent refuses rather than returning a mismatched intent.
    const odd = 123_45;
    const provider = new RazorpayTestProvider();
    const intent = await provider.createIntent(orderFixture(odd, 'AMOUNT'));

    expect(intent.amount).toBe(odd);
  }, 30_000);
});
