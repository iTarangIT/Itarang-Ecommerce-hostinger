import 'server-only';
import { query, queryOne } from '@/lib/db/pool';
import { csvCell, istDateTime } from '@/lib/orders/admin-tracking';
import type { AdminEntityType, FieldChange } from './audit';

/**
 * Logs → Product log and Order log.
 *
 * Product log reads `admin_events` (written by the catalogue actions through
 * `logAdminEvent`). Order log reads `order_events`, the history every order
 * already keeps — status moves, payments, notes and courier updates — joined
 * to the order for its number and customer.
 *
 * Both are filtered by the same half-open `[from, to)` range the other admin
 * screens use, plus a search box and a kind.
 */

export const LOG_TABS = ['product', 'order'] as const;
export type LogTab = (typeof LOG_TABS)[number];

export const PRODUCT_KINDS: Array<{ value: AdminEntityType; label: string }> = [
  { value: 'product', label: 'Products' },
  { value: 'category', label: 'Categories' },
  { value: 'pricing_import', label: 'Price sheet imports' },
  { value: 'stock', label: 'Stock emails' },
  { value: 'campaign', label: 'Campaigns' },
];

export const ORDER_KINDS = [
  { value: 'status', label: 'Status changes' },
  { value: 'payment', label: 'Payments' },
  { value: 'note', label: 'Notes and delivery details' },
] as const;
export type OrderKind = (typeof ORDER_KINDS)[number]['value'];

export interface LogFilters {
  q?: string;
  kind?: string;
}

export interface ProductLogRow {
  id: number;
  at: string;
  entityType: AdminEntityType;
  entityId: string | null;
  label: string | null;
  action: string;
  actor: string;
  summary: string;
  changes: FieldChange[];
}

export interface OrderLogRow {
  id: number;
  at: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  fromStatus: string | null;
  toStatus: string;
  actor: string;
  note: string | null;
  customerVisible: boolean;
}

function like(q: string | undefined): string | null {
  const term = q?.trim().toLowerCase();
  return term ? `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
}

export async function productLog(
  from: Date,
  to: Date,
  filters: LogFilters,
  limit: number,
  offset: number,
): Promise<{ rows: ProductLogRow[]; total: number }> {
  const params: unknown[] = [from, to];
  const clauses = ['created_at >= $1', 'created_at < $2'];

  if (filters.kind && PRODUCT_KINDS.some((k) => k.value === filters.kind)) {
    params.push(filters.kind);
    clauses.push(`entity_type = $${params.length}`);
  }
  const term = like(filters.q);
  if (term) {
    params.push(term);
    const i = params.length;
    clauses.push(
      `(lower(coalesce(entity_label, '')) LIKE $${i} OR lower(coalesce(entity_id, '')) LIKE $${i}
        OR lower(actor) LIKE $${i} OR lower(action) LIKE $${i} OR lower(changes::text) LIKE $${i})`,
    );
  }
  const where = `WHERE ${clauses.join(' AND ')}`;

  const total = await queryOne<{ total: number }>(
    `SELECT count(*)::int AS total FROM admin_events ${where}`,
    params,
  );
  params.push(limit, offset);
  const rows = await query<{
    id: string;
    created_at: Date;
    entity_type: AdminEntityType;
    entity_id: string | null;
    entity_label: string | null;
    action: string;
    actor: string;
    summary: string;
    changes: FieldChange[];
  }>(
    `SELECT id, created_at, entity_type, entity_id, entity_label, action, actor, summary, changes
       FROM admin_events ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return {
    total: total?.total ?? 0,
    rows: rows.map((row) => ({
      id: Number(row.id),
      at: row.created_at.toISOString(),
      entityType: row.entity_type,
      entityId: row.entity_id,
      label: row.entity_label,
      action: row.action,
      actor: row.actor,
      summary: row.summary,
      changes: Array.isArray(row.changes) ? row.changes : [],
    })),
  };
}

