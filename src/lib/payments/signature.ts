import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Payment signature primitives.
 *
 * Both the mock and the Razorpay providers use these, so the signature code
 * path exercised by local testing is the same one that will run against a real
 * gateway — the only difference is which secret is supplied.
 *
 * Comparison is always constant-time. A `===` on a hex digest leaks timing
 * information that can, given enough attempts, be used to forge one.
 */

export function hmacSha256Hex(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Constant-time comparison of two hex digests. */
export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  // Length is not secret, and timingSafeEqual throws on a mismatch.
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Callback signature check.
 *
 * `orderId` must be the gateway order id **stored on our own order row**, never
 * the one echoed back by the browser — Razorpay's documentation is explicit
 * about this, and it is what stops a forged callback naming someone else's
 * order.
 */
export function verifyPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret: string;
}): boolean {
  if (!input.signature || !input.secret) return false;
  const expected = hmacSha256Hex(`${input.orderId}|${input.paymentId}`, input.secret);
  return safeEqualHex(expected, input.signature);
}

/**
 * Webhook signature check.
 *
 * The **raw** request body must be passed — parsing and re-serialising JSON
 * changes key order and whitespace, which changes the digest and breaks
 * verification. Gateways say this explicitly; it is the most common
 * integration mistake.
 */
export function verifyWebhookSignature(input: {
  rawBody: string;
  signature: string;
  secret: string;
}): boolean {
  if (!input.signature || !input.secret) return false;
  const expected = hmacSha256Hex(input.rawBody, input.secret);
  return safeEqualHex(expected, input.signature);
}

/** Sign a callback the way a gateway would — used by the mock provider and tests. */
export function signPayment(orderId: string, paymentId: string, secret: string): string {
  return hmacSha256Hex(`${orderId}|${paymentId}`, secret);
}

/** Sign a webhook body the way a gateway would — used by the mock provider and tests. */
export function signWebhook(rawBody: string, secret: string): string {
  return hmacSha256Hex(rawBody, secret);
}
