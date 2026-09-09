/**
 * Bulk MRP and selling-price updates, keyed on SKU.
 *
 * Pricing is edited one product at a time in the admin console, which is fine
 * for a correction and unusable for a price list. This module is the pure half
 * of the bulk path: workbook rows in, a classified report out. It reads no
 * database and performs no writes, so every rule below is unit-testable, and
 * the repository call that follows is a single transaction over rows this file
 * has already declared safe.
 *
 * **Scope is deliberately two columns.** `product_variants` also holds stock,
 * availability, option values and titles, and a spreadsheet import that touched
 * any of them would be a way to wipe them by omission — the person uploading a
 * price list is not making a statement about inventory. Only `mrp` and
 * `selling` are ever written.
 *
 * **All or nothing.** A partially applied price list is worse than a rejected
 * one: it leaves the catalogue in a state nobody has seen, mixing yesterday's
 * prices with today's, and the only way to find out which is which is to read
 * every row. So a file with any invalid row is reported and *not* applied.
 *
 * **Only changed rows are written.** The template ships pre-filled with the
 * catalogue's current prices, so a file that changes two products still arrives
 * carrying every other product's existing figures. Rewriting those with the
 * values they already hold would be a no-op in the data and a lie in the audit
 * trail — every product stamped `updated_by` and `updated_at` by an
 * administrator who changed two of them. So a row identical to the catalogue is
 * classified as unchanged, reported as such, and never reaches the UPDATE.
 */

import { z } from 'zod';

/** A row as it appears in the spreadsheet, before any validation. */
export interface RawPriceRow {
  /** 1-based row number in the sheet, including the header. Used in the report. */
  rowNumber: number;
  sku: string;
  mrp: string;
  selling: string;
}

export type RowProblem =
  | 'missing-sku'
  | 'unknown-sku'
  | 'duplicate-sku'
  | 'missing-price'
  | 'invalid-price'
  | 'selling-above-mrp';

/** The sentence an administrator reads beside a rejected row. */
export const ROW_PROBLEM_NOTE: Record<RowProblem, string> = {
  'missing-sku': 'No SKU in this row.',
  'unknown-sku': 'No product in the catalogue has this SKU.',
  'duplicate-sku': 'This SKU appears more than once in the file.',
  'missing-price': 'Both MRP and selling price are required.',
  'invalid-price': 'Prices must be a number of rupees, zero or more.',
  'selling-above-mrp': 'The selling price is higher than the MRP.',
};

export interface AcceptedRow {
  rowNumber: number;
  sku: string;
  /** Paise, like every money column in the schema. */
  mrp: number;
  selling: number;
  /**
   * What the catalogue held before this row, in paise, or null where the
   * variant had no price at all.
   *
   * Carried so the report can show the change rather than only the new figure.
   * "MRP ₹45,000" tells an administrator nothing about what they just did;
   * "₹48,000 → ₹45,000" is the thing they are checking.
   */
  previousMrp: number | null;
  previousSelling: number | null;
}

/**
 * A row that is valid and says nothing new.
 *
 * Carries the prices it agreed with so the report can show what was left alone
 * rather than only counting it.
 */
export interface UnchangedRow {
  rowNumber: number;
  sku: string;
  mrp: number;
  selling: number;
}

/**
 * What the catalogue currently holds for one SKU.
 *
 * Structurally the subset of `CataloguePriceRow` this module needs, declared
 * here rather than imported so `bulk-pricing.ts` keeps depending on nothing but
 * zod. The repository's richer row satisfies it by shape.
 *
 * Both prices are nullable because the column is: a draft variant may have no
 * price yet, and every such row is a change the moment the file gives it one.
 */
export interface CatalogueSkuPrice {
  sku: string;
  mrp: number | null;
  selling: number | null;
}

export interface RejectedRow {
  rowNumber: number;
  sku: string;
  problem: RowProblem;
}

export interface PricingImportReport {
  /** Valid rows that differ from the catalogue. These, and only these, are written. */
  accepted: AcceptedRow[];
  /** Valid rows that match the catalogue exactly. Not an error, and not written. */
  unchanged: UnchangedRow[];
  rejected: RejectedRow[];
  /** SKUs in the catalogue the file said nothing about. Not an error. */
  untouchedSkuCount: number;
  /** True when nothing is wrong and there is at least one row to write. */
  applicable: boolean;
}

/** The three columns the template ships with, in order. */
export const TEMPLATE_COLUMNS = ['SKU', 'MRP', 'Selling Price'] as const;

/**
 * Rupees as typed into a spreadsheet cell, in paise.
 *
 * Excel hands back numbers, strings, and — for a cell formatted as currency —
 * a string carrying a symbol, thousands separators, or both. Stripping those
 * before parsing is the difference between accepting a file exported from
 * anyone's accounting software and rejecting it for reasons the administrator
 * cannot see by looking at the sheet.
 *
 * Deliberately *not* tolerant of a bare minus sign or a parenthesised negative:
 * a negative price is never a typo worth guessing at.
 */
const priceSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[₹,\s]/g, ''))
  .transform((value) => (value === '' ? null : Math.round(Number(value) * 100)))
  .refine(
    (value) => value === null || (Number.isFinite(value) && value >= 0),
    ROW_PROBLEM_NOTE['invalid-price'],
  );

