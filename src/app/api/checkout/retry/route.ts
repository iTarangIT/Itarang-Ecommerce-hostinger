import { NextResponse } from 'next/server';
import { z } from 'zod';
import { orders } from '@/lib/orders/postgres-repository';
import { paymentProvider } from '@/lib/payments';

export const dynamic = 'force-dynamic';

const schema = z.object({ orderNumber: z.string().trim().min(1) });

/**
 * Retry payment on an existing order.
 *
 * A fresh payment intent is created against the same iTarang order, so the
 * order number, the stock reservation and the cart all survive a failed
 * attempt. Only an order still awaiting payment may be retried.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'An order number is required.' }, { status: 400 });
  }

  const repository = orders();
  const order = await repository.findByOrderNumber(parsed.data.orderNumber);

  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  if (order.paymentStatus === 'paid') {
    return NextResponse.json(
      { error: 'This order is already paid.', orderNumber: order.orderNumber },
      { status: 409 },
    );
  }

  if (order.status === 'cancelled') {
    return NextResponse.json({ error: 'This order was cancelled.' }, { status: 409 });
  }

  if (order.paymentMethod === 'cod') {
    return NextResponse.json(
      { error: 'Cash-on-delivery orders have no payment to retry.' },
      { status: 400 },
    );
  }

  const reservations = await repository.listReservations(order.id);
  const stillHeld = reservations.some(
    (reservation) => reservation.state === 'active' && new Date(reservation.expiresAt) > new Date(),
  );

  if (!stillHeld) {
    return NextResponse.json(
      {
        error:
          'The stock held for this order has been released. Please add the items to your cart again.',
        code: 'reservation_expired',
      },
      { status: 409 },
    );
  }

  const intent = await paymentProvider().createIntent(order);
  await repository.setGatewayOrderId(order.id, intent.gatewayOrderId);

  return NextResponse.json({
    ok: true,
    orderNumber: order.orderNumber,
    total: order.amounts.total,
    isTest: order.isTest,
    intent,
  });
}
