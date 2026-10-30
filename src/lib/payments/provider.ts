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

export type ProviderId = 'mock' | 'razorpay-test' | 'razorpay';

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
  /** Refund events: the gateway's refund id, which `order_refunds` is keyed on. */
  refundId?: string;
  /** `payment_link.paid`: the link, which is how a staff-placed order is found (R-18). */
  paymentLinkId?: string;
}

export interface RefundRequest {
  gatewayPaymentId: string;
  amount: Paise;
  orderNumber: string;
  reason: string;
}

export interface RefundResult {
  refundId: string;
  /** `processed` when the gateway settled it at once; otherwise the webhook will. */
  status: 'pending' | 'processed' | 'failed';
  amount: Paise;
}

export interface PaymentLinkRequest {
  order: Order;
  /** When the link stops working; the stock hold for the order ends at the same time. */
  expiresAt: Date;
}

export interface PaymentLink {
  id: string;
  url: string;
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

  /** Refund part or all of a captured payment (R-12). */
  refund(request: RefundRequest): Promise<RefundResult>;

  /**
   * A hosted payment page for an order staff placed for a customer (R-18).
   * Absent where the gateway has none — the mock cannot take a payment from a
   * customer's phone.
   */
  createPaymentLink?(request: PaymentLinkRequest): Promise<PaymentLink>;
}

export class PaymentProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}
