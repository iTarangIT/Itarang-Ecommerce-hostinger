import { NextResponse } from 'next/server';
import { placeOrder } from '@/lib/orders/place-order';
import { fieldErrors, placeOrderSchema } from '@/lib/checkout/validation';
import { grantOrderAccess } from '@/lib/orders/access';
import { databaseUnavailableMessage, isDatabaseUnavailable } from '@/lib/db/errors';

export const dynamic = 'force-dynamic';

/**
 * Create an order and, for online payment, a payment intent.
 *
 * Requires an `Idempotency-Key` header. A repeated submit — a double click, a
 * retried request after a dropped connection — returns the original order
 * rather than creating a second one and reserving stock twice.
 */
export async function POST(request: Request) {
  const idempotencyKey = request.headers.get('idempotency-key')?.trim();
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: 'An Idempotency-Key header is required to place an order.' },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = placeOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Please check the details below.', fields: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  if (parsed.data.paymentMethod === 'cod') {
    return NextResponse.json(
      { error: 'Use /api/checkout/cod for cash-on-delivery orders.' },
      { status: 400 },
    );
  }

  let result: Awaited<ReturnType<typeof placeOrder>>;
  try {
    result = await placeOrder({ ...parsed.data, idempotencyKey });
  } catch (error) {
    // Fail closed: no order was recorded, so nothing may be charged.
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json(
        { error: databaseUnavailableMessage(error), code: 'database_unavailable' },
        { status: 503 },
      );
    }
    throw error;
  }

  if (!result.ok) {
    const status = result.code === 'insufficient_stock' ? 409 : 400;
    return NextResponse.json(result, { status });
  }

  // Let this browser view the confirmation without re-entering the phone
  // number; everyone else goes through the phone-gated lookup.
  await grantOrderAccess(result.order.orderNumber);

  return NextResponse.json({
    ok: true,
    reused: result.reused,
    orderNumber: result.order.orderNumber,
    total: result.order.amounts.total,
    isTest: result.order.isTest,
    intent: result.intent,
  });
}
