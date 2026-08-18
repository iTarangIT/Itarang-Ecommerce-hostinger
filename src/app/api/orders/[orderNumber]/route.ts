import { NextResponse } from 'next/server';
import { orders } from '@/lib/orders/postgres-repository';
import { normaliseOrderNumber } from '@/lib/orders/numbering';
import { PHONE_PATTERN } from '@/lib/checkout/validation';

export const dynamic = 'force-dynamic';

/**
 * Guest order lookup.
 *
 * Requires both the order number and the phone number on the order. The order
 * number alone is not enough: without the second factor anyone holding a
 * number could read a stranger's address and contact details.
 *
 * A wrong phone number and a non-existent order return the same response, so
 * this cannot be used to discover which order numbers exist.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const { orderNumber } = await params;
  const phone = new URL(request.url).searchParams.get('phone')?.trim() ?? '';

  if (!PHONE_PATTERN.test(phone)) {
    return NextResponse.json(
      { error: 'The mobile number on the order is required.' },
      { status: 400 },
    );
  }

  const repository = orders();
  const order = await repository.findForCustomer(normaliseOrderNumber(orderNumber), phone);

  if (!order) {
    // Deliberately identical for "no such order" and "wrong phone".
    return NextResponse.json(
      { error: 'No order matches that order number and mobile number.' },
      { status: 404 },
    );
  }

  const events = await repository.listEvents(order.id);

  return NextResponse.json({
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      isTest: order.isTest,
      placedAt: order.createdAt,
      total: order.amounts.total,
      amounts: order.amounts,
      items: order.items.map((item) => ({
        title: item.title,
        variantTitle: item.variantTitle,
        image: item.image,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      })),
      shippingAddress: order.shippingAddress,
      contactName: order.contact.name,
    },
    timeline: events.map((event) => ({
      status: event.toStatus,
      note: event.note,
      at: event.createdAt,
    })),
  });
}
