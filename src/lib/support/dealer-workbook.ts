import ExcelJS from 'exceljs';
import { DEALER_TEMPLATE_COLUMNS, DealerSheetError, parseDealerCsv, type SheetRow } from './dealer-import';

/**
 * Reading the bulk dealer upload and writing its template. Bytes in, `SheetRow`s
 * out; every decision about a row lives in `dealer-import.ts`.
 */

export const MAX_DEALER_FILE_BYTES = 5 * 1024 * 1024;

/**
 * A cell as text. Unlike the price sheet, numbers are not rounded: a latitude
 * needs its six decimals, and a phone number typed as a number is an integer.
 */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('').trim();
    }
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
    if ('text' in value) return String(value.text).trim();
  }
  return String(value).trim();
}

/** An uploaded .xlsx or .csv as rows, with Excel's own row numbers. */
export async function readDealerFile(bytes: ArrayBuffer, fileName: string): Promise<SheetRow[]> {
  if (/\.csv$/i.test(fileName)) return parseDealerCsv(new TextDecoder().decode(bytes));

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes);
  } catch {
    throw new DealerSheetError('That file could not be read. Upload an Excel workbook (.xlsx) or a CSV file.');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new DealerSheetError('The workbook has no sheets.');

  const rows: SheetRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as ExcelJS.CellValue[];
    // ExcelJS row values are 1-indexed with a leading hole; drop it.
    rows.push({ number: row.number, cells: values.slice(1).map(cellText) });
  });
  return rows;
}

/** The downloadable template: the columns, one example row and the rules. */
export async function buildDealerTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'iTarang';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Dealers');
  const widths = [30, 16, 44, 18, 18, 10, 16, 16, 12, 12];
  sheet.columns = DEALER_TEMPLATE_COLUMNS.map((header, index) => ({ header, width: widths[index] }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  // Text columns, so Excel keeps a pincode's or phone's digits exactly as typed.
  for (const column of [6, 7, 8]) sheet.getColumn(column).numFmt = '@';

  sheet.addRow([
    'Sharma Battery House',
    'Dealer',
    'Shop 4, MG Road, Sector 14',
    'Gurugram',
    'Haryana',
    '122001',
    '9876543210',
    '',
    '',
    '',
  ]);

  const notes = workbook.addWorksheet('How to use');
  notes.columns = [{ width: 100 }];
  for (const line of [
    'Bulk dealer upload',
    '',
    'One dealer or service centre per row on the Dealers sheet. Replace the example row with your own.',
    'Required: Name, Address, City, State, Pincode.',
    'Type: "Dealer" or "Service centre" (blank means Dealer).',
    'State: the full name, e.g. Maharashtra, Tamil Nadu, Delhi.',
    'Pincode: 6 digits. Phone and WhatsApp: 10-digit mobile, or a landline with its STD code.',
    'Latitude and Longitude are optional; add both for exact map directions.',
    '',
    'Duplicates are skipped, never overwritten. A row is a duplicate when:',
    '  - its phone or WhatsApp number matches a dealer already on file, or a row above it, or',
    '  - it has the same name at the same pincode (case and punctuation ignored).',
    'Hidden dealers count, so re-uploading a sheet does not bring back a dealer you hid.',
    '',
    'After uploading, the page lists every row that was added, skipped or rejected, with its row number.',
  ]) {
    notes.addRow([line]);
  }
  notes.getRow(1).font = { bold: true, size: 13 };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
