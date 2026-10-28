import { query, queryOne } from '@/lib/db/pool';
import type { Order } from './types';

/**
 * Order invoices (`order_invoices`, migration 0029).
 *
 * An admin uploads the invoice PDF once the order is paid, then emails it to
 * the customer as an attachment. The file lives in the database, never in a
 * public bucket, and is served only through the admin-guarded route and the
 * customer's own order page (`/api/orders/[orderNumber]/invoice`).
 *
 * Invoices are raised in Zoho or Vyapaar (D-06), so the store never generates
 * one; the upload carries the number and date printed on it (migration 0030).
 */

/**
 * Kept below 10 MB on purpose: with middleware present, Next.js truncates a
 * request body at 10 MB, so a file near that size would arrive cut off and
 * fail to parse instead of being refused with a clear message.
 */
export const MAX_INVOICE_BYTES = 8 * 1024 * 1024;

export interface InvoiceMeta {
  fileName: string;
  invoiceNumber?: string;
  /** `YYYY-MM-DD`, as printed on the invoice. */
  invoiceDate?: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
  emailedTo?: string;
  emailedBy?: string;
  emailedAt?: string;
}

export interface InvoiceFile {
  fileName: string;
  content: Buffer;
}

export interface InvoiceDetails {
  invoiceNumber: string;
  invoiceDate: string;
}

/**
 * The number and date typed beside the upload. Both required: an invoice the
 * customer cannot quote is the gap R-08 closes. The date may not be in the
 * future (IST) — a typo there would put the invoice in the wrong GST month.
 */
export function parseInvoiceDetails(
  number: unknown,
  date: unknown,
  today: string = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10),
): InvoiceDetails | { error: string } {
  const invoiceNumber = typeof number === 'string' ? number.trim() : '';
  const invoiceDate = typeof date === 'string' ? date.trim() : '';
  if (!invoiceNumber) return { error: 'Enter the invoice number printed on the PDF.' };
  if (invoiceNumber.length > 60) return { error: 'That invoice number is too long.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate) || Number.isNaN(Date.parse(invoiceDate))) {
    return { error: 'Enter the invoice date.' };
  }
  if (invoiceDate > today) return { error: 'The invoice date cannot be in the future.' };
  return { invoiceNumber, invoiceDate };
}

/**
 * Whether an invoice may be attached yet: the money has arrived. A COD order
 * is paid on delivery, so it qualifies once it is delivered.
 */
export function canInvoice(order: Pick<Order, 'paymentStatus' | 'paymentMethod' | 'status'>): boolean {
  if (order.status === 'cancelled') return false;
  if (order.paymentStatus === 'paid') return true;
  return order.paymentMethod === 'cod' && order.status === 'delivered';
}