export async function orderLog(
  from: Date,
  to: Date,
  filters: LogFilters,
  limit: number,
  offset: number,
): Promise<{ rows: OrderLogRow[]; total: number }> {
  const params: unknown[] = [from, to];
  const clauses = ['e.created_at >= $1', 'e.created_at < $2'];

  switch (filters.kind as OrderKind | undefined) {
    case 'status':
      clauses.push(`e.to_status NOT LIKE 'payment:%' AND e.from_status IS DISTINCT FROM e.to_status`);
      break;
    case 'payment':
      clauses.push(`e.to_status LIKE 'payment:%'`);
      break;
    case 'note':
      clauses.push(`e.from_status IS NOT DISTINCT FROM e.to_status AND e.to_status NOT LIKE 'payment:%'`);
      break;
  }
  const term = like(filters.q);
  if (term) {
    params.push(term);
    const i = params.length;
    clauses.push(
      `(lower(o.order_number) LIKE $${i} OR lower(o.customer_name) LIKE $${i}
        OR o.customer_phone LIKE $${i} OR lower(e.actor) LIKE $${i} OR lower(coalesce(e.note, '')) LIKE $${i})`,
    );
  }
  const where = `WHERE ${clauses.join(' AND ')}`;

  const total = await queryOne<{ total: number }>(
    `SELECT count(*)::int AS total FROM order_events e JOIN orders o ON o.id = e.order_id ${where}`,
    params,
  );
  params.push(limit, offset);
  const rows = await query<{
    id: string;
    created_at: Date;
    order_number: string;
    customer_name: string;
    customer_phone: string;
    from_status: string | null;
    to_status: string;
    actor: string;
    note: string | null;
    customer_visible: boolean;
  }>(
    `SELECT e.id, e.created_at, o.order_number, o.customer_name, o.customer_phone,
            e.from_status, e.to_status, e.actor, e.note, e.customer_visible
       FROM order_events e JOIN orders o ON o.id = e.order_id
       ${where}
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return {
    total: total?.total ?? 0,
    rows: rows.map((row) => ({
      id: Number(row.id),
      at: row.created_at.toISOString(),
      orderNumber: row.order_number,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      actor: row.actor,
      note: row.note,
      customerVisible: row.customer_visible,
    })),
  };
}

const STATUS_WORDS: Record<string, string> = {
  pending_payment: 'Waiting for payment',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** `payment:paid` → "Payment paid", `shipped` → "Shipped". */
export function statusWords(status: string | null): string {
  if (!status) return '—';
  if (status.startsWith('payment:')) return `Payment ${status.slice('payment:'.length)}`;
  return STATUS_WORDS[status] ?? status;
}

/** What happened, in a few words: a move, or a note on an unchanged status. */
export function orderEventWhat(row: Pick<OrderLogRow, 'fromStatus' | 'toStatus'>): string {
  if (row.fromStatus === row.toStatus) return 'Note';
  if (!row.fromStatus) return statusWords(row.toStatus);
  return `${statusWords(row.fromStatus)} → ${statusWords(row.toStatus)}`;
}

export const ENTITY_WORDS: Record<AdminEntityType, string> = {
  product: 'Product',
  category: 'Category',
  pricing_import: 'Price sheet',
  stock: 'Stock',
  campaign: 'Campaign',
};

function csv(header: string[], body: Array<Array<string | number | boolean | null>>): string {
  const lines = [header.map(csvCell).join(','), ...body.map((cells) => cells.map(csvCell).join(','))];
  return `﻿${lines.join('\r\n')}\r\n`;
}

export function productLogCsv(rows: readonly ProductLogRow[]): string {
  return csv(
    ['When (IST)', 'Admin', 'Type', 'Item', 'Item id', 'Action', 'Summary', 'Changes'],
    rows.map((row) => [
      istDateTime(row.at),
      row.actor,
      ENTITY_WORDS[row.entityType] ?? row.entityType,
      row.label,
      row.entityId,
      row.action,
      row.summary,
      row.changes.map((c) => `${c.field}: ${c.from} → ${c.to}`).join('; '),
    ]),
  );
}

export function orderLogCsv(rows: readonly OrderLogRow[]): string {
  return csv(
    ['When (IST)', 'Order', 'Customer', 'Phone', 'What happened', 'By', 'Note', 'Shown to customer'],
    rows.map((row) => [
      istDateTime(row.at),
      row.orderNumber,
      row.customerName,
      row.customerPhone,
      orderEventWhat(row),
      row.actor,
      row.note,
      row.customerVisible ? 'Yes' : 'No',
    ]),
  );
}
