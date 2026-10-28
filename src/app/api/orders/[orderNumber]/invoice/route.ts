import { NextResponse } from 'next/server';
import { hasOrderAccess } from '@/lib/orders/access';
import { canInvoice, readInvoice } from '@/lib/orders/invoices';
import { normaliseOrderNumber } from '@/lib/orders/numbering';
import { orders } from '@/lib/orders/postgres-repository';

export const dynamic = 'force-dynamic';

/**
 * The customer's own invoice, for "Download invoice" on the order page (R-08).
 *
 * Gated exactly as the order page is — `hasOrderAccess` — and answers 404 for
 * "not yours" and "does not exist" alike, so the route is not an oracle for
 * order numbers. The admin copy stays at `/api/admin/orders/[n]/invoice`.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const orderNumber = normaliseOrderNumber((await params).orderNumber);
  const notFound = NextResponse.json({ error: 'Not found.' }, { status: 404 });

  if (!(await hasOrderAccess(orderNumber))) return notFound;

  const order = await orders().findByOrderNumber(orderNumber);
  if (!order || !canInvoice(order)) return notFound;

  const invoice = await readInvoice(order.id);
  if (!invoice) return notFound;

  return new NextResponse(new Uint8Array(invoice.content), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.fileName}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