/** A PDF starts with `%PDF-`; the browser-supplied type alone is not trusted. */
export function looksLikePdf(bytes: Uint8Array): boolean {
  return (
    bytes.length > 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

/** Keeps a downloadable, header-safe name ending in `.pdf`. */
export function safeInvoiceFileName(name: string, orderNumber: string): string {
  const base = name
    .replace(/\.pdf$/i, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${base || `invoice-${orderNumber}`}.pdf`;
}

interface MetaRow {
  file_name: string;
  invoice_number: string | null;
  invoice_date: string | null;
  size_bytes: number;
  uploaded_by: string;
  uploaded_at: Date;
  emailed_to: string | null;
  emailed_by: string | null;
  emailed_at: Date | null;
}

export async function findInvoiceMeta(orderId: number): Promise<InvoiceMeta | null> {
  const row = await queryOne<MetaRow>(
    `SELECT file_name, invoice_number, to_char(invoice_date, 'YYYY-MM-DD') AS invoice_date,
            size_bytes, uploaded_by, uploaded_at, emailed_to, emailed_by, emailed_at
       FROM order_invoices WHERE order_id = $1`,
    [orderId],
  );
  if (!row) return null;
  return {
    fileName: row.file_name,
    invoiceNumber: row.invoice_number ?? undefined,
    invoiceDate: row.invoice_date ?? undefined,
    sizeBytes: row.size_bytes,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at.toISOString(),
    emailedTo: row.emailed_to ?? undefined,
    emailedBy: row.emailed_by ?? undefined,
    emailedAt: row.emailed_at?.toISOString(),
  };
}

export async function readInvoice(orderId: number): Promise<InvoiceFile | null> {
  const row = await queryOne<{ file_name: string; content: Buffer }>(
    'SELECT file_name, content FROM order_invoices WHERE order_id = $1',
    [orderId],
  );
  return row ? { fileName: row.file_name, content: row.content } : null;
}

/** Stores the invoice, replacing any earlier one and clearing its sent record. */
export async function saveInvoice(
  orderId: number,
  file: InvoiceFile,
  details: InvoiceDetails,
  actor: string,
): Promise<void> {
  await query(
    `INSERT INTO order_invoices
       (order_id, file_name, size_bytes, content, uploaded_by, invoice_number, invoice_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (order_id) DO UPDATE
       SET file_name = EXCLUDED.file_name,
           invoice_number = EXCLUDED.invoice_number,
           invoice_date = EXCLUDED.invoice_date,
           size_bytes = EXCLUDED.size_bytes,
           content = EXCLUDED.content,
           uploaded_by = EXCLUDED.uploaded_by,
           uploaded_at = now(),
           emailed_to = NULL,
           emailed_by = NULL,
           emailed_at = NULL`,
    [
      orderId,
      file.fileName,
      file.content.length,
      file.content,
      actor,
      details.invoiceNumber,
      details.invoiceDate,
    ],
  );
}

export async function markInvoiceEmailed(orderId: number, to: string, actor: string): Promise<void> {
  await query(
    `UPDATE order_invoices SET emailed_to = $2, emailed_by = $3, emailed_at = now()
      WHERE order_id = $1`,
    [orderId, to, actor],
  );
}

export interface UninvoicedOrder {
  orderNumber: string;
  customerName: string;
  total: number;
  paidAt: string;
}

/**
 * Real (not test) paid orders that have waited longer than `olderThanHours`
 * for an invoice — what the daily reminder lists (R-08). Cancelled orders are
 * left out; COD is not, once delivered, matching `canInvoice`.
 */
export async function listUninvoicedOrders(olderThanHours = 24): Promise<UninvoicedOrder[]> {
  const rows = await query<{
    order_number: string;
    customer_name: string;
    total: string;
    paid_at: Date;
  }>(
    `SELECT o.order_number, o.customer_name, o.total,
            COALESCE(o.paid_at, o.delivered_at) AS paid_at
       FROM orders o
       LEFT JOIN order_invoices i ON i.order_id = o.id
      WHERE i.order_id IS NULL
        AND o.is_test = false
        AND o.status <> 'cancelled'
        AND (o.payment_status = 'paid' OR (o.payment_method = 'cod' AND o.status = 'delivered'))
        AND COALESCE(o.paid_at, o.delivered_at) < now() - make_interval(hours => $1)
      ORDER BY 4`,
    [olderThanHours],
  );
  return rows.map((row) => ({
    orderNumber: row.order_number,
    customerName: row.customer_name,
    total: Number(row.total),
    paidAt: row.paid_at.toISOString(),
  }));
}

/** Which of these orders have no invoice yet — for the admin order list badge. */
export async function ordersWithoutInvoice(orderIds: number[]): Promise<Set<number>> {
  if (orderIds.length === 0) return new Set();
  const rows = await query<{ order_id: string }>(
    'SELECT order_id FROM order_invoices WHERE order_id = ANY($1::bigint[])',
    [orderIds],
  );
  const invoiced = new Set(rows.map((row) => Number(row.order_id)));
  return new Set(orderIds.filter((id) => !invoiced.has(id)));
}
