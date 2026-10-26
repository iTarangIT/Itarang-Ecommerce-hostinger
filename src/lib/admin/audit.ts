import 'server-only';
import { query } from '@/lib/db/pool';
import type { ProductRecord, VariantInput } from '@/lib/products/types';

/**
 * The admin change log (`admin_events`, migration 0028), read by Logs → Product log.
 *
 * Writing is best effort and never throws. The change it describes has already
 * committed by the time this runs; failing the admin's save because the log
 * could not be written would report a saved product as unsaved.
 */

export type AdminEntityType = 'product' | 'category' | 'stock' | 'pricing_import' | 'campaign';

export interface FieldChange {
  field: string;
  from: string;
  to: string;
}

export interface AdminEventInput {
  entityType: AdminEntityType;
  entityId?: string | null;
  label?: string | null;
  action: string;
  actor: string;
  summary?: string;
  changes?: FieldChange[];
}

export async function logAdminEvent(event: AdminEventInput): Promise<void> {
  try {
    await query(
      `INSERT INTO admin_events (entity_type, entity_id, entity_label, action, actor, summary, changes)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        event.entityType,
        event.entityId ?? null,
        event.label ?? null,
        event.action,
        event.actor,
        event.summary ?? '',
        JSON.stringify(event.changes ?? []),
      ],
    );
  } catch (error) {
    console.error(`[admin] change log not written (${event.entityType} ${event.action}):`, error);
  }
}

/** Long values are cut so one edited description cannot fill the log page. */
const MAX_VALUE = 160;

/** How a value reads in the log. Paise fields are converted by the caller. */
export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    if (value.every((item) => typeof item === 'string' || typeof item === 'number')) {
      return cut(value.join(', '));
    }
    return `${value.length} item${value.length === 1 ? '' : 's'}`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== null && v !== undefined,
    );
    return entries.length ? cut(entries.map(([k, v]) => `${k}: ${String(v)}`).join(', ')) : '—';
  }
  return cut(String(value));
}

function cut(text: string): string {
  return text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE - 1)}…` : text;
}

/** "warrantyMonths" → "Warranty months". */
export function fieldLabel(field: string): string {
  const words = field.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The fields of `patch` whose value differs from the product as it was.
 * Compared as JSON so arrays and objects count as changed only when they are.
 */
export function diffFields(
  before: Partial<Record<string, unknown>> | null,
  patch: Record<string, unknown>,
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const [field, to] of Object.entries(patch)) {
    const from = before ? before[field] : undefined;
    if (JSON.stringify(from ?? null) === JSON.stringify(to ?? null)) continue;
    changes.push({ field: fieldLabel(field), from: displayValue(from), to: displayValue(to) });
  }
  return changes;
}

const rupees = (paise: number | null | undefined) =>
  paise === null || paise === undefined ? '—' : `₹${(paise / 100).toLocaleString('en-IN')}`;

/** Per-SKU price, stock and availability changes from a pricing save. */
export function diffVariants(before: ProductRecord | null, after: VariantInput[]): FieldChange[] {
  const old = new Map((before?.variants ?? []).map((v) => [v.sku.toLowerCase(), v]));
  const changes: FieldChange[] = [];

  for (const variant of after) {
    const previous = old.get(variant.sku.toLowerCase());
    old.delete(variant.sku.toLowerCase());
    if (!previous) {
      changes.push({ field: `${variant.sku}`, from: '—', to: `Added at ${rupees(variant.selling)}` });
      continue;
    }
    const pairs: Array<[string, string, string]> = [
      ['MRP', rupees(previous.mrp), rupees(variant.mrp)],
      ['Selling price', rupees(previous.selling), rupees(variant.selling)],
      ['Cost price', rupees(previous.costPrice), rupees(variant.costPrice)],
      ['Stock', displayValue(previous.stock), displayValue(variant.stock)],
      ['Availability', displayValue(previous.availability), displayValue(variant.availability)],
    ];
    for (const [label, from, to] of pairs) {
      if (from !== to) changes.push({ field: `${variant.sku} · ${label}`, from, to });
    }
  }

  for (const removed of old.values()) {
    changes.push({ field: removed.sku, from: rupees(removed.selling), to: 'Removed' });
  }
  return changes;
}
