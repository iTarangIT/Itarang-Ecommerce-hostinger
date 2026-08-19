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
 * A signature that does not verify gets a 400 — deliberately: the usual cause is
 * a misconfigured secret on our side, and retries are what let the event land
 * once that is fixed. A genuine forgery is not retrying anyway.
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

  // Claim the event. `processed_at` stays NULL until the work below succeeds,
  // so a failure part-way leaves a row the sweeper can find and the gateway's
  // retry can still get through.
  const isNew = await repository.beginWebhookEvent(
    provider.id,
    result.eventId,
    result.eventType,
    JSON.parse(rawBody) as unknown,
  );

  if (!isNew) {
    // Already claimed. 200 so the gateway stops retrying.
    return NextResponse.json({ ok: true, duplicate: true, eventId: result.eventId });
  }

  try {
    if (!result.status || !result.gatewayOrderId) {
      // A verified event we do not act on — recorded, acknowledged, ignored.
      await repository.completeWebhookEvent(provider.id, result.eventId);
      return NextResponse.json({ ok: true, ignored: true, eventType: result.eventType });
    }

    const order = await repository.findByGatewayOrderId(result.gatewayOrderId);

    if (!order) {
      // A payment for an order we do not have. Logged rather than silently
      // dropped, because it means something is genuinely wrong.
      console.warn(
        `[webhook] ${result.eventType} for unknown gateway order ${result.gatewayOrderId}`,
      );
      await repository.completeWebhookEvent(provider.id, result.eventId);
      return NextResponse.json({ ok: true, unmatched: true });
    }

    // The amount the gateway reports must be the amount we asked for.
    //
    // Nothing checked this before, so an underpayment — or a paise/rupee unit
    // error at either end — still drove the order to paid and confirmed. A
    // mismatch is recorded and acknowledged, never applied: the money question
    // is for a human, and retrying the delivery would not change the answer.
    if (typeof result.amount === 'number' && result.amount !== order.amounts.total) {
      console.warn(
        `[webhook] amount mismatch on ${order.orderNumber}: gateway reported ` +
          `${result.amount} paise, order total is ${order.amounts.total}`,
      );

      if (result.gatewayPaymentId) {
        await repository.recordPayment({
          orderId: order.id,
          provider: provider.id,
          gatewayPaymentId: result.gatewayPaymentId,
          status: 'failed',
          amount: result.amount,
          method: result.method,
          signatureVerified: true,
          errorCode: 'amount_mismatch',
          errorDescription: `Gateway reported ${result.amount}, expected ${order.amounts.total}.`,
        });
      }

      await repository.completeWebhookEvent(provider.id, result.eventId);
      return NextResponse.json({ ok: true, mismatch: true, orderNumber: order.orderNumber });
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

    await repository.completeWebhookEvent(provider.id, result.eventId);

    return NextResponse.json({
      ok: true,
      orderNumber: order.orderNumber,
      paymentStatus: updated?.paymentStatus,
      status: updated?.status,
    });
  } catch (error) {
    // Release the claim so the gateway's retry is not turned away as a
    // duplicate, and answer 500 so it does retry. Without this the payment
    // update would be lost for good.
    await repository.abandonWebhookEvent(provider.id, result.eventId).catch(() => {
      // If even this fails the row stays claimed-but-unprocessed, which is
      // exactly what `db:sweep` reports.
    });

    console.error(`[webhook] failed to apply ${result.eventId}: ${(error as Error).message}`);
    return NextResponse.json({ ok: false, reason: 'processing_failed' }, { status: 500 });
  }
}
