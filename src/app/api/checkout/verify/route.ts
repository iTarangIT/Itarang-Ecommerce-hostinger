import { NextResponse } from 'next/server';
import { orders } from '@/lib/orders/postgres-repository';
import { requireOrderAccess } from '@/lib/orders/checkout-auth';
import { paymentProvider } from '@/lib/payments';
import { callbackSchema, fieldErrors } from '@/lib/checkout/validation';

export const dynamic = 'force-dynamic';

/**
 * Payment callback verification — the fast path.
 *
 * The signature is checked against the gateway order id **stored on our own
 * order row**, never the one supplied in the request body. A correctly signed
 * callback naming somebody else's order is therefore rejected.
 *
 * This path is an optimisation for the shopper's benefit: the webhook is the
 * authority, and will complete the order even if the browser never returns.
 *
 * Entitlement is checked before any of that, for the reasons its two siblings
 * already do it. The signature check alone stops a forged *payment*, but it
 * does not stop an anonymous caller from learning that an order number exists
 * and what state it is in, and it does not stop them writing a `payments` row
 * per request — `gatewayPaymentId` is theirs to choose, and the row was
 * recorded before the signature verdict was acted on. `requireOrderAccess`
 * closes all three: same-origin, entitled, rate limited, and 404 for "not
 * yours" and "does not exist" alike so the order number is not an oracle.
 *
 * The browser that placed the order passes either as the signed-in owner or on
 * the signed device cookie `grantOrderAccess` set at placement, so a session
 * that lapsed between placing and paying still completes.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = callbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid callback.', fields: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  const access = await requireOrderAccess(parsed.data.orderNumber, request);
  if (!access.ok) return access.response;
  const order = access.order;

  const repository = orders();
  const provider = paymentProvider();
  const result = await provider.verifyCallback(
    {
      gatewayOrderId: parsed.data.gatewayOrderId,
      gatewayPaymentId: parsed.data.gatewayPaymentId,
      signature: parsed.data.signature,
      simulate: parsed.data.simulate,
    },
    order,
  );

  await repository.recordPayment({
    orderId: order.id,
    provider: provider.id,
    gatewayPaymentId: result.gatewayPaymentId,
    status: result.status,
    amount: order.amounts.total,
    method: result.method,
    signatureVerified: result.signatureVerified,
    errorCode: result.errorCode,
    errorDescription: result.errorDescription,
  });

  if (!result.signatureVerified) {
    // Never advance the order on an unverified callback; log it for
    // reconciliation instead.
    console.warn(
      `[checkout] signature mismatch for ${order.orderNumber} payment ${result.gatewayPaymentId}`,
    );
    return NextResponse.json(
      { ok: false, reason: 'signature_mismatch', orderNumber: order.orderNumber },
      { status: 400 },
    );
  }

  // 'pending' means abandoned — leave the order alone so the reservation TTL
  // can do its work and the shopper can retry.
  const updated =
    result.status === 'pending'
      ? order
      : await repository.applyPaymentStatus(
          order.id,
          result.status,
          'callback',
          result.errorDescription,
        );

  return NextResponse.json({
    ok: result.ok,
    orderNumber: order.orderNumber,
    status: updated?.status ?? order.status,
    paymentStatus: updated?.paymentStatus ?? order.paymentStatus,
    isTest: order.isTest,
    error: result.errorDescription,
  });
}
