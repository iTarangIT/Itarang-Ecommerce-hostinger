import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { orders } from '@/lib/orders/postgres-repository';
import { normaliseOrderNumber } from '@/lib/orders/numbering';
import {
  MAX_INVOICE_BYTES,
  canInvoice,
  looksLikePdf,
  parseInvoiceDetails,
  readInvoice,
  safeInvoiceFileName,
  saveInvoice,
} from '@/lib/orders/invoices';

export const dynamic = 'force-dynamic';

/**
 * An order's invoice PDF, admin only.
 *
 *   POST  upload (multipart: `file`, `invoiceNumber`, `invoiceDate`) — replaces
 *         any earlier invoice
 *   GET   download
 *
 * A route handler rather than a Server Action because Server Action bodies are
 * capped at 1 MB, and a scanned invoice is often larger. The admin check is
 * here because nothing else guards an API route.
 */

type Params = { params: Promise<{ orderNumber: string }> };

async function requireAdmin(): Promise<string | null> {
  const user = await currentUser();
  return user && user.role === 'admin' ? user.email : null;
}

function backToOrder(orderNumber: string, notice: string): NextResponse {
  const url = new URL(`/admin/orders/${encodeURIComponent(orderNumber)}`, env().NEXT_PUBLIC_SITE_URL);
  url.searchParams.set('notice', notice);
  // 303 so the browser follows the form POST with a GET.
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request, { params }: Params) {
  const actor = await requireAdmin();
  if (!actor) return NextResponse.json({ error: 'Not authorised.' }, { status: 403 });

  // A plain form POST carries cookies cross-site; Server Actions check the
  // origin for us, a route handler has to do it itself.
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(env().NEXT_PUBLIC_SITE_URL).origin) {
    return NextResponse.json({ error: 'Cross-site upload refused.' }, { status: 403 });
  }

  const orderNumber = normaliseOrderNumber((await params).orderNumber);
  const repository = orders();
  const order = await repository.findByOrderNumber(orderNumber);
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

  if (!canInvoice(order)) {
    return backToOrder(order.orderNumber, 'An invoice can be added once the payment is received.');
  }

  // Refused from the declared size before reading: an oversized body is
  // truncated by Next.js and would otherwise fail as an unreadable upload.
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_INVOICE_BYTES + 64 * 1024) {
    return backToOrder(order.orderNumber, 'That file is too large (limit 8 MB).');
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return backToOrder(order.orderNumber, 'The upload could not be read. Try again.');
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return backToOrder(order.orderNumber, 'Choose the invoice PDF to upload.');
  }
  if (file.size > MAX_INVOICE_BYTES) {
    return backToOrder(order.orderNumber, 'That file is too large (limit 8 MB).');
  }

  const details = parseInvoiceDetails(formData.get('invoiceNumber'), formData.get('invoiceDate'));
  if ('error' in details) return backToOrder(order.orderNumber, details.error);

  const content = Buffer.from(await file.arrayBuffer());
  if (!looksLikePdf(content)) {
    return backToOrder(order.orderNumber, 'That file is not a PDF. Upload the invoice as a PDF.');
  }

  const fileName = safeInvoiceFileName(file.name, order.orderNumber);
  await saveInvoice(order.id, { fileName, content }, details, actor);
  await repository.addOrderNote(
    order.id,
    actor,
    `Invoice ${details.invoiceNumber} dated ${details.invoiceDate} uploaded (${fileName})`,
    false,
  );

  return backToOrder(order.orderNumber, 'Invoice uploaded. Use "Email invoice" to send it to the customer.');
}

export async function GET(_request: Request, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Not authorised.' }, { status: 403 });

  const order = await orders().findByOrderNumber(normaliseOrderNumber((await params).orderNumber));
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

  const invoice = await readInvoice(order.id);
  if (!invoice) return NextResponse.json({ error: 'No invoice uploaded.' }, { status: 404 });

  return new NextResponse(new Uint8Array(invoice.content), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.fileName}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
