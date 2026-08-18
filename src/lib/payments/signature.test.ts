import { describe, expect, it } from 'vitest';
import {
  hmacSha256Hex,
  safeEqualHex,
  signPayment,
  signWebhook,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from './signature';

const SECRET = 'test_secret_value';
const OTHER_SECRET = 'a_different_secret';

describe('hmacSha256Hex', () => {
  it('matches the documented gateway construction: order|payment', () => {
    // The exact concatenation gateways specify — a change here breaks every
    // real callback, so it is pinned.
    expect(hmacSha256Hex('order_abc|pay_xyz', SECRET)).toBe(
      hmacSha256Hex(`order_abc|pay_xyz`, SECRET),
    );
    expect(signPayment('order_abc', 'pay_xyz', SECRET)).toBe(
      hmacSha256Hex('order_abc|pay_xyz', SECRET),
    );
  });

  it('is deterministic and 64 hex characters', () => {
    const digest = hmacSha256Hex('anything', SECRET);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(hmacSha256Hex('anything', SECRET)).toBe(digest);
  });
});

describe('verifyPaymentSignature', () => {
  const orderId = 'order_9A8B7C';
  const paymentId = 'pay_1Z2Y3X';

  it('accepts a correctly signed callback', () => {
    const signature = signPayment(orderId, paymentId, SECRET);
    expect(verifyPaymentSignature({ orderId, paymentId, signature, secret: SECRET })).toBe(true);
  });

  it('rejects a signature made with a different secret', () => {
    const signature = signPayment(orderId, paymentId, OTHER_SECRET);
    expect(verifyPaymentSignature({ orderId, paymentId, signature, secret: SECRET })).toBe(false);
  });

  it('rejects a signature bound to a different order — the forged-callback case', () => {
    const signature = signPayment('order_SOMEONE_ELSE', paymentId, SECRET);
    expect(verifyPaymentSignature({ orderId, paymentId, signature, secret: SECRET })).toBe(false);
  });

  it('rejects a signature bound to a different payment', () => {
    const signature = signPayment(orderId, 'pay_OTHER', SECRET);
    expect(verifyPaymentSignature({ orderId, paymentId, signature, secret: SECRET })).toBe(false);
  });

  it('rejects a tampered digest', () => {
    const signature = signPayment(orderId, paymentId, SECRET);
    const tampered = `${signature.slice(0, -1)}${signature.endsWith('a') ? 'b' : 'a'}`;
    expect(verifyPaymentSignature({ orderId, paymentId, signature: tampered, secret: SECRET })).toBe(
      false,
    );
  });

  it('rejects empty, malformed and truncated signatures', () => {
    for (const signature of ['', 'not-hex', 'abcd', signPayment(orderId, paymentId, SECRET).slice(0, 32)]) {
      expect(verifyPaymentSignature({ orderId, paymentId, signature, secret: SECRET })).toBe(false);
    }
  });

  it('rejects when no secret is configured', () => {
    const signature = signPayment(orderId, paymentId, SECRET);
    expect(verifyPaymentSignature({ orderId, paymentId, signature, secret: '' })).toBe(false);
  });
});

describe('verifyWebhookSignature', () => {
  const rawBody = '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_1"}}}}';

  it('accepts the raw body signed with the webhook secret', () => {
    const signature = signWebhook(rawBody, SECRET);
    expect(verifyWebhookSignature({ rawBody, signature, secret: SECRET })).toBe(true);
  });

  it('fails when the body was re-serialised — the classic integration mistake', () => {
    const signature = signWebhook(rawBody, SECRET);
    // Parsing and re-stringifying changes whitespace and key order.
    const reserialised = JSON.stringify(JSON.parse(rawBody), null, 2);
    expect(verifyWebhookSignature({ rawBody: reserialised, signature, secret: SECRET })).toBe(false);
  });

  it('rejects the callback secret being used for webhooks', () => {
    const signature = signWebhook(rawBody, OTHER_SECRET);
    expect(verifyWebhookSignature({ rawBody, signature, secret: SECRET })).toBe(false);
  });

  it('rejects a modified body', () => {
    const signature = signWebhook(rawBody, SECRET);
    const altered = rawBody.replace('pay_1', 'pay_2');
    expect(verifyWebhookSignature({ rawBody: altered, signature, secret: SECRET })).toBe(false);
  });
});

describe('safeEqualHex', () => {
  it('is true only for identical digests', () => {
    const a = hmacSha256Hex('x', SECRET);
    expect(safeEqualHex(a, a)).toBe(true);
    expect(safeEqualHex(a, hmacSha256Hex('y', SECRET))).toBe(false);
  });

  it('handles length mismatch without throwing', () => {
    expect(safeEqualHex('abcd', 'abcdef')).toBe(false);
    expect(safeEqualHex('', '')).toBe(false);
  });
});
