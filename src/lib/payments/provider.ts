import type { Paise } from '@/lib/commerce/types';
import type { Order, PaymentStatus } from '@/lib/orders/types';

/**
 * Payment provider contract.
 *
 * Checkout depends on this interface, never on a specific gateway. The local
 * testing build runs `MockPaymentProvider`; supplying real `rzp_test_`
 * credentials later swaps in `RazorpayTestProvider` without any checkout code
 * changing.
 */

export type ProviderId = 'mock' | 'razorpay-test';

export interface PaymentIntent {
  /** The gateway's order id, stored on our order row and used for verification. */
  gatewayOrderId: string;
  amount: Paise;
  currency: 'INR';
  /** Values safe to hand to the browser. Never contains a secret. */
  clientParams: Record<string, string | number>;
}

export interface CallbackPayload {
  gatewayOrderId: string;
  gatewayPaymentId: string;
  signature: string;
  /** Mock only — which outcome the tester chose. */
  simulate?: 'success' | 'failure' | 'abandon';
}

export interface VerifyResult {
  ok: boolean;
  status: PaymentStatus;
  gatewayPaymentId: string;
  method?: string;
  errorCode?: string;
  errorDescription?: string;
  signatureVerified: boolean;
}

export interface WebhookResult {
  ok: boolean;
  /** Deduplication key — a replay of the same id must be a no-op. */
  eventId: string;
  eventType: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  status?: PaymentStatus;
  amount?: Paise;
  method?: string;
  reason?: string;
}

export interface PaymentProvider {
  readonly id: ProviderId;
  /** False for the mock, so tests can assert no network call is possible. */
  readonly requiresNetwork: boolean;
  /** Shown in the UI; the mock's is deliberately unmistakable. */
  readonly displayName: string;
  /** True when orders paid through this provider are not real sales. */
  readonly isTestOnly: boolean;

  createIntent(order: Order): Promise<PaymentIntent>;
  verifyCallback(payload: CallbackPayload, order: Order): Promise<VerifyResult>;
  verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookResult>;
}

export class PaymentProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}
