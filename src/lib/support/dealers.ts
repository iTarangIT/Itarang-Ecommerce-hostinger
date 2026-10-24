import { query, queryOne, transaction } from '@/lib/db/pool';
import type { ExistingDealer } from './dealer-import';

/**
 * Dealers and service centres. Server-only.
 *
 * Search is by pincode or city. A pincode finds dealers in that pincode first,
 * then the same postal district (the first three digits), so a customer in a
 * pincode with no dealer of its own still sees the nearest ones on file rather
 * than nothing. No distance is computed or claimed — the list is ordered by
 * how closely the postal code matches.
 */

export interface Dealer {
  id: number;
  name: string;
  kind: 'dealer' | 'service-centre';
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string | null;
  whatsapp: string | null;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
}

interface Row {
  id: number;
  name: string;
  kind: Dealer['kind'];
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string | null;
  whatsapp: string | null;
  latitude: string | null;
  longitude: string | null;
  active: boolean;
}

function toDealer(row: Row): Dealer {
  return {
    ...row,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
  };
}

const COLUMNS = 'id, name, kind, address, city, state, pincode, phone, whatsapp, latitude, longitude, active';

/** Fails soft to an empty list, so the page renders before migration 0021. */
export async function searchDealers(term: string, limit = 30): Promise<Dealer[]> {
  const q = term.trim();
  if (!q) return [];
  const isPin = /^\d{6}$/.test(q);

  const rows = await query<Row>(
    isPin
      ? `SELECT ${COLUMNS} FROM dealers
          WHERE active AND (pincode = $1 OR left(pincode, 3) = left($1, 3))
          ORDER BY (pincode = $1) DESC, abs(pincode::int - $1::int), name
          LIMIT $2`
      : `SELECT ${COLUMNS} FROM dealers
          WHERE active AND (lower(city) LIKE lower($1) || '%' OR lower(state) = lower($1))
          ORDER BY lower(city) = lower($1) DESC, name
          LIMIT $2`,
    [q, limit],
  ).catch((error: unknown) => {
    console.warn('[dealers] search failed:', (error as Error).message);
    return [] as Row[];
  });
  return rows.map(toDealer);
}

export async function dealerCount(): Promise<number> {
  const row = await queryOne<{ count: number }>(
    `SELECT count(*)::int AS count FROM dealers WHERE active`,
  ).catch(() => null);
  return row?.count ?? 0;
}

/* ------------------------------------------------------------------ admin */

export async function listAllDealers(): Promise<Dealer[]> {
  const rows = await query<Row>(`SELECT ${COLUMNS} FROM dealers ORDER BY state, city, name LIMIT 1000`);
  return rows.map(toDealer);
}

export interface DealerInput {
  name: string;
  kind: Dealer['kind'];
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string | null;
  whatsapp: string | null;
  latitude: number | null;
  longitude: number | null;
}

export async function createDealer(input: DealerInput, actor: string): Promise<void> {
  await query(
    `INSERT INTO dealers (name, kind, address, city, state, pincode, phone, whatsapp, latitude, longitude, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      input.name,
      input.kind,
      input.address,
      input.city,
      input.state,
      input.pincode,
      input.phone,
      input.whatsapp,
      input.latitude,
      input.longitude,
      actor,
    ],
  );
}

/** Every dealer, hidden ones included, as the bulk upload matches against. */
export async function listDealerKeys(): Promise<ExistingDealer[]> {
  const rows = await query<ExistingDealer>(`SELECT id, name, pincode, phone, whatsapp FROM dealers`);
  return rows.map((row) => ({ ...row, id: Number(row.id) }));
}

/**
 * Many dealers in one transaction: an upload is added whole or not at all, so a
 * failure part-way never leaves half a sheet on the locator.
 */
export async function createDealers(inputs: DealerInput[], actor: string): Promise<number> {
  if (inputs.length === 0) return 0;
  await transaction(async (client) => {
    for (let start = 0; start < inputs.length; start += 200) {
      const chunk = inputs.slice(start, start + 200);
      const params: unknown[] = [];
      const values = chunk.map((input) => {
        const at = params.length;
        params.push(
          input.name,
          input.kind,
          input.address,
          input.city,
          input.state,
          input.pincode,
          input.phone,
          input.whatsapp,
          input.latitude,
          input.longitude,
          actor,
        );
        return `(${Array.from({ length: 11 }, (_, i) => `$${at + i + 1}`).join(', ')})`;
      });
      await client.query(
        `INSERT INTO dealers (name, kind, address, city, state, pincode, phone, whatsapp, latitude, longitude, updated_by)
         VALUES ${values.join(', ')}`,
        params,
      );
    }
  });
  return inputs.length;
}

export async function setDealerActive(id: number, active: boolean, actor: string): Promise<void> {
  await query(
    `UPDATE dealers SET active = $2, updated_at = now(), updated_by = $3 WHERE id = $1`,
    [id, active, actor],
  );
}

/**
 * A phone number as digits for tel:/wa.me links, with India's code. Admins type
 * numbers as "98765 43210", "098765 43210" or "+91 98765 43210"; the last ten
 * digits are the subscriber number in every case.
 */
export function dialable(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? `91${digits.slice(-10)}` : digits;
}
