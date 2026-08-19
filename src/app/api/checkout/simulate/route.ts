import { NextResponse } from 'next/server';
import { z } from 'zod';
import { orders } from '@/lib/orders/postgres-repository';
import { requireOrderAccess } from '@/lib/orders/checkout-auth';
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
 * Two things gate it, because "provider is the mock" was never enough on its
 * own — under the default configuration *any* unauthenticated caller who knew
 * an order number could drive that order to paid and confirmed:
 *
 * 1. Only while the mock provider is active. Selecting a real gateway disables
 *    this endpoint outright, so it can never mark a real payment.
 * 2. Only for an order the caller is entitled to. With ownership enforced this
 *    is a "complete my own test payment" button and nothing more.
 *
 * Deliberately *not* gated on `NODE_ENV`. This build is deployed with the mock
 * provider selected, and a production deployment running mock still needs its
 * test payments to complete — the provider is what decides whether simulation
 * is meaningful, not which machine the code happens to be running on. When a
 * real gateway is configured the check above closes this regardless.
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

  // Ownership, not just existence. 404 rather than 403 so this cannot be used
  // to discover which order numbers are real.
  const access = await requireOrderAccess(parsed.data.orderNumber, request);
  if (!access.ok) return access.response;
  const order = access.order;

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
