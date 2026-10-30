import { randomInt } from 'node:crypto';
import { query, queryOne } from '@/lib/db/pool';
import type { FormValues, SupportRequestKind } from './request-forms';

/**
 * Support requests: complaints, warranty registrations, installation bookings,
 * enquiries, call-backs and finance enquiries.
 *
 * Server-only. The public entry point is `submitSupportRequestAction`; this
 * module is the storage underneath it and the admin console's reads.
 */

export type SupportRequestStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportRequest {
  id: number;
  reference: string;
  kind: SupportRequestKind;
  status: SupportRequestStatus;
  name: string;
  phone: string;
  email: string | null;
  pincode: string | null;
  details: FormValues;
  userId: number | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
  /**
   * The CRM hand-off, for finance enquiries (R-15). `crmForwardedAt` null
   * means the CRM has not accepted it yet — not configured, down, or refused;
   * `crmLastError` says which.
   */
  crmForwardedAt: string | null;
  crmLeadId: string | null;
  crmLastError: string | null;
  crmAttempts: number;
}

interface Row {
  id: number;
  reference: string;
  kind: SupportRequestKind;
  status: SupportRequestStatus;
  name: string;
  phone: string;
  email: string | null;
  pincode: string | null;
  details: FormValues;
  user_id: number | null;
  admin_note: string | null;
  created_at: Date;
  updated_at: Date;
  updated_by: string | null;
  crm_forwarded_at: Date | null;
  crm_lead_id: string | null;
  crm_last_error: string | null;
  crm_attempts: number;
}

function toRequest(row: Row): SupportRequest {
  return {
    id: row.id,
    reference: row.reference,
    kind: row.kind,
    status: row.status,
    name: row.name,
    phone: row.phone,
    email: row.email,
    pincode: row.pincode,
    details: row.details,
    userId: row.user_id,
    adminNote: row.admin_note,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    updatedBy: row.updated_by,
    crmForwardedAt: row.crm_forwarded_at ? row.crm_forwarded_at.toISOString() : null,
    crmLeadId: row.crm_lead_id,
    crmLastError: row.crm_last_error,
    crmAttempts: row.crm_attempts,
  };
}

const PREFIX: Record<SupportRequestKind, string> = {
  complaint: 'CMP',
  warranty: 'WRN',
  installation: 'INS',
  enquiry: 'ENQ',
  callback: 'CBK',
  finance: 'FIN',
};

/** No 0/O or 1/I/L, so a reference read out over the phone is unambiguous. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** e.g. CMP-261017-4F7Q: kind, date, four random characters. */
export function generateReference(kind: SupportRequestKind, now = new Date()): string {
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  let suffix = '';
  for (let i = 0; i < 4; i += 1) suffix += ALPHABET[randomInt(ALPHABET.length)];
  return `${PREFIX[kind]}-${date}-${suffix}`;
}

const COLUMNS = `id, reference, kind, status, name, phone, email, pincode, details, user_id,
  admin_note, created_at, updated_at, updated_by,
  crm_forwarded_at, crm_lead_id, crm_last_error, crm_attempts`;

/** Fields stored in their own columns rather than in `details`. */
const CONTACT_FIELDS = new Set(['name', 'phone', 'email', 'pincode']);

export async function createSupportRequest(input: {
  kind: SupportRequestKind;
  values: FormValues;
  userId: number | null;
}): Promise<SupportRequest> {
  const details: FormValues = {};
  for (const [key, value] of Object.entries(input.values)) {
    if (!CONTACT_FIELDS.has(key)) details[key] = value;
  }

  // A reference collision is astronomically unlikely in a day, but retrying
  // costs nothing and an error page would cost the customer their request.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const row = await queryOne<Row>(
      `INSERT INTO support_requests (reference, kind, name, phone, email, pincode, details, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (reference) DO NOTHING
       RETURNING ${COLUMNS}`,
      [
        generateReference(input.kind),
        input.kind,
        input.values.name,
        input.values.phone,
        input.values.email ?? null,
        input.values.pincode ?? null,
        JSON.stringify(details),
        input.userId,
      ],
    );
    if (row) return toRequest(row);
  }
  throw new Error('Could not allocate a support reference.');
}

export async function listSupportRequests(filters: {
  status?: SupportRequestStatus;
  kind?: SupportRequestKind;
  /** Only finance enquiries the CRM has not accepted. */
  unforwarded?: boolean;
  limit?: number;
}): Promise<SupportRequest[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.unforwarded) where.push(`kind = 'finance' AND crm_forwarded_at IS NULL`);
  if (filters.status) {
    params.push(filters.status);
    where.push(`status = $${params.length}`);
  }
  if (filters.kind) {
    params.push(filters.kind);
    where.push(`kind = $${params.length}`);
  }
  params.push(Math.min(filters.limit ?? 200, 500));

  const rows = await query<Row>(
    `SELECT ${COLUMNS} FROM support_requests
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows.map(toRequest);
}

export async function countOpenSupportRequests(): Promise<number> {
  const row = await queryOne<{ count: number }>(
    `SELECT count(*)::int AS count FROM support_requests WHERE status IN ('open', 'in_progress')`,
  );
  return row?.count ?? 0;
}

export async function updateSupportRequest(
  id: number,
  change: { status: SupportRequestStatus; adminNote?: string },
  actor: string,
): Promise<void> {
  await query(
    `UPDATE support_requests
        SET status = $2,
            admin_note = COALESCE($3, admin_note),
            updated_at = now(),
            updated_by = $4
      WHERE id = $1`,
    [id, change.status, change.adminNote ?? null, actor],
  );
}

export async function findSupportRequest(id: number): Promise<SupportRequest | null> {
  const row = await queryOne<Row>(`SELECT ${COLUMNS} FROM support_requests WHERE id = $1`, [id]);
  return row ? toRequest(row) : null;
}

export async function countUnforwardedFinanceRequests(): Promise<number> {
  const row = await queryOne<{ count: number }>(
    `SELECT count(*)::int AS count FROM support_requests
      WHERE kind = 'finance' AND crm_forwarded_at IS NULL`,
  );
  return row?.count ?? 0;
}

/**
 * Record one attempt to hand a finance enquiry to the CRM.
 *
 * A success sets the forwarded time and lead id and clears the error; a
 * failure keeps whatever earlier success there was (there is none, or this
 * would not have been retried) and stores why. Every attempt is counted.
 */
export async function recordCrmForward(
  id: number,
  outcome: { ok: true; leadId: string } | { ok: false; error: string },
): Promise<void> {
  if (outcome.ok) {
    await query(
      `UPDATE support_requests
          SET crm_forwarded_at = now(), crm_lead_id = $2, crm_last_error = NULL,
              crm_attempts = crm_attempts + 1
        WHERE id = $1`,
      [id, outcome.leadId.slice(0, 120)],
    );
  } else {
    await query(
      `UPDATE support_requests
          SET crm_last_error = $2, crm_attempts = crm_attempts + 1
        WHERE id = $1`,
      [id, outcome.error.slice(0, 500)],
    );
  }
}
