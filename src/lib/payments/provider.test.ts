import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '@/lib/orders/types';
import { resetEnvCache } from '@/lib/env';
import { MockPaymentProvider } from './mock-provider';
import { paymentProvider, resetPaymentProvider } from './index';
import { RazorpayTestProvider } from './razorpay-test-provider';

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
    paymentMethod: 'mock',
    isTest: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('provider resolution', () => {
  const original = { ...process.env };

  beforeEach(() => {
    resetEnvCache();
    resetPaymentProvider();
  });

  afterEach(() => {
    process.env = { ...original };
    resetEnvCache();
    resetPaymentProvider();
  });

  it('defaults to the mock provider when PAYMENT_PROVIDER is unset', () => {
    delete process.env.PAYMENT_PROVIDER;
    const provider = paymentProvider();
    expect(provider.id).toBe('mock');
    expect(provider.requiresNetwork).toBe(false);
    expect(provider.isTestOnly).toBe(true);
  });

  it('never constructs the Razorpay provider under mock', () => {
    process.env.PAYMENT_PROVIDER = 'mock';
    expect(paymentProvider()).toBeInstanceOf(MockPaymentProvider);
  });

  it('refuses to construct Razorpay without credentials', () => {
    process.env.PAYMENT_PROVIDER = 'razorpay-test';
    delete process.env.RAZORPAY_KEY_ID;
    // env() itself rejects the combination before the provider is reached.
    expect(() => paymentProvider()).toThrow();
  });

  it('refuses a live key outright', () => {
    process.env.PAYMENT_PROVIDER = 'razorpay-test';
    process.env.RAZORPAY_KEY_ID = 'rzp_live_abcdefghij';
    process.env.RAZORPAY_KEY_SECRET = 'secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'whsecret';
    expect(() => paymentProvider()).toThrow(/TEST/i);
  });

  it('rejects a live key even when the mock provider is selected', () => {
    process.env.PAYMENT_PROVIDER = 'mock';
    process.env.RAZORPAY_KEY_ID = 'rzp_live_abcdefghij';
    expect(() => paymentProvider()).toThrow(/rzp_test_/);
  });

  it('exposes RazorpayTestProvider as a class but leaves it unused here', () => {
    // Present in the codebase, inert in this configuration.
    expect(typeof RazorpayTestProvider).toBe('function');
  });
});

describe('MockPaymentProvider — makes no network call', () => {
  it('creates an intent without touching fetch', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    const provider = new MockPaymentProvider();

    const intent = await provider.createIntent(orderFixture());

    expect(spy).not.toHaveBeenCalled();
    expect(intent.gatewayOrderId).toMatch(/^mock_order_/);
    expect(intent.amount).toBe(850000);
    // Nothing resembling a real gateway key is handed to the browser.
    expect(JSON.stringify(intent.clientParams)).not.toMatch(/rzp_/);
    spy.mockRestore();
  });

  it('verifies a callback and completes the payment', async () => {
    const provider = new MockPaymentProvider();
    const intent = await provider.createIntent(orderFixture());
    const order = orderFixture({ gatewayOrderId: intent.gatewayOrderId });

    const callback = provider.simulateCallback(intent.gatewayOrderId, 'success');
    const result = await provider.verifyCallback(callback, order);

    expect(result.ok).toBe(true);
    expect(result.status).toBe('paid');
    expect(result.signatureVerified).toBe(true);
  });

  it('reports a simulated failure without marking the order paid', async () => {
    const provider = new MockPaymentProvider();
    const intent = await provider.createIntent(orderFixture());
    const order = orderFixture({ gatewayOrderId: intent.gatewayOrderId });

    const result = await provider.verifyCallback(
      provider.simulateCallback(intent.gatewayOrderId, 'failure'),
      order,
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.signatureVerified).toBe(true);
    expect(result.errorCode).toBe('simulated_failure');
  });

  it('leaves an abandoned payment pending so the reservation can run down', async () => {
    const provider = new MockPaymentProvider();
    const intent = await provider.createIntent(orderFixture());
    const order = orderFixture({ gatewayOrderId: intent.gatewayOrderId });

    const result = await provider.verifyCallback(
      provider.simulateCallback(intent.gatewayOrderId, 'abandon'),
      order,
    );

    expect(result.status).toBe('pending');
    expect(result.ok).toBe(false);
  });

  it('rejects a callback naming a different order — the forgery case', async () => {
    const provider = new MockPaymentProvider();
    const mine = await provider.createIntent(orderFixture());
    const theirs = await provider.createIntent(orderFixture({ id: 2 }));

    // Correctly signed, but for someone else's order.
    const callback = provider.simulateCallback(theirs.gatewayOrderId, 'success');
    const result = await provider.verifyCallback(
      callback,
      orderFixture({ gatewayOrderId: mine.gatewayOrderId }),
    );

    expect(result.ok).toBe(false);
    expect(result.signatureVerified).toBe(false);
    expect(result.errorCode).toBe('signature_mismatch');
  });

  it('rejects a callback for an order with no intent yet', async () => {
    const provider = new MockPaymentProvider();
    const callback = provider.simulateCallback('mock_order_orphan', 'success');
    const result = await provider.verifyCallback(callback, orderFixture());
    expect(result.signatureVerified).toBe(false);
  });
});

describe('MockPaymentProvider — webhooks', () => {
  it('verifies a signed webhook and extracts the payment', async () => {
    const provider = new MockPaymentProvider();
    const { rawBody, headers } = provider.simulateWebhook({
      eventId: 'evt_1',
      eventType: 'payment.captured',
      gatewayOrderId: 'mock_order_1',
      gatewayPaymentId: 'mock_pay_1',
      amount: 850000,
    });

    const result = await provider.verifyWebhook(rawBody, headers);

    expect(result.ok).toBe(true);
    expect(result.eventId).toBe('evt_1');
    expect(result.status).toBe('paid');
    expect(result.gatewayOrderId).toBe('mock_order_1');
    expect(result.amount).toBe(850000);
  });

  it('rejects a webhook whose body was altered after signing', async () => {
    const provider = new MockPaymentProvider();
    const { rawBody, headers } = provider.simulateWebhook({
      eventId: 'evt_2',
      eventType: 'payment.captured',
      gatewayOrderId: 'mock_order_2',
      gatewayPaymentId: 'mock_pay_2',
      amount: 100,
    });

    const tampered = rawBody.replace('"amount":100', '"amount":1');
    const result = await provider.verifyWebhook(tampered, headers);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('signature_mismatch');
  });

  it('maps failure and authorisation events', async () => {
    const provider = new MockPaymentProvider();

    const failed = provider.simulateWebhook({
      eventId: 'evt_3',
      eventType: 'payment.failed',
      gatewayOrderId: 'o',
      gatewayPaymentId: 'p',
      amount: 1,
    });
    expect((await provider.verifyWebhook(failed.rawBody, failed.headers)).status).toBe('failed');

    const authorised = provider.simulateWebhook({
      eventId: 'evt_4',
      eventType: 'payment.authorized',
      gatewayOrderId: 'o',
      gatewayPaymentId: 'p',
      amount: 1,
    });
    expect((await provider.verifyWebhook(authorised.rawBody, authorised.headers)).status).toBe(
      'authorized',
    );
  });
});
