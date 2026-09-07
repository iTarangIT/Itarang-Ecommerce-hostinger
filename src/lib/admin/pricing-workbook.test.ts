import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildPricingImportReport } from './bulk-pricing';
import { WorkbookError, buildPricingTemplate, readPricingWorkbook } from './pricing-workbook';

/**
 * The spreadsheet half of the bulk price import, against real .xlsx bytes.
 *
 * `bulk-pricing.test.ts` covers the decision rules on hand-built rows; this
 * covers what ExcelJS actually hands back, which is the part that surprises —
 * a currency-formatted cell is a string, a plain one is a number, a blank line
 * is skipped entirely, and a formula is an object.
 */

type Cell = string | number | null;

async function workbookOf(rows: Cell[][]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Prices');
  for (const row of rows) sheet.addRow(row);
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

const HEADER: Cell[] = ['SKU', 'MRP', 'Selling Price'];

describe('reading an uploaded workbook', () => {
  it('reads a straightforward sheet', async () => {
    const rows = await readPricingWorkbook(
      await workbookOf([HEADER, ['TK12100-01', 45000, 39999]]),
    );
    expect(rows).toEqual([{ rowNumber: 2, sku: 'TK12100-01', mrp: '45000', selling: '39999' }]);
  });

  it('reads numeric and currency-formatted cells alike', async () => {
    const rows = await readPricingWorkbook(
      await workbookOf([HEADER, ['A-1', 45000, '39999'], ['B-2', '₹ 30,000', 28000]]),
    );
    expect(rows.map((r) => [r.mrp, r.selling])).toEqual([
      ['45000', '39999'],
      ['₹ 30,000', '28000'],
    ]);
  });

  it('reports the row number Excel shows, not the position in the file', async () => {
    // The blank line at sheet row 4 is skipped by ExcelJS, so counting parsed
    // rows would call the last one "row 4" when the administrator sees row 5.
    const rows = await readPricingWorkbook(
      await workbookOf([HEADER, ['A-1', 1, 1], [], ['B-2', 2, 2]]),
    );
    expect(rows.map((r) => r.rowNumber)).toEqual([2, 4]);
  });

  it('keeps a row that has values but no SKU, so it can be reported', async () => {
    const rows = await readPricingWorkbook(await workbookOf([HEADER, ['', 45000, 39999]]));
    expect(rows).toHaveLength(1);
    expect(rows[0].sku).toBe('');
  });

  it('accepts a reordered header with an extra column', async () => {
    const rows = await readPricingWorkbook(
      await workbookOf([
        ['Product', 'Selling Price', 'SKU', 'MRP'],
        ['Powercube 1.4', 39999, 'TK12100-01', 45000],
      ]),
    );
    expect(rows[0]).toMatchObject({ sku: 'TK12100-01', mrp: '45000', selling: '39999' });
  });

  it('refuses a sheet whose header is missing a column', async () => {
    await expect(readPricingWorkbook(await workbookOf([['SKU', 'MRP']]))).rejects.toBeInstanceOf(
      WorkbookError,
    );
  });

  it('refuses a header with no rows under it', async () => {
    await expect(readPricingWorkbook(await workbookOf([HEADER]))).rejects.toThrow(/no rows/i);
  });

  it('refuses bytes that are not a workbook', async () => {
    const notAWorkbook = new TextEncoder().encode('sku,mrp,selling').buffer;
    await expect(readPricingWorkbook(notAWorkbook as ArrayBuffer)).rejects.toBeInstanceOf(
      WorkbookError,
    );
  });
});

describe('the sample template', () => {
  it('round-trips through the reader it is a template for', async () => {
    // The strongest check available: generate the sample, fill in two prices,
    // and read it back with the production parser.
    const template = await buildPricingTemplate(['TK12100-01', 'TK-LiFe-5145-01']);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(template as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    sheet.getRow(2).getCell(2).value = 45000;
    sheet.getRow(2).getCell(3).value = 39999;
    sheet.getRow(3).getCell(2).value = 30000;
    sheet.getRow(3).getCell(3).value = 28000;

    const rows = await readPricingWorkbook((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
    const report = buildPricingImportReport(rows, ['TK12100-01', 'TK-LiFe-5145-01']);

    expect(report.rejected).toEqual([]);
    expect(report.applicable).toBe(true);
    expect(report.accepted).toEqual([
      { rowNumber: 2, sku: 'TK12100-01', mrp: 4500000, selling: 3999900 },
      { rowNumber: 3, sku: 'TK-LiFe-5145-01', mrp: 3000000, selling: 2800000 },
    ]);
  });

  it('lists the catalogue SKUs with the price columns left blank', async () => {
    // Blank on purpose: a template pre-filled with today's prices is one
    // accidental upload away from silently re-applying stale ones.
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      (await buildPricingTemplate(['A-1', 'B-2'])) as unknown as ArrayBuffer,
    );
    const sheet = workbook.worksheets[0];

    expect(sheet.getRow(2).getCell(1).value).toBe('A-1');
    expect(sheet.getRow(3).getCell(1).value).toBe('B-2');
    expect(sheet.getRow(2).getCell(2).value ?? '').toBe('');
  });

  it('still produces a usable sheet when the catalogue is empty', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await buildPricingTemplate([])) as unknown as ArrayBuffer);
    expect(workbook.worksheets[0].getRow(2).getCell(1).value).toBe('YOUR-SKU-HERE');
  });

  it('ships an instructions sheet', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await buildPricingTemplate([])) as unknown as ArrayBuffer);
    expect(workbook.worksheets.map((s) => s.name)).toContain('How to use');
  });
});
