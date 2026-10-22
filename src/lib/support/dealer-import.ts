import { STATES } from '@/lib/checkout/validation';
import type { DealerInput } from './dealers';

/**
 * Bulk dealer upload: turning spreadsheet rows into dealers, and deciding which
 * rows are duplicates.
 *
 * Pure — no database, no spreadsheet library — so every rule here is unit
 * tested. `dealer-workbook.ts` turns the uploaded file into `SheetRow`s and the
 * admin action writes whatever `planDealerImport` accepts.
 *
 * **What counts as the same dealer.** Two rows are one dealer when either
 *   - their phone numbers match (the last ten digits, so "+91 98765 43210",
 *     "098765 43210" and "9876543210" are one number), or
 *   - they have the same name at the same pincode, ignoring case, spacing and
 *     punctuation ("Sharma Battery House" = "sharma  battery-house").
 * A row is checked against every dealer already on file — hidden ones too, so
 * re-uploading a sheet never brings back a dealer someone deliberately hid —
 * and against the rows above it in the same sheet. The first one wins; later
 * ones are reported, never written.
 */

export interface SheetRow {
  /** The row number as Excel shows it, for messages the admin can act on. */
  number: number;
  cells: string[];
}

/** The fields a dealer row is matched against. */
export interface ExistingDealer {
  id: number;
  name: string;
  pincode: string;
  phone: string | null;
  whatsapp: string | null;
}

export type RowOutcome =
  | { kind: 'add'; row: number; dealer: DealerInput }
  | { kind: 'duplicate-in-sheet'; row: number; name: string; firstRow: number }
  | { kind: 'already-on-file'; row: number; name: string; existing: string }
  | { kind: 'invalid'; row: number; reason: string };

export interface ImportPlan {
  outcomes: RowOutcome[];
  toAdd: DealerInput[];
}

export class DealerSheetError extends Error {}

/** Enough for every dealer network we would plausibly upload in one go. */
export const MAX_DEALER_ROWS = 5000;

type Column =
  | 'name'
  | 'kind'
  | 'address'
  | 'city'
  | 'state'
  | 'pincode'
  | 'phone'
  | 'whatsapp'
  | 'latitude'
  | 'longitude';

/** The template's own headers, in order. */
export const DEALER_TEMPLATE_COLUMNS = [
  'Name',
  'Type',
  'Address',
  'City',
  'State',
  'Pincode',
  'Phone',
  'WhatsApp',
  'Latitude',
  'Longitude',
] as const;

const REQUIRED: Column[] = ['name', 'address', 'city', 'state', 'pincode'];

/** Header spellings people actually use, compared after `headerKey`. */
const ALIASES: Record<Column, string[]> = {
  name: ['name', 'dealername', 'shopname', 'businessname', 'firmname', 'dealer'],
  kind: ['type', 'kind', 'dealertype', 'category'],
  address: ['address', 'shopaddress', 'fulladdress', 'street', 'addressline'],
  city: ['city', 'town', 'citytown'],
  state: ['state', 'statename'],
  pincode: ['pincode', 'pin', 'pincodes', 'postalcode', 'postcode', 'zip', 'zipcode'],
  phone: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'mobileno', 'phoneno', 'contact', 'contactnumber'],
  whatsapp: ['whatsapp', 'whatsappnumber', 'whatsappno'],
  latitude: ['latitude', 'lat'],
  longitude: ['longitude', 'long', 'lng', 'lon'],
};

