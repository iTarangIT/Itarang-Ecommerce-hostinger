import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '@/lib/orders/types';
import { resetEnvCache } from '@/lib/env';
import { RazorpayTestProvider } from './razorpay-test-provider';
import { signPayment, signWebhook } from './signature';
import { PaymentProviderError } from './provider';

/**
 * Razorpay test-mode provider.
 *
 * `fetch` is stubbed throughout — these assert our handling of what Razorpay
 * returns, not Razorpay itself. The live call is exercised separately against
 * the real test API.
 */

const KEY_ID = 'rzp_test_exampleexample';
const KEY_SECRET = 'test-key-secret-not-real';
const WEBHOOK_SECRET = 'test-webhook-secret-not-real';

function orderFixture(overrides: Partial<Order> = {}): Order {
  return {
    id: 1,
    orderNumber: 'ITG-2608-ABC123',
    status: 'pending_payment',
    paymentStatus: 'pending',
    contact: { name: 'Test Buyer', phone: '9876543210' },
    shippingAddress: { line1: '1 Road', city: 'Pune', state: 'MH', pincode: '411001' },
    amounts: {
      subtotal: 850000,
      productSavings: 0,
      couponDiscount: 0,
      shipping: 0,
      codFee: 0,
      total: 850000,
      gstAmount: 129661,
      gstRate: 0.18,
    },
    items: [],
    paymentMethod: 'razorpay-test',
    isTest: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const original = { ...process.env };

beforeEach(() => {
  process.env.PAYMENT_PROVIDER = 'razorpay-test';
  process.env.RAZORPAY_KEY_ID = KEY_ID;
  process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  resetEnvCache();
});

afterEach(() => {
  process.env = { ...original };
  resetEnvCache();
  vi.unstubAllGlobals();
});

function stubFetch(body: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('createIntent', () => {
  it('sends the order total in paise and returns the gateway order id', async () => {
    const fetchMock = stubFetch({ id: 'order_TEST123', amount: 850000, currency: 'INR' });

    const intent = await new RazorpayTestProvider().createIntent(orderFixture());

    expect(intent.gatewayOrderId).toBe('order_TEST123');
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.amount).toBe(850000);
    expect(body.currency).toBe('INR');
    expect(body.receipt).toBe('ITG-2608-ABC123');
  });

  it('puts only the key id in clientParams — never a secret', async () => {
    stubFetch({ id: 'order_TEST123', amount: 850000, currency: 'INR' });

    const intent = await new RazorpayTestProvider().createIntent(orderFixture());
    const serialised = JSON.stringify(intent.clientParams);

    expect(intent.clientParams.key).toBe(KEY_ID);
    expect(serialised).not.toContain(KEY_SECRET);
    expect(serialised).not.toContain(WEBHOOK_SECRET);
  });

  it('refuses an amount the gateway did not record as ours', async () => {
    // The customer would otherwise be shown one figure and charged another.
    stubFetch({ id: 'order_TEST123', amount: 85000, currency: 'INR' });

    await expect(new RazorpayTestProvider().createIntent(orderFixture())).rejects.toThrow(
      PaymentProviderError,
    );
  });

  it('refuses a currency that is not INR', async () => {
    stubFetch({ id: 'order_TEST123', amount: 850000, currency: 'USD' });

    await expect(new RazorpayTestProvider().createIntent(orderFixture())).rejects.toThrow(
      /currency USD/,
    );
  });

  it('surfaces an API failure rather than proceeding', async () => {
    stubFetch({ error: { description: 'nope' } }, false, 401);

    await expect(new RazorpayTestProvider().createIntent(orderFixture())).rejects.toThrow(
      /Razorpay order creation failed \(401\)/,
    );
  });
});

describe('verifyCallback', () => {
  it('accepts a signature over our stored gateway order id', async () => {
    const order = orderFixture({ gatewayOrderId: 'order_TEST123' });
    const signature = signPayment('order_TEST123', 'pay_TEST999', KEY_SECRET);

    const result = await new RazorpayTestProvider().verifyCallback(
      { gatewayOrderId: 'order_TEST123', gatewayPaymentId: 'pay_TEST999', signature },
      order,
    );

    expect(result.signatureVerified).toBe(true);
    expect(result.status).toBe('paid');
  });

  it('rejects a signature computed over an order id the client supplied', async () => {
    // The browser's copy of the order id is never trusted: the HMAC is checked
    // against the id on our own row, so swapping it cannot forge a payment.
    const order = orderFixture({ gatewayOrderId: 'order_OURS' });
    const signature = signPayment('order_THEIRS', 'pay_TEST999', KEY_SECRET);

    const result = await new RazorpayTestProvider().verifyCallback(
      { gatewayOrderId: 'order_THEIRS', gatewayPaymentId: 'pay_TEST999', signature },
      order,
    );

    expect(result.signatureVerified).toBe(false);
    expect(result.status).toBe('failed');
  });

  it('rejects when the order has no gateway order id yet', async () => {
    const signature = signPayment('', 'pay_TEST999', KEY_SECRET);

    const result = await new RazorpayTestProvider().verifyCallback(
      { gatewayOrderId: '', gatewayPaymentId: 'pay_TEST999', signature },
      orderFixture(),
    );

    expect(result.signatureVerified).toBe(false);
  });
});

describe('verifyWebhook', () => {
  const provider = () => new RazorpayTestProvider();

  function delivery(body: unknown, secret = WEBHOOK_SECRET, eventId = 'evt_test_1') {
    const raw = JSON.stringify(body);
    return {
      raw,
      headers: new Headers({
        'x-razorpay-signature': signWebhook(raw, secret),
        'x-razorpay-event-id': eventId,
      }),
    };
  }

  it('verifies over the raw body', async () => {
    const { raw, headers } = delivery({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', amount: 850000, method: 'upi' } } },
    });

    const result = await provider().verifyWebhook(raw, headers);

    expect(result.ok).toBe(true);
    expect(result.status).toBe('paid');
    expect(result.gatewayOrderId).toBe('order_1');
    expect(result.gatewayPaymentId).toBe('pay_1');
    expect(result.amount).toBe(850000);
  });

  it('rejects a body signed with the wrong secret', async () => {
    const { raw, headers } = delivery(
      { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1' } } } },
      'not-the-webhook-secret',
    );

    const result = await provider().verifyWebhook(raw, headers);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('signature_mismatch');
  });

  it('rejects a tampered body whose signature no longer matches', async () => {
    const { headers } = delivery({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_1', amount: 100 } } },
    });

    const tampered = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_1', amount: 999999 } } },
    });

    expect((await provider().verifyWebhook(tampered, headers)).ok).toBe(false);
  });

  it('reads a refund from payload.refund.entity, not payload.payment', async () => {
    // Razorpay puts refunds under a different key. Reading the payment path
    // gave an empty object, so order_id was undefined and the webhook route
    // silently classified a real refund as "ignored".
    const { raw, headers } = delivery({
      event: 'refund.processed',
      payload: {
        refund: {
          entity: { id: 'rfnd_1', payment_id: 'pay_1', order_id: 'order_1', amount: 850000 },
        },
      },
    });

    const result = await provider().verifyWebhook(raw, headers);

    expect(result.status).toBe('refunded');
    expect(result.gatewayOrderId).toBe('order_1');
    // The payment being reversed, not the refund's own id — a payments row
    // keyed on the refund id would match nothing.
    expect(result.gatewayPaymentId).toBe('pay_1');
  });

  it('maps the event types we act on and ignores the rest', async () => {
    const cases: Array<[string, string | undefined]> = [
      ['payment.captured', 'paid'],
      ['order.paid', 'paid'],
      ['payment.authorized', 'authorized'],
      ['payment.failed', 'failed'],
      ['payment.dispute.created', undefined],
    ];

    for (const [event, expected] of cases) {
      const { raw, headers } = delivery({
        event,
        payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1' } } },
      });
      expect((await provider().verifyWebhook(raw, headers)).status, event).toBe(expected);
    }
  });

  it('never parses the body before the signature is verified', async () => {
    // Malformed JSON with a bad signature must be refused on the signature,
    // not blow up in JSON.parse.
    const headers = new Headers({
      'x-razorpay-signature': 'deadbeef',
      'x-razorpay-event-id': 'evt_1',
    });

    const result = await provider().verifyWebhook('{not json', headers);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('signature_mismatch');
  });
});

describe('construction refuses unsafe configuration', () => {
  it('will not start with a live key', () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_live_realmoney';
    resetEnvCache();
    // env() rejects a non-test key outright, whichever provider is selected.
    expect(() => new RazorpayTestProvider()).toThrow();
  });

  it('will not start without all three secrets', () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    resetEnvCache();
    expect(() => new RazorpayTestProvider()).toThrow();
  });
});
