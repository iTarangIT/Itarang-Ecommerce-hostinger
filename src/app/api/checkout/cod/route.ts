import { NextResponse } from 'next/server';
import { placeOrder } from '@/lib/orders/place-order';
import { fieldErrors, placeOrderSchema } from '@/lib/checkout/validation';
import { grantOrderAccess } from '@/lib/orders/access';
import { requireCustomer } from '@/lib/orders/checkout-auth';
import { databaseUnavailableMessage, isDatabaseUnavailable } from '@/lib/db/errors';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * Cash on delivery.
 *
 * No payment provider is involved at any point — this path cannot reach a
 * gateway even if one were configured. The order is confirmed immediately and
 * its stock reservation is consumed, because the sale is committed the moment
 * the order is accepted.
 *
 * **COD is switched off for this release**, and this handler now says so
 * itself. `buildQuote` already refused a COD quote whenever `COD_ENABLED` is
 * false, so no COD order could be created — but that refusal was reached only
 * after authenticating the caller, consuming their idempotency key and
 * rebuilding a full quote, and it arrived dressed as `invalid_quote`, which
 * reads as a problem with the cart. The route is the honest place to state a
 * closed payment method, and stating it in two independent places is the point:
 * neither is load-bearing alone.
 */
export async function POST(request: Request) {
  // Before authentication, because the answer does not depend on who is asking
  // and there is nothing here worth making an anonymous caller work for.
  if (!env().COD_ENABLED) {
    return NextResponse.json(
      {
        error: 'Cash on delivery is not available. Please pay online.',
        code: 'cod_disabled',
      },
      { status: 403 },
    );
  }

  // Checked before anything else: an unauthenticated caller must not be able
  // to probe validation behaviour or consume an idempotency key.
  const auth = await requireCustomer(request);
  if (!auth.ok) return auth.response;

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

  let result: Awaited<ReturnType<typeof placeOrder>>;
  try {
    result = await placeOrder({
      ...parsed.data,
      paymentMethod: 'cod',
      idempotencyKey,
      userId: auth.user.id,
    });
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
    const status =
      result.code === 'insufficient_stock' || result.code === 'price_changed' ? 409 : 400;
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
  });
}
