import type { Order } from '@/lib/orders/types';
import { env } from '@/lib/env';
import { verifyPaymentSignature, verifyWebhookSignature } from './signature';
import {
  PaymentProviderError,
  type CallbackPayload,
  type PaymentIntent,
  type PaymentLink,
  type PaymentLinkRequest,
  type PaymentProvider,
  type RefundRequest,
  type RefundResult,
  type VerifyResult,
  type WebhookResult,
} from './provider';

/**
 * Razorpay provider, in test or live mode.
 *
 * Constructed only when `PAYMENT_PROVIDER` is `razorpay-test` or `razorpay`;
 * otherwise checkout runs the mock and nothing here issues a request.
 *
 * The constructor refuses to build unless every condition holds:
 *   - the key id's prefix matches the mode — `rzp_test_` for `razorpay-test`,
 *     `rzp_live_` for `razorpay` — and
 *   - both the key secret and the webhook secret are present.
 *
 * `env()` applies the same prefix rule at boot, so a mismatched key cannot even
 * start the application. This is the second gate, in case the provider is
 * constructed from somewhere that bypassed the first.
 *
 * The contract implemented below is the documented one:
 *   order creation  POST https://api.razorpay.com/v1/orders, HTTP Basic auth,
 *                   `amount` in paise — the same unit as our `Paise` type
 *   callback        hmac_sha256(order_id + "|" + razorpay_payment_id, key_secret)
 *                   compared against `razorpay_signature`, using the order id
 *                   stored on OUR row, never the one echoed by the browser
 *   webhook         `X-Razorpay-Signature` over the RAW body, using the
 *                   separate webhook secret; deduplicated on `x-razorpay-event-id`
 *   refund          POST /v1/payments/:id/refund, `amount` in paise (R-12)
 *   payment link    POST /v1/payment_links, `reference_id` = our order number;
 *                   settled by the `payment_link.paid` webhook (R-18)
 */

const API_BASE = 'https://api.razorpay.com/v1';

