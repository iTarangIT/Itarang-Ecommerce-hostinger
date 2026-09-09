import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { CataloguePriceRow } from '@/lib/products/types';
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

/**
 * The template, which is a working copy of the live price list rather than a
 * blank form. Every assertion here is about the round trip: what comes out
 * carries current prices, what goes back in is read by the production parser,
 * and a sheet nobody edited asks for nothing.
 */
describe('the price-list template', () => {
  /**
   * Empty variant titles, because that is what the catalogue holds.
   *
   * Every product is single-variant today and stores `''` for the variant
   * title. The fixture said `'12V 100Ah'` and so exercised a shape the console
   * never generates — which is how a blank Variant column reached a real
   * administrator's spreadsheet with the tests green.
   */
  const CATALOGUE: CataloguePriceRow[] = [
    {
      sku: 'TK12100-01',
      productTitle: 'Powercube 1.4',
      variantTitle: '',
      mrp: 4800000,
      selling: 4200000,
    },
    {
      sku: 'TK-LiFe-5145-01',
      productTitle: 'LiFe 5145',
      variantTitle: '',
      mrp: 3500000,
      selling: 3200000,
    },
  ];

  /**
   * Column positions in the generated sheet, 1-based as ExcelJS counts them.
   *
   * Four columns, not five: the Variant column is only emitted when some
   * variant actually has a title, and none in this fixture does — nor does any
   * product in the catalogue today.
   */
  const MRP_CELL = 3;
  const SELLING_CELL = 4;

  async function openTemplate(rows: CataloguePriceRow[]) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await buildPricingTemplate(rows)) as unknown as ArrayBuffer);
    return workbook;
  }

  it('round-trips through the reader it is a template for', async () => {
    // The strongest check available: generate the sheet, edit one price the way
    // an administrator would, and read it back with the production parser.
    const workbook = await openTemplate(CATALOGUE);
    const sheet = workbook.worksheets[0];
    sheet.getRow(2).getCell(MRP_CELL).value = 45000;
    sheet.getRow(2).getCell(SELLING_CELL).value = 39999;

    const rows = await readPricingWorkbook((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
    const report = buildPricingImportReport(rows, CATALOGUE);

    expect(report.rejected).toEqual([]);
    expect(report.applicable).toBe(true);
    // Only the edited row is a write. The second row came back exactly as it
    // was generated, which is the whole point of pre-filling the sheet.
    expect(report.accepted).toEqual([
      {
        rowNumber: 2,
        sku: 'TK12100-01',
        mrp: 4500000,
        selling: 3999900,
        previousMrp: 4800000,
        previousSelling: 4200000,
      },
    ]);
    expect(report.unchanged.map((r) => r.sku)).toEqual(['TK-LiFe-5145-01']);
  });

  it('asks for nothing when it is uploaded exactly as downloaded', async () => {
    // The accident the blank-cell design was guarding against, tested directly:
    // an untouched round trip must write nothing rather than re-apply every
    // price it was carrying.
    const workbook = await openTemplate(CATALOGUE);
    const rows = await readPricingWorkbook((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
    const report = buildPricingImportReport(rows, CATALOGUE);

    expect(report.rejected).toEqual([]);
    expect(report.accepted).toEqual([]);
    expect(report.applicable).toBe(false);
    expect(report.unchanged).toHaveLength(2);
  });

  it('lists every SKU with the price it currently carries, in rupees', async () => {
    const sheet = (await openTemplate(CATALOGUE)).worksheets[0];

    expect(sheet.getRow(2).getCell(1).value).toBe('TK12100-01');
    expect(sheet.getRow(2).getCell(2).value).toBe('Powercube 1.4');
    expect(sheet.getRow(2).getCell(MRP_CELL).value).toBe(48000);
    expect(sheet.getRow(2).getCell(SELLING_CELL).value).toBe(42000);
  });

  it('leaves an unpriced variant blank rather than writing zero', async () => {
    // Nullable on purpose, so a draft can exist before its commercial terms do.
    // A zero in this cell would read as an offer to give the product away.
    const sheet = (
      await openTemplate([
        { sku: 'DRAFT-1', productTitle: 'Unpriced', variantTitle: '', mrp: null, selling: null },
      ])
    ).worksheets[0];

    expect(sheet.getRow(2).getCell(MRP_CELL).value ?? '').toBe('');
    expect(sheet.getRow(2).getCell(SELLING_CELL).value ?? '').toBe('');
  });

  /**
   * The whole failure, reproduced through real .xlsx bytes.
   *
   * The unit tests prove the classification rule; this proves the file the
   * console actually generates survives being handed straight back to it. One
   * unpriced variant used to make the entire upload a no-op.
   */
  it('round-trips a catalogue containing an unpriced variant', async () => {
    const withDraft: CataloguePriceRow[] = [
      ...CATALOGUE,
      { sku: 'DRAFT-1', productTitle: 'Unpriced', variantTitle: '', mrp: null, selling: null },
    ];

    const workbook = await openTemplate(withDraft);
    const sheet = workbook.worksheets[0];
    // Edit one real price, exactly as an administrator would.
    sheet.getRow(2).getCell(MRP_CELL).value = 45000;
    sheet.getRow(2).getCell(SELLING_CELL).value = 39999;

    const rows = await readPricingWorkbook((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
    const report = buildPricingImportReport(rows, withDraft);

    expect(report.rejected).toEqual([]);
    expect(report.applicable, 'the edit must be applicable despite the unpriced row').toBe(true);
    expect(report.accepted.map((r) => r.sku)).toEqual(['TK12100-01']);
    expect(report.blank.map((r) => r.sku)).toEqual(['DRAFT-1']);
  });

  it('omits the Variant column when no variant has a title', async () => {
    // Every product in the catalogue is single-variant today, so the column was
    // blank on every row of a sheet whose purpose is to be typed into.
    const sheet = (await openTemplate(CATALOGUE)).worksheets[0];
    const header = (sheet.getRow(1).values as unknown[]).slice(1);

    expect(header).toEqual(['SKU', 'Product', 'MRP', 'Selling Price']);
  });

  it('includes the Variant column once a variant has a title to show', async () => {
    // It earns its place when there are two variants to tell apart.
    const sheet = (
      await openTemplate([
        { ...CATALOGUE[0]!, variantTitle: '12V 100Ah' },
        { ...CATALOGUE[1]!, variantTitle: '12V 150Ah' },
      ])
    ).worksheets[0];
    const header = (sheet.getRow(1).values as unknown[]).slice(1);

    expect(header).toEqual(['SKU', 'Product', 'Variant', 'MRP', 'Selling Price']);
    expect(sheet.getRow(2).getCell(3).value).toBe('12V 100Ah');
  });

  it('still produces a usable sheet when the catalogue is empty', async () => {
    const workbook = await openTemplate([]);
    expect(workbook.worksheets[0].getRow(2).getCell(1).value).toBe('YOUR-SKU-HERE');
  });

  it('ships an instructions sheet', async () => {
    const workbook = await openTemplate([]);
    expect(workbook.worksheets.map((s) => s.name)).toContain('How to use');
  });
});