function headerKey(cell: string): string {
  return cell.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Which cell holds which field, read from the header row. Columns are found by
 * name, so they can come in any order and extra columns are ignored.
 */
export function mapDealerHeader(cells: string[]): Partial<Record<Column, number>> | null {
  const map: Partial<Record<Column, number>> = {};
  cells.forEach((cell, index) => {
    const key = headerKey(cell);
    for (const column of Object.keys(ALIASES) as Column[]) {
      if (map[column] === undefined && ALIASES[column].includes(key)) {
        map[column] = index;
        break;
      }
    }
  });
  return REQUIRED.every((column) => map[column] !== undefined) ? map : null;
}

/* ------------------------------------------------------------ normalising */

function clean(value: string | undefined, max: number): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Last ten digits — the subscriber number however the prefix was typed. */
export function phoneKey(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
}

export function nameKey(name: string, pincode: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}|${pincode}`;
}

/**
 * A phone as stored: a mobile number as its ten digits, anything else (a
 * landline with its STD code) as typed. `null` when blank.
 */
function normalisePhone(value: string): { phone: string | null; error?: string } {
  const typed = clean(value, 20);
  if (!typed) return { phone: null };
  const digits = typed.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) return { phone: null, error: `phone "${typed}" is not a full number` };
  const last = digits.slice(-10);
  return { phone: /^[6-9]\d{9}$/.test(last) ? last : typed };
}

const STATE_BY_KEY = new Map(
  STATES.map((state) => [state.name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, ''), state.name]),
);

function normaliseState(value: string): string | null {
  return STATE_BY_KEY.get(value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '')) ?? null;
}

function coordinate(value: string, limit: number): number | null | 'bad' {
  const typed = value.trim();
  if (!typed) return null;
  const n = Number(typed);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : 'bad';
}

/** One row as a dealer, or why it cannot be one. */
export function parseDealerRow(
  cells: string[],
  columns: Partial<Record<Column, number>>,
): { dealer: DealerInput } | { error: string } {
  const cell = (column: Column) => (columns[column] === undefined ? '' : (cells[columns[column]!] ?? ''));

  const name = clean(cell('name'), 160);
  const address = clean(cell('address'), 400);
  const city = clean(cell('city'), 80);
  const stateTyped = clean(cell('state'), 80);
  // A pincode typed into Excel arrives as a number, sometimes "422304.0".
  const pincode = clean(cell('pincode'), 12).replace(/\.0+$/, '').replace(/\s/g, '');

  const missing = (
    [
      ['name', name],
      ['address', address],
      ['city', city],
      ['state', stateTyped],
      ['pincode', pincode],
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([label]) => label);
  if (missing.length) return { error: `missing ${missing.join(', ')}` };

  if (!/^[1-9]\d{5}$/.test(pincode)) return { error: `pincode "${pincode}" is not 6 digits` };
  const state = normaliseState(stateTyped);
  if (!state) return { error: `state "${stateTyped}" is not an Indian state or UT` };

  const phone = normalisePhone(cell('phone'));
  if (phone.error) return { error: phone.error };
  const whatsapp = normalisePhone(cell('whatsapp'));
  if (whatsapp.error) return { error: `WhatsApp ${whatsapp.error}` };

  const latitude = coordinate(cell('latitude'), 90);
  const longitude = coordinate(cell('longitude'), 180);
  if (latitude === 'bad' || longitude === 'bad') return { error: 'latitude/longitude is not a valid coordinate' };

  return {
    dealer: {
      name,
      kind: /service/i.test(cell('kind')) ? 'service-centre' : 'dealer',
      address,
      city,
      state,
      pincode,
      phone: phone.phone,
      whatsapp: whatsapp.phone,
      latitude,
      longitude,
    },
  };
}

/* --------------------------------------------------------------- planning */

/**
 * Decide, row by row, what an upload does. The header is the first row; blank
 * rows are spacing and are skipped silently.
 */
export function planDealerImport(rows: SheetRow[], existing: ExistingDealer[]): ImportPlan {
  if (rows.length === 0) throw new DealerSheetError('The sheet is empty.');
  const columns = mapDealerHeader(rows[0]!.cells);
  if (!columns) {
    throw new DealerSheetError(
      'The first row must name the columns Name, Address, City, State and Pincode. Download the template for the expected format.',
    );
  }

  const body = rows.slice(1).filter((row) => row.cells.some((cell) => cell.trim() !== ''));
  if (body.length === 0) throw new DealerSheetError('The sheet has a header but no dealers.');
  if (body.length > MAX_DEALER_ROWS) {
    throw new DealerSheetError(`The sheet has ${body.length} dealers; upload at most ${MAX_DEALER_ROWS} at a time.`);
  }

  // Who already owns each phone number and name+pincode.
  const filePhones = new Map<string, string>();
  const fileNames = new Map<string, string>();
  for (const dealer of existing) {
    for (const key of [phoneKey(dealer.phone), phoneKey(dealer.whatsapp)]) {
      if (key && !filePhones.has(key)) filePhones.set(key, dealer.name);
    }
    fileNames.set(nameKey(dealer.name, dealer.pincode), dealer.name);
  }
  const sheetPhones = new Map<string, number>();
  const sheetNames = new Map<string, number>();

  const outcomes: RowOutcome[] = [];
  const toAdd: DealerInput[] = [];

  for (const row of body) {
    const parsed = parseDealerRow(row.cells, columns);
    if ('error' in parsed) {
      outcomes.push({ kind: 'invalid', row: row.number, reason: parsed.error });
      continue;
    }
    const { dealer } = parsed;
    const phones = [phoneKey(dealer.phone), phoneKey(dealer.whatsapp)].filter((k): k is string => k !== null);
    const byName = nameKey(dealer.name, dealer.pincode);

    const existingMatch = phones.map((k) => filePhones.get(k)).find(Boolean) ?? fileNames.get(byName);
    if (existingMatch) {
      outcomes.push({ kind: 'already-on-file', row: row.number, name: dealer.name, existing: existingMatch });
      continue;
    }
    const sheetMatch = phones.map((k) => sheetPhones.get(k)).find((n) => n !== undefined) ?? sheetNames.get(byName);
    if (sheetMatch !== undefined) {
      outcomes.push({ kind: 'duplicate-in-sheet', row: row.number, name: dealer.name, firstRow: sheetMatch });
      continue;
    }

    for (const key of phones) sheetPhones.set(key, row.number);
    sheetNames.set(byName, row.number);
    outcomes.push({ kind: 'add', row: row.number, dealer });
    toAdd.push(dealer);
  }

  return { outcomes, toAdd };
}

/** The one-paragraph result an admin reads after uploading. */
export function summariseDealerImport(plan: ImportPlan, limit = 8): string {
  const of = (kind: RowOutcome['kind']) => plan.outcomes.filter((o) => o.kind === kind);
  const list = <T>(items: T[], line: (item: T) => string) =>
    items.slice(0, limit).map(line).join('; ') + (items.length > limit ? `; and ${items.length - limit} more` : '');
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const parts = [`${plural(plan.toAdd.length, 'dealer')} added.`];
  const onFile = of('already-on-file') as Extract<RowOutcome, { kind: 'already-on-file' }>[];
  if (onFile.length) {
    parts.push(
      `${plural(onFile.length, 'row')} skipped, already on file: ${list(onFile, (o) => `row ${o.row} (${o.existing})`)}.`,
    );
  }
  const repeats = of('duplicate-in-sheet') as Extract<RowOutcome, { kind: 'duplicate-in-sheet' }>[];
  if (repeats.length) {
    parts.push(
      `${plural(repeats.length, 'row')} skipped, repeated in the sheet: ${list(repeats, (o) => `row ${o.row} repeats row ${o.firstRow}`)}.`,
    );
  }
  const invalid = of('invalid') as Extract<RowOutcome, { kind: 'invalid' }>[];
  if (invalid.length) {
    parts.push(`${plural(invalid.length, 'row')} not imported: ${list(invalid, (o) => `row ${o.row} ${o.reason}`)}.`);
  }
  return parts.join(' ');
}

/* -------------------------------------------------------------------- CSV */

/**
 * CSV to rows. Quote-aware, because an address is exactly the field that has
 * commas in it ("Shop 4, MG Road").
 */
export function parseDealerCsv(text: string): SheetRow[] {
  const rows: SheetRow[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let rowStart = 1;
  const source = text.replace(/^﻿/, '');

  const endRow = () => {
    cells.push(cell.trim());
    if (cells.some((c) => c !== '')) rows.push({ number: rowStart, cells });
    cells = [];
    cell = '';
  };

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        if (ch === '\n') line++;
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      cells.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      endRow();
      line++;
      rowStart = line;
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || cells.length) endRow();
  return rows;
}
