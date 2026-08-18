import { NextResponse } from 'next/server';
import { orders } from '@/lib/orders/postgres-repository';
import { paymentProvider } from '@/lib/payments';

export const dynamic = 'force-dynamic';

/**
 * Payment webhook — the authoritative payment state.
 *
 * Three things make this safe against how gateways actually behave:
 *
 * 1. The **raw** body is read with `text()` and verified before anything parses
 *    it. Parsing and re-serialising changes the bytes and breaks the signature.
 * 2. The event id is inserted with a unique constraint, so a redelivery of the
 *    same event is a no-op rather than a second state change. Gateways state
 *    plainly that events may arrive more than once.
 * 3. `applyPaymentStatus` ignores anything that would move the payment
 *    backwards, so a late `authorized` arriving after `captured` changes
 *    nothing. Ordering is not guaranteed either.
 *
 * A 200 is returned for anything already handled, so the gateway stops retrying.
 */
export async function POST(request: Request) {
  // Never `await request.json()` here — the raw bytes are what was signed.
  const rawBody = await request.text();

  const provider = paymentProvider();
  const result = await provider.verifyWebhook(rawBody, request.headers);

  if (!result.ok) {
    console.warn(`[webhook] rejected: ${result.reason ?? 'unknown reason'}`);
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 400 });
  }

  if (!result.eventId) {
    return NextResponse.json({ ok: false, reason: 'missing_event_id' }, { status: 400 });
  }

  const repository = orders();

  const isNew = await repository.recordWebhookEvent(
    provider.id,
    result.eventId,
    result.eventType,
    JSON.parse(rawBody) as unknown,
  );

  if (!isNew) {
    // Already processed. 200 so the gateway stops retrying.
    return NextResponse.json({ ok: true, duplicate: true, eventId: result.eventId });
  }

  if (!result.status || !result.gatewayOrderId) {
    // A verified event we do not act on — recorded, acknowledged, ignored.
    return NextResponse.json({ ok: true, ignored: true, eventType: result.eventType });
  }

  const order = await repository.findByGatewayOrderId(result.gatewayOrderId);

  if (!order) {
    // A payment for an order we do not have. Logged rather than silently
    // dropped, because it means something is genuinely wrong.
    console.warn(
      `[webhook] ${result.eventType} for unknown gateway order ${result.gatewayOrderId}`,
    );
    return NextResponse.json({ ok: true, unmatched: true });
  }

  if (result.gatewayPaymentId) {
    await repository.recordPayment({
      orderId: order.id,
      provider: provider.id,
      gatewayPaymentId: result.gatewayPaymentId,
      status: result.status,
      amount: result.amount ?? order.amounts.total,
      method: result.method,
      signatureVerified: true,
    });
  }

  const updated = await repository.applyPaymentStatus(
    order.id,
    result.status,
    'webhook',
    result.eventType,
  );

  return NextResponse.json({
    ok: true,
    orderNumber: order.orderNumber,
    paymentStatus: updated?.paymentStatus,
    status: updated?.status,
  });
}
