import { NextResponse } from 'next/server';
import { z } from 'zod';
import { orders } from '@/lib/orders/postgres-repository';
import { paymentProvider } from '@/lib/payments';
import { MockPaymentProvider } from '@/lib/payments/mock-provider';

export const dynamic = 'force-dynamic';

const schema = z.object({
  orderNumber: z.string().trim().min(1),
  outcome: z.enum(['success', 'failure', 'abandon']),
});

/**
 * Test-mode payment simulation.
 *
 * The mock provider's signing secret stays on the server, so the browser cannot
 * produce a callback itself — it asks for one here. The callback is then run
 * through the *same* `verifyCallback` path a real gateway response would take,
 * which is the point: the signature check, the payment record and the state
 * transition are all genuinely exercised.
 *
 * Available only while the mock provider is active. With a real gateway
 * configured this endpoint refuses, so it can never be used to mark a real
 * order paid.
 */
export async function POST(request: Request) {
  const provider = paymentProvider();

  if (!(provider instanceof MockPaymentProvider)) {
    return NextResponse.json(
      { error: 'Payment simulation is only available with the mock payment provider.' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid simulation request.' }, { status: 400 });
  }

  const repository = orders();
  const order = await repository.findByOrderNumber(parsed.data.orderNumber);

  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  if (!order.gatewayOrderId) {
    return NextResponse.json(
      { error: 'This order has no payment intent to simulate against.' },
      { status: 409 },
    );
  }

  const callback = provider.simulateCallback(order.gatewayOrderId, parsed.data.outcome);
  const result = await provider.verifyCallback(callback, order);

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

  // 'pending' is the abandonment case: nothing changes and the reservation is
  // left to expire on its own.
  const updated =
    result.status === 'pending'
      ? order
      : await repository.applyPaymentStatus(
          order.id,
          result.status,
          'test-simulation',
          result.errorDescription ?? 'Simulated in test mode',
        );

  return NextResponse.json({
    ok: result.ok,
    outcome: parsed.data.outcome,
    orderNumber: order.orderNumber,
    status: updated?.status ?? order.status,
    paymentStatus: updated?.paymentStatus ?? order.paymentStatus,
    error: result.errorDescription,
  });
}