function parsePrice(raw: string): number | null | undefined {
  const result = priceSchema.safeParse(raw);
  // `undefined` distinguishes "this is not a price" from "this cell was blank".
  return result.success ? result.data : undefined;
}

/**
 * SKUs are compared case-insensitively and whitespace-trimmed.
 *
 * The column is case-sensitive in Postgres, and a spreadsheet round-trip
 * routinely changes neither the SKU nor the case a human sees but does change
 * what a byte comparison finds — a trailing space from a copy-paste, a lower-
 * cased column from a CSV tool. Matching leniently and then writing back the
 * *catalogue's* spelling means the file's formatting cannot rename anything.
 */
function normaliseSku(sku: string): string {
  return sku.trim().toLowerCase();
}

/**
 * Classify every row against the catalogue.
 *
 * `catalogue` is the exact set from `product_variants`, prices included; the
 * returned `AcceptedRow.sku` is always the catalogue's spelling, never the
 * file's, so the `UPDATE ... WHERE sku = $1` that follows cannot miss.
 *
 * The prices are what make "unchanged" answerable. Comparison is in paise on
 * both sides — the file's rupees were rounded to paise by `parsePrice`, the
 * catalogue's are stored in paise — so ₹45,000 typed as `45000`, `45,000` or
 * `₹45000.00` all compare equal to the value already stored, and none of them
 * produces a write.
 */
export function buildPricingImportReport(
  rows: RawPriceRow[],
  catalogue: readonly CatalogueSkuPrice[],
): PricingImportReport {
  const canonical = new Map(catalogue.map((entry) => [normaliseSku(entry.sku), entry]));

  // Counted across the whole file first, so that *both* copies of a repeated
  // SKU are reported rather than the second one silently overwriting the first.
  const occurrences = new Map<string, number>();
  for (const row of rows) {
    const key = normaliseSku(row.sku);
    if (key === '') continue;
    occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
  }

  const accepted: AcceptedRow[] = [];
  const unchanged: UnchangedRow[] = [];
  const rejected: RejectedRow[] = [];

  for (const row of rows) {
    const key = normaliseSku(row.sku);
    const reject = (problem: RowProblem) =>
      rejected.push({ rowNumber: row.rowNumber, sku: row.sku.trim(), problem });

    if (key === '') {
      reject('missing-sku');
      continue;
    }
    if ((occurrences.get(key) ?? 0) > 1) {
      reject('duplicate-sku');
      continue;
    }
    const current = canonical.get(key);
    if (!current) {
      reject('unknown-sku');
      continue;
    }
    const sku = current.sku;

    const mrp = parsePrice(row.mrp);
    const selling = parsePrice(row.selling);

    if (mrp === undefined || selling === undefined) {
      reject('invalid-price');
      continue;
    }
    // Both are required together. Writing one and leaving the other would put
    // the variant into a state the publish rules refuse — a price with no MRP
    // renders a nonsensical discount — and "I only meant to change the selling
    // price" is exactly the intent a two-column file cannot express.
    if (mrp === null || selling === null) {
      reject('missing-price');
      continue;
    }
    if (selling > mrp) {
      reject('selling-above-mrp');
      continue;
    }

    // The row is valid either way; the only question left is whether it says
    // anything the catalogue does not already know.
    if (current.mrp === mrp && current.selling === selling) {
      unchanged.push({ rowNumber: row.rowNumber, sku, mrp, selling });
      continue;
    }

    accepted.push({
      rowNumber: row.rowNumber,
      sku,
      mrp,
      selling,
      previousMrp: current.mrp,
      previousSelling: current.selling,
    });
  }

  // "Untouched" counts SKUs the file did not mention at all. A row that
  // repeated the current price *did* mention its SKU, so it belongs in
  // `unchanged` and must not be counted here as well — the two together plus
  // the accepted rows should account for the whole catalogue exactly once.
  const mentioned = new Set([...accepted, ...unchanged].map((row) => normaliseSku(row.sku)));

  return {
    accepted,
    unchanged,
    rejected,
    untouchedSkuCount: catalogue.filter((entry) => !mentioned.has(normaliseSku(entry.sku))).length,
    applicable: rejected.length === 0 && accepted.length > 0,
  };
}

/**
 * Map a sheet's header row onto the three columns we read.
 *
 * Matched by name rather than by position, and case-insensitively, so a file
 * with an extra column — a product name someone added to make the sheet
 * readable — still imports. Returns `null` when a required column is absent,
 * which is a whole-file error rather than a row one.
 */
export function mapHeader(header: readonly string[]): { sku: number; mrp: number; selling: number } | null {
  const index = (candidates: string[]) =>
    header.findIndex((cell) => candidates.includes(cell.trim().toLowerCase()));

  const sku = index(['sku']);
  const mrp = index(['mrp', 'mrp (₹)', 'mrp(₹)', 'list price']);
  const selling = index([
    'selling price',
    'selling',
    'selling price (₹)',
    'sale price',
    'discounted price',
  ]);

  if (sku === -1 || mrp === -1 || selling === -1) return null;
  return { sku, mrp, selling };
}
