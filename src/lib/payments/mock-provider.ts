import { randomBytes } from 'node:crypto';
import type { Order } from '@/lib/orders/types';
import { signPayment, signWebhook, verifyPaymentSignature, verifyWebhookSignature } from './signature';
import type {
  CallbackPayload,
  PaymentIntent,
  PaymentProvider,
  VerifyResult,
  WebhookResult,
} from './provider';

/**
 * Local test payment provider.
 *
 * NO NETWORK CALL IS MADE, EVER. This exists so the whole checkout state
 * machine — success, failure, abandonment, retry, idempotency, reservation
 * consume and release, webhook dedupe — can be exercised without a payment
 * gateway, real money, or credentials of any kind.
 *
 * It is not a stub that always succeeds. The tester chooses the outcome, which
 * is what makes the failure and retry paths genuinely testable.
 *
 * Signatures are real HMACs, produced and checked by the same functions the
 * Razorpay provider uses, so the verification code path under test is the one
 * that will run in production. The secret below is a fixed, published constant:
 * it protects nothing, and is deliberately obvious about that.
 */
const MOCK_SECRET = 'mock-provider-not-a-secret';

export class MockPaymentProvider implements PaymentProvider {
  readonly id = 'mock' as const;
  readonly requiresNetwork = false;
  readonly displayName = 'Test payment (no money moves)';
  readonly isTestOnly = true;

  async createIntent(order: Order): Promise<PaymentIntent> {
    // `mock_` prefix makes the origin of the id unmistakable in the database,
    // in logs and in the admin list.
    const gatewayOrderId = `mock_order_${randomBytes(9).toString('hex')}`;

    return {
      gatewayOrderId,
      amount: order.amounts.total,
      currency: 'INR',
      clientParams: {
        provider: 'mock',
        gatewayOrderId,
        amount: order.amounts.total,
        orderNumber: order.orderNumber,
      },
    };
  }

  /** Build the callback a gateway would send. Used by the test-mode UI and tests. */
  simulateCallback(
    gatewayOrderId: string,
    outcome: 'success' | 'failure' | 'abandon',
  ): CallbackPayload {
    const gatewayPaymentId = `mock_pay_${randomBytes(9).toString('hex')}`;
    return {
      gatewayOrderId,
      gatewayPaymentId,
      signature: signPayment(gatewayOrderId, gatewayPaymentId, MOCK_SECRET),
      simulate: outcome,
    };
  }

  async verifyCallback(payload: CallbackPayload, order: Order): Promise<VerifyResult> {
    // Verify against the id stored on our order, never the one supplied by the
    // browser — the same rule the real gateway documentation insists on.
    const storedOrderId = order.gatewayOrderId ?? '';

    const signatureVerified =
      storedOrderId === payload.gatewayOrderId &&
      verifyPaymentSignature({
        orderId: storedOrderId,
        paymentId: payload.gatewayPaymentId,
        signature: payload.signature,
        secret: MOCK_SECRET,
      });

    if (!signatureVerified) {
      return {
        ok: false,
        status: 'failed',
        gatewayPaymentId: payload.gatewayPaymentId,
        signatureVerified: false,
        errorCode: 'signature_mismatch',
        errorDescription: 'The payment signature did not match this order.',
      };
    }

    if (payload.simulate === 'failure') {
      return {
        ok: false,
        status: 'failed',
        gatewayPaymentId: payload.gatewayPaymentId,
        signatureVerified: true,
        method: 'test',
        errorCode: 'simulated_failure',
        errorDescription: 'Payment failure simulated in test mode.',
      };
    }

    if (payload.simulate === 'abandon') {
      // The shopper walked away: nothing changes, the reservation runs down.
      return {
        ok: false,
        status: 'pending',
        gatewayPaymentId: payload.gatewayPaymentId,
        signatureVerified: true,
        errorCode: 'simulated_abandon',
        errorDescription: 'Payment abandoned in test mode.',
      };
    }

    return {
      ok: true,
      status: 'paid',
      gatewayPaymentId: payload.gatewayPaymentId,
      method: 'test',
      signatureVerified: true,
    };
  }

  /** Build a signed webhook body — used by tests to exercise dedupe and ordering. */
  simulateWebhook(input: {
    eventId: string;
    eventType: 'payment.captured' | 'payment.failed' | 'payment.authorized';
    gatewayOrderId: string;
    gatewayPaymentId: string;
    amount: number;
  }): { rawBody: string; headers: Headers } {
    const rawBody = JSON.stringify({
      event: input.eventType,
      payload: {
        payment: {
          entity: {
            id: input.gatewayPaymentId,
            order_id: input.gatewayOrderId,
            amount: input.amount,
            method: 'test',
          },
        },
      },
    });

    const headers = new Headers({
      'content-type': 'application/json',
      'x-mock-event-id': input.eventId,
      'x-mock-signature': signWebhook(rawBody, MOCK_SECRET),
    });

    return { rawBody, headers };
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookResult> {
    const signature = headers.get('x-mock-signature') ?? '';
    const eventId = headers.get('x-mock-event-id') ?? '';

    if (!verifyWebhookSignature({ rawBody, signature, secret: MOCK_SECRET })) {
      return { ok: false, eventId, eventType: 'unknown', reason: 'signature_mismatch' };
    }

    let parsed: {
      event?: string;
      payload?: { payment?: { entity?: Record<string, unknown> } };
    };
    try {
      // Parsed only after verification — never before.
      parsed = JSON.parse(rawBody);
    } catch {
      return { ok: false, eventId, eventType: 'unknown', reason: 'invalid_json' };
    }

    const entity = parsed.payload?.payment?.entity ?? {};
    const eventType = parsed.event ?? 'unknown';

    const status =
      eventType === 'payment.captured'
        ? 'paid'
        : eventType === 'payment.authorized'
          ? 'authorized'
          : eventType === 'payment.failed'
            ? 'failed'
            : undefined;

    return {
      ok: true,
      eventId,
      eventType,
      gatewayOrderId: entity.order_id as string | undefined,
      gatewayPaymentId: entity.id as string | undefined,
      amount: entity.amount as number | undefined,
      method: entity.method as string | undefined,
      status,
    };
  }
}
