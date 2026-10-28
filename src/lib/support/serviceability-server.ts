import { query, queryOne } from '@/lib/db/pool';
import {
  DEFAULT_DELIVERY_DAYS,
  PINCODE_ERROR,
  isPincode,
  serviceabilityMessage,
  type ServiceabilityResult,
} from './serviceability';
import { lookupPincodePlace } from './pincode-directory';

/**
 * Pincode lookup against `serviceable_pincodes`. Server-only.
 *
 * Fails soft to "unconfirmed": a database that has not had migration 0021, or a
 * blip in the lookup, must not stop anyone checking out — it only means the
 * answer is the default one.
 */

interface Row {
  pincode: string;
  city: string;
  state: string;
  delivery_days: number;
  cod_available: boolean;
  active: boolean;
}

export async function lookupPincode(
  raw: string,
  options: { withPlace?: boolean } = {},
): Promise<ServiceabilityResult | { error: string }> {
  const pincode = raw.trim();
  if (!isPincode(pincode)) return { error: PINCODE_ERROR };

  const row = await queryOne<Row>(
    `SELECT pincode, city, state, delivery_days, cod_available, active
       FROM serviceable_pincodes WHERE pincode = $1`,
    [pincode],
  ).catch((error: unknown) => {
    console.warn('[serviceability] lookup failed:', (error as Error).message);
    return null;
  });

  // Not on our list: still name the place, from India Post's directory, so the
  // header and the checkout address can show and fill it (R-10, D-19).
  const place = row || options.withPlace === false ? null : await lookupPincodePlace(pincode);

  const base = row
    ? {
        serviceable: row.active,
        confirmed: true,
        pincode,
        city: row.city,
        state: row.state,
        deliveryDays: row.delivery_days,
        codAvailable: row.active && row.cod_available,
        installationDays: row.delivery_days + 1,
      }
    : {
        serviceable: true,
        confirmed: false,
        pincode,
        ...(place ? { city: place.city, ...(place.state ? { state: place.state } : {}) } : {}),
        deliveryDays: DEFAULT_DELIVERY_DAYS,
        codAvailable: false,
        installationDays: DEFAULT_DELIVERY_DAYS + 1,
      };

  return { ...base, message: serviceabilityMessage(base) };
}

/* ------------------------------------------------------------------ admin */

export interface CoverageRow {
  pincode: string;
  city: string;
  state: string;
  deliveryDays: number;
  codAvailable: boolean;
  active: boolean;
}

export async function coverageStats(): Promise<{ total: number; active: number }> {
  const row = await queryOne<{ total: number; active: number }>(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE active)::int AS active FROM serviceable_pincodes`,
  ).catch(() => null);
  return row ?? { total: 0, active: 0 };
}

export async function searchCoverage(term: string, limit = 50): Promise<CoverageRow[]> {
  const rows = await query<Row>(
    `SELECT pincode, city, state, delivery_days, cod_available, active
       FROM serviceable_pincodes
      WHERE $1 = '' OR pincode LIKE $1 || '%' OR lower(city) LIKE lower($1) || '%'
      ORDER BY pincode LIMIT $2`,
    [term.trim(), limit],
  );
  return rows.map((row) => ({
    pincode: row.pincode,
    city: row.city,
    state: row.state,
    deliveryDays: row.delivery_days,
    codAvailable: row.cod_available,
    active: row.active,
  }));
}

/**
 * Parse a coverage CSV: `pincode,city,state,delivery_days[,cod][,active]`.
 * A header row is skipped. Returns the rows it could read and the line
 * numbers it could not, so the admin is told exactly what was ignored.
 */
export function parseCoverageCsv(text: string): { rows: CoverageRow[]; rejected: number[] } {
  const rows: CoverageRow[] = [];
  const rejected: number[] = [];
  const yes = (value: string | undefined, fallback: boolean) =>
    value === undefined || value.trim() === '' ? fallback : /^(1|y|yes|true)$/i.test(value.trim());

  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const cells = line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
    if (index === 0 && !/^\d/.test(cells[0] ?? '')) return; // header
    const [pincode, city, state, days, cod, active] = cells;
    const deliveryDays = Number(days);
    if (
      !pincode ||
      !isPincode(pincode) ||
      !city ||
      !state ||
      !Number.isInteger(deliveryDays) ||
      deliveryDays < 1 ||
      deliveryDays > 30
    ) {
      rejected.push(index + 1);
      return;
    }
    rows.push({
      pincode,
      city,
      state,
      deliveryDays,
      codAvailable: yes(cod, false),
      active: yes(active, true),
    });
  });

  return { rows, rejected };
}

export async function upsertCoverage(rows: CoverageRow[], actor: string): Promise<number> {
  let written = 0;
  // In chunks, so a 20,000-row file is a few dozen statements, not 20,000.
  for (let start = 0; start < rows.length; start += 500) {
    const chunk = rows.slice(start, start + 500);
    const params: unknown[] = [];
    const values = chunk.map((row) => {
      params.push(row.pincode, row.city, row.state, row.deliveryDays, row.codAvailable, row.active, actor);
      const n = params.length;
      return `($${n - 6}, $${n - 5}, $${n - 4}, $${n - 3}, $${n - 2}, $${n - 1}, $${n})`;
    });
    await query(
      `INSERT INTO serviceable_pincodes (pincode, city, state, delivery_days, cod_available, active, updated_by)
       VALUES ${values.join(', ')}
       ON CONFLICT (pincode) DO UPDATE SET
         city = EXCLUDED.city, state = EXCLUDED.state, delivery_days = EXCLUDED.delivery_days,
         cod_available = EXCLUDED.cod_available, active = EXCLUDED.active,
         updated_by = EXCLUDED.updated_by, updated_at = now()`,
      params,
    );
    written += chunk.length;
  }
  return written;
}