export class RazorpayTestProvider implements PaymentProvider {
  readonly id: 'razorpay-test' | 'razorpay';
  readonly requiresNetwork = true;
  readonly displayName: string;
  readonly isTestOnly: boolean;

  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor() {
    const config = env();
    const mode = config.PAYMENT_PROVIDER;

    if (mode !== 'razorpay-test' && mode !== 'razorpay') {
      throw new PaymentProviderError(
        'RazorpayTestProvider constructed while PAYMENT_PROVIDER is not "razorpay-test" or "razorpay". ' +
          'This build uses the mock provider until Razorpay credentials are supplied.',
      );
    }

    const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET } = config;

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET || !RAZORPAY_WEBHOOK_SECRET) {
      throw new PaymentProviderError(
        'Razorpay credentials are not configured. Supply RAZORPAY_KEY_ID, ' +
          'RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET, or leave PAYMENT_PROVIDER=mock.',
      );
    }

    // The key must match the mode: a test build must never be able to move
    // real money, and a live build must never quietly take test payments.
    const live = mode === 'razorpay';
    if (!RAZORPAY_KEY_ID.startsWith(live ? 'rzp_live_' : 'rzp_test_')) {
      throw new PaymentProviderError(
        live
          ? 'Refusing to start: PAYMENT_PROVIDER=razorpay needs live credentials (rzp_live_…).'
          : 'Refusing to start: only Razorpay TEST credentials (rzp_test_…) may be used here.',
      );
    }

    this.id = mode;
    this.isTestOnly = !live;
    this.displayName = live
      ? 'Card / UPI / Net banking (Razorpay)'
      : 'Card / UPI / Net banking (Razorpay test mode)';
    this.keyId = RAZORPAY_KEY_ID;
    this.keySecret = RAZORPAY_KEY_SECRET;
    this.webhookSecret = RAZORPAY_WEBHOOK_SECRET;
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;
  }

  async createIntent(order: Order): Promise<PaymentIntent> {
    const response = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Already paise — no conversion, and therefore nothing to get wrong.
        amount: order.amounts.total,
        currency: 'INR',
        receipt: order.orderNumber,
        notes: { orderNumber: order.orderNumber },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new PaymentProviderError(
        `Razorpay order creation failed (${response.status}): ${body.slice(0, 300)}`,
      );
    }

    const created = (await response.json()) as { id: string; amount: number; currency?: string };

    // The gateway echoes back what it recorded. If that is not what we asked
    // for, the customer would be shown one figure and charged another, so this
    // fails the placement rather than proceeding on the mismatch. It also
    // catches a paise/rupee unit error immediately instead of at settlement.
    if (created.amount !== order.amounts.total) {
      throw new PaymentProviderError(
        `Razorpay recorded ${created.amount} paise for order ${order.orderNumber}, ` +
          `but the order total is ${order.amounts.total}. Refusing to take payment.`,
      );
    }

    if (created.currency && created.currency !== 'INR') {
      throw new PaymentProviderError(
        `Razorpay returned currency ${created.currency} for order ${order.orderNumber}.`,
      );
    }

    return {
      gatewayOrderId: created.id,
      amount: created.amount,
      currency: 'INR',
      clientParams: {
        // Only the key id reaches the browser. The secrets never leave the server.
        key: this.keyId,
        order_id: created.id,
        amount: created.amount,
        currency: 'INR',
        name: 'iTarang Products',
        // The order carries the UPI discount, so the window offers UPI alone.
        ...(order.amounts.paymentDiscount > 0 ? { upi_only: 1 } : {}),
      },
    };
  }

  async verifyCallback(payload: CallbackPayload, order: Order): Promise<VerifyResult> {
    const storedOrderId = order.gatewayOrderId ?? '';

    const signatureVerified =
      storedOrderId.length > 0 &&
      verifyPaymentSignature({
        orderId: storedOrderId,
        paymentId: payload.gatewayPaymentId,
        signature: payload.signature,
        secret: this.keySecret,
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

    return {
      ok: true,
      status: 'paid',
      gatewayPaymentId: payload.gatewayPaymentId,
      signatureVerified: true,
    };
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookResult> {
    const signature = headers.get('x-razorpay-signature') ?? '';
    const eventId = headers.get('x-razorpay-event-id') ?? '';

    if (!verifyWebhookSignature({ rawBody, signature, secret: this.webhookSecret })) {
      return { ok: false, eventId, eventType: 'unknown', reason: 'signature_mismatch' };
    }

    let parsed: {
      event?: string;
      payload?: {
        payment?: { entity?: Record<string, unknown> };
        refund?: { entity?: Record<string, unknown> };
        payment_link?: { entity?: Record<string, unknown> };
      };
    };
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return { ok: false, eventId, eventType: 'unknown', reason: 'invalid_json' };
    }

    const eventType = parsed.event ?? 'unknown';

    // Razorpay puts a refund under `payload.refund.entity`, not
    // `payload.payment.entity`. Reading the payment path for a refund event
    // yielded an empty object, so `order_id` was undefined and the webhook
    // route silently classified a real refund as "ignored".
    //
    // A refund entity carries `payment_id` rather than being the payment
    // itself, so the ids are taken from the right fields for each shape.
    const isRefund = eventType.startsWith('refund.');
    const entity = isRefund
      ? (parsed.payload?.refund?.entity ?? {})
      : (parsed.payload?.payment?.entity ?? {});

    const status =
      eventType === 'payment.captured' || eventType === 'order.paid' || eventType === 'payment_link.paid'
        ? 'paid'
        : eventType === 'payment.authorized'
          ? 'authorized'
          : eventType === 'payment.failed'
            ? 'failed'
            : eventType === 'refund.processed'
              ? 'refunded'
              : undefined;

    return {
      ok: true,
      eventId,
      eventType,
      // A refund entity as Razorpay documents it has no `order_id`; the
      // payment it reverses, delivered alongside it, does.
      gatewayOrderId: (entity.order_id ?? parsed.payload?.payment?.entity?.order_id) as
        | string
        | undefined,
      // For a refund the entity's own id is the refund id; the payment it
      // reverses is in `payment_id`. Using the refund id here would record a
      // payment row that matches nothing.
      gatewayPaymentId: (isRefund ? entity.payment_id : entity.id) as string | undefined,
      amount: entity.amount as number | undefined,
      method: entity.method as string | undefined,
      status,
      refundId: isRefund ? (entity.id as string | undefined) : undefined,
      // A link's payment is made against a gateway order Razorpay created for
      // the link, which we have never seen. The link id is how it is matched.
      paymentLinkId:
        eventType === 'payment_link.paid'
          ? (parsed.payload?.payment_link?.entity?.id as string | undefined)
          : undefined,
    };
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    const response = await fetch(
      `${API_BASE}/payments/${encodeURIComponent(request.gatewayPaymentId)}/refund`,
      {
        method: 'POST',
        headers: { Authorization: this.authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: request.amount,
          speed: 'normal',
          notes: { orderNumber: request.orderNumber, reason: request.reason.slice(0, 250) },
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new PaymentProviderError(
        `Razorpay refund failed (${response.status}): ${body.slice(0, 300)}`,
      );
    }

    const created = (await response.json()) as { id: string; amount: number; status?: string };

    // As with order creation: the figure the gateway recorded must be the one
    // asked for, or the cap the repository enforced means nothing.
    if (created.amount !== request.amount) {
      throw new PaymentProviderError(
        `Razorpay recorded a refund of ${created.amount} paise on ${request.orderNumber}, ` +
          `but ${request.amount} was asked for.`,
      );
    }

    return {
      refundId: created.id,
      status:
        created.status === 'processed' ? 'processed' : created.status === 'failed' ? 'failed' : 'pending',
      amount: created.amount,
    };
  }

  async createPaymentLink({ order, expiresAt }: PaymentLinkRequest): Promise<PaymentLink> {
    const response = await fetch(`${API_BASE}/payment_links`, {
      method: 'POST',
      headers: { Authorization: this.authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: order.amounts.total,
        currency: 'INR',
        accept_partial: false,
        reference_id: order.orderNumber,
        description: `iTarang order ${order.orderNumber}`,
        customer: {
          name: order.contact.name,
          contact: `+91${order.contact.phone}`,
          ...(order.contact.email ? { email: order.contact.email } : {}),
        },
        // Razorpay sends the link itself, by SMS and — when we have one — email.
        notify: { sms: true, email: Boolean(order.contact.email) },
        reminder_enable: true,
        expire_by: Math.floor(expiresAt.getTime() / 1000),
        notes: { orderNumber: order.orderNumber },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new PaymentProviderError(
        `Razorpay payment link creation failed (${response.status}): ${body.slice(0, 300)}`,
      );
    }

    const created = (await response.json()) as { id: string; short_url: string; amount: number };
    if (created.amount !== order.amounts.total) {
      throw new PaymentProviderError(
        `Razorpay recorded ${created.amount} paise on the link for ${order.orderNumber}, ` +
          `but the order total is ${order.amounts.total}.`,
      );
    }
    return { id: created.id, url: created.short_url };
  }
}
