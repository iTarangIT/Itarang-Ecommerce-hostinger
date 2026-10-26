import { query, queryOne } from '@/lib/db/pool';
import type { Order } from './types';

/**
 * Order invoices (`order_invoices`, migration 0029).
 *
 * An admin uploads the invoice PDF once the order is paid, then emails it to
 * the customer as an attachment. The file lives in the database, never in a
 * public bucket, and is served only through the admin-guarded route.
 */

/**
 * Kept below 10 MB on purpose: with middleware present, Next.js truncates a
 * request body at 10 MB, so a file near that size would arrive cut off and
 * fail to parse instead of being refused with a clear message.
 */
export const MAX_INVOICE_BYTES = 8 * 1024 * 1024;

export interface InvoiceMeta {
  fileName: string;
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
  size_bytes: number;
  uploaded_by: string;
  uploaded_at: Date;
  emailed_to: string | null;
  emailed_by: string | null;
  emailed_at: Date | null;
}

export async function findInvoiceMeta(orderId: number): Promise<InvoiceMeta | null> {
  const row = await queryOne<MetaRow>(
    `SELECT file_name, size_bytes, uploaded_by, uploaded_at, emailed_to, emailed_by, emailed_at
       FROM order_invoices WHERE order_id = $1`,
    [orderId],
  );
  if (!row) return null;
  return {
    fileName: row.file_name,
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
  actor: string,
): Promise<void> {
  await query(
    `INSERT INTO order_invoices (order_id, file_name, size_bytes, content, uploaded_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (order_id) DO UPDATE
       SET file_name = EXCLUDED.file_name,
           size_bytes = EXCLUDED.size_bytes,
           content = EXCLUDED.content,
           uploaded_by = EXCLUDED.uploaded_by,
           uploaded_at = now(),
           emailed_to = NULL,
           emailed_by = NULL,
           emailed_at = NULL`,
    [orderId, file.fileName, file.content.length, file.content, actor],
  );
}

export async function markInvoiceEmailed(orderId: number, to: string, actor: string): Promise<void> {
  await query(
    `UPDATE order_invoices SET emailed_to = $2, emailed_by = $3, emailed_at = now()
      WHERE order_id = $1`,
    [orderId, to, actor],
  );
}
