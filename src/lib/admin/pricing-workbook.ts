import ExcelJS from 'exceljs';
import type { CataloguePriceRow } from '@/lib/products/types';
import { TEMPLATE_COLUMNS, mapHeader, type RawPriceRow } from './bulk-pricing';

/**
 * Reading and writing the bulk-pricing spreadsheet.
 *
 * Kept apart from `bulk-pricing.ts` so the decision rules stay free of the
 * library: everything that classifies a row is pure and unit-tested, and this
 * file does nothing but turn bytes into `RawPriceRow[]` and back.
 */

/**
 * Generous enough for any real price list, small enough that a mis-picked file
 * is rejected rather than parsed. The catalogue has single-digit variants
 * today; five megabytes is tens of thousands of rows.
 */
export const MAX_WORKBOOK_BYTES = 5 * 1024 * 1024;

export const WORKBOOK_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];

export class WorkbookError extends Error {}

/**
 * A cell as text.
 *
 * Excel gives back a number for `45000`, a string for `"45000"`, an object for
 * a formula and another for rich text. Flattening everything to a trimmed
 * string here means `bulk-pricing.ts` has one input type to reason about, and
 * `1.0000000000000002` — the sort of thing a spreadsheet division produces —
 * is rounded rather than rejected as unparseable.
 */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(Math.round(value * 100) / 100);
  if (typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();

  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('').trim();
    }
    // A formula cell carries its computed result; that is what a human sees.
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
    if ('text' in value) return String(value.text).trim();
  }
  return String(value).trim();
}

/** Parse an uploaded workbook into raw rows. Throws `WorkbookError` on a bad file. */
export async function readPricingWorkbook(bytes: ArrayBuffer): Promise<RawPriceRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes);
  } catch {
    throw new WorkbookError('That file could not be read as an Excel workbook (.xlsx).');
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new WorkbookError('The workbook has no sheets.');

  /**
   * The sheet's own row numbers are carried through, not re-derived.
   *
   * `eachRow({ includeEmpty: false })` skips blank lines, so a file with a gap
   * after row 3 yields four rows whose positions in an array are 0…3 while
   * their positions in Excel are 1, 2, 3, 5. Numbering from the array index
   * would print "row 4" beside a problem the administrator can only find on
   * row 5 — which is worse than no row number, because it looks right.
   */
  const rows: Array<{ number: number; cells: string[] }> = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as ExcelJS.CellValue[];
    // ExcelJS row values are 1-indexed with a leading hole; drop it.
    rows.push({ number: row.number, cells: values.slice(1).map(cellText) });
  });

  if (rows.length === 0) throw new WorkbookError('The sheet is empty.');

  const columns = mapHeader(rows[0]!.cells);
  if (!columns) {
    throw new WorkbookError(
      `The first row must name the columns ${TEMPLATE_COLUMNS.join(', ')}. Download the sample template for the expected format.`,
    );
  }

  const parsed: RawPriceRow[] = [];
  for (const { number, cells } of rows.slice(1)) {
    const sku = cells[columns.sku] ?? '';
    const mrp = cells[columns.mrp] ?? '';
    const selling = cells[columns.selling] ?? '';

    // A wholly blank line is spacing, not a mistake. A line with anything in it
    // is a row somebody meant, and is reported even if the SKU is missing.
    if (sku === '' && mrp === '' && selling === '') continue;

    parsed.push({ rowNumber: number, sku, mrp, selling });
  }

  if (parsed.length === 0) throw new WorkbookError('The sheet has a header but no rows.');
  return parsed;
}

/** Paise as a rupee figure a spreadsheet will treat as a number, or blank. */
function rupees(paise: number | null): number | '' {
  if (paise === null || !Number.isFinite(paise)) return '';
  return Math.round(paise) / 100;
}

/**
 * The downloadable working copy.
 *
 * **Pre-filled with the catalogue's current prices**, which is what makes this
 * a round trip rather than a form. The administrator downloads what is live,
 * edits the rows they mean to change, uploads the same file, and downloads it
 * again later to find their own edits in it — the ordinary way a price list is
 * maintained.
 *
 * The obvious objection to shipping today's prices — that an accidental upload
 * re-applies stale figures to the whole catalogue — is answered on the import
 * side rather than by leaving the cells blank: `buildPricingImportReport`
 * compares each row against the catalogue and writes only the rows that
 * actually differ. A re-uploaded untouched template therefore changes nothing
 * and stamps nothing, and the report says so in as many words.
 *
 * Product and variant titles ride along in two extra columns. `mapHeader`
 * matches columns by name, so extra ones are ignored on the way back in; they
 * exist purely so a human can tell which row is which without looking up a SKU.
 */
export async function buildPricingTemplate(
  variants: readonly CataloguePriceRow[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'iTarang';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Prices');
  sheet.columns = [
    { header: TEMPLATE_COLUMNS[0], key: 'sku', width: 28 },
    { header: 'Product', key: 'product', width: 42 },
    { header: 'Variant', key: 'variant', width: 22 },
    { header: TEMPLATE_COLUMNS[1], key: 'mrp', width: 16 },
    { header: TEMPLATE_COLUMNS[2], key: 'selling', width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const variant of variants) {
    const row = sheet.addRow({
      sku: variant.sku,
      product: variant.productTitle,
      variant: variant.variantTitle,
      mrp: rupees(variant.mrp),
      selling: rupees(variant.selling),
    });
    // Formatted as rupees so the sheet reads like money, and left as a real
    // number so an administrator can type over it without fighting a text cell.
    row.getCell('mrp').numFmt = '#,##0.00';
    row.getCell('selling').numFmt = '#,##0.00';
    // The two identifying columns are reference, not input. Greyed so it is
    // visually obvious which two columns this file is for.
    row.getCell('product').font = { color: { argb: 'FF6B7280' } };
    row.getCell('variant').font = { color: { argb: 'FF6B7280' } };
  }

  if (variants.length === 0) {
    sheet.addRow({ sku: 'YOUR-SKU-HERE', product: '', variant: '', mrp: '', selling: '' });
  }

  const notes = workbook.addWorksheet('How to use');
  notes.columns = [{ width: 100 }];
  for (const line of [
    'Bulk price update — MRP and selling price only.',
    '',
    'The Prices sheet already contains every SKU with the price it currently carries.',
    'Change the MRP and Selling Price cells you want to update, then upload the file at',
    'Admin → Products → Bulk pricing.',
    '',
    'SKU is the identifier. Only the product with that SKU is changed.',
    'Enter amounts in rupees. Both MRP and selling price are required on every row.',
    'The selling price cannot be higher than the MRP.',
    'A row you do not edit matches the catalogue and is left alone — nothing is rewritten.',
    'Do not list the same SKU twice.',
    'The Product and Variant columns are there to help you find the row. They are ignored.',
    '',
    'Nothing else about the product is changed — not stock, not availability, not the title.',
    'If any row is wrong, the whole file is rejected and nothing is updated.',
    '',
    'Download this template again after an upload and it will show your new prices.',
  ]) {
    notes.addRow([line]);
  }
  notes.getRow(1).font = { bold: true };

  // ExcelJS types this as its own Buffer interface; the bytes are the same.
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
