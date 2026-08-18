import { NextResponse } from 'next/server';
import { orders } from '@/lib/orders/postgres-repository';
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

  const repository = orders();
  const order = await repository.findByOrderNumber(parsed.data.orderNumber);

  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

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
