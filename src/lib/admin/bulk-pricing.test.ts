import { describe, expect, it } from 'vitest';
import {
  buildPricingImportReport,
  mapHeader,
  type RawPriceRow,
} from './bulk-pricing';

/**
 * The bulk price import's decision rules.
 *
 * Every case here is one an administrator can produce with a real spreadsheet:
 * a currency-formatted cell, a SKU that has been lower-cased by a CSV round
 * trip, a row pasted twice. The point of the module being pure is that all of
 * them can be checked without a database.
 */

const KNOWN = ['TK12100-01', 'TK-LiFe-5145-01', 'TK-LiFe-7332-01'];

function row(rowNumber: number, sku: string, mrp: string, selling: string): RawPriceRow {
  return { rowNumber, sku, mrp, selling };
}

describe('rows that are applied', () => {
  it('accepts a straightforward row and converts rupees to paise', () => {
    const report = buildPricingImportReport([row(2, 'TK12100-01', '45000', '39999')], KNOWN);
    expect(report.rejected).toEqual([]);
    expect(report.accepted).toEqual([
      { rowNumber: 2, sku: 'TK12100-01', mrp: 4500000, selling: 3999900 },
    ]);
    expect(report.applicable).toBe(true);
  });

  it('accepts paise in the sheet', () => {
    const report = buildPricingImportReport([row(2, 'TK12100-01', '45000.50', '45000.50')], KNOWN);
    expect(report.accepted[0].mrp).toBe(4500050);
  });

  it('accepts a currency-formatted cell', () => {
    // What a sheet exported from accounting software actually contains.
    const report = buildPricingImportReport([row(2, 'TK12100-01', '₹ 45,000', '39,999')], KNOWN);
    expect(report.rejected).toEqual([]);
    expect(report.accepted[0]).toMatchObject({ mrp: 4500000, selling: 3999900 });
  });

  it('accepts a selling price equal to the MRP', () => {
    const report = buildPricingImportReport([row(2, 'TK12100-01', '45000', '45000')], KNOWN);
    expect(report.rejected).toEqual([]);
  });

  it('accepts zero, which is how a price is withdrawn', () => {
    const report = buildPricingImportReport([row(2, 'TK12100-01', '0', '0')], KNOWN);
    expect(report.accepted[0]).toMatchObject({ mrp: 0, selling: 0 });
  });

  it('matches a SKU whatever case and padding the file uses', () => {
    const report = buildPricingImportReport([row(2, '  tk12100-01 ', '45000', '39999')], KNOWN);
    expect(report.rejected).toEqual([]);
    // Written back with the catalogue's spelling, so the UPDATE cannot miss.
    expect(report.accepted[0].sku).toBe('TK12100-01');
  });

  it('reports how many catalogue SKUs the file left alone', () => {
    const report = buildPricingImportReport([row(2, 'TK12100-01', '45000', '39999')], KNOWN);
    expect(report.untouchedSkuCount).toBe(2);
  });
});

describe('rows that are rejected', () => {
  const reject = (r: RawPriceRow) => buildPricingImportReport([r], KNOWN).rejected[0];

  it('rejects an empty SKU', () => {
    expect(reject(row(2, '   ', '45000', '39999')).problem).toBe('missing-sku');
  });

  it('rejects a SKU no product has', () => {
    expect(reject(row(2, 'NOT-A-SKU', '45000', '39999')).problem).toBe('unknown-sku');
  });

  it('rejects a price that is not a number', () => {
    expect(reject(row(2, 'TK12100-01', 'call us', '39999')).problem).toBe('invalid-price');
  });

  it('rejects a negative price', () => {
    expect(reject(row(2, 'TK12100-01', '-1', '0')).problem).toBe('invalid-price');
  });

  it('rejects a row with only one of the two prices', () => {
    expect(reject(row(2, 'TK12100-01', '45000', '')).problem).toBe('missing-price');
    expect(reject(row(2, 'TK12100-01', '', '39999')).problem).toBe('missing-price');
  });

  it('rejects a selling price above the MRP', () => {
    expect(reject(row(2, 'TK12100-01', '39999', '45000')).problem).toBe('selling-above-mrp');
  });

  it('rejects both copies of a repeated SKU, not just the second', () => {
    // The file states two different prices for one product; neither can be
    // assumed to be the intended one, so neither is applied.
    const report = buildPricingImportReport(
      [row(2, 'TK12100-01', '45000', '39999'), row(3, 'tk12100-01', '46000', '41000')],
      KNOWN,
    );
    expect(report.accepted).toEqual([]);
    expect(report.rejected.map((r) => r.rowNumber)).toEqual([2, 3]);
    expect(report.rejected.every((r) => r.problem === 'duplicate-sku')).toBe(true);
  });

  it('names the row number so the administrator can find it', () => {
    expect(reject(row(17, 'NOPE', '1', '1')).rowNumber).toBe(17);
  });
});

describe('all or nothing', () => {
  it('refuses to apply a file with any bad row', () => {
    const report = buildPricingImportReport(
      [
        row(2, 'TK12100-01', '45000', '39999'),
        row(3, 'NOT-A-SKU', '1000', '900'),
        row(4, 'TK-LiFe-5145-01', '30000', '28000'),
      ],
      KNOWN,
    );

    // The good rows are still reported as accepted, so the administrator can
    // see the file was 2/3 right — but nothing is written.
    expect(report.accepted).toHaveLength(2);
    expect(report.rejected).toHaveLength(1);
    expect(report.applicable).toBe(false);
  });

  it('refuses an empty file rather than reporting a successful no-op', () => {
    const report = buildPricingImportReport([], KNOWN);
    expect(report.applicable).toBe(false);
  });
});

describe('the header row', () => {
  it('finds the three columns the template ships with', () => {
    expect(mapHeader(['SKU', 'MRP', 'Selling Price'])).toEqual({ sku: 0, mrp: 1, selling: 2 });
  });

  it('ignores case and padding', () => {
    expect(mapHeader([' sku ', 'mrp', 'SELLING PRICE'])).toEqual({ sku: 0, mrp: 1, selling: 2 });
  });

  it('tolerates extra columns and a different order', () => {
    // Somebody adds a product name so the sheet is readable. It must still import.
    expect(mapHeader(['Product', 'Selling Price', 'SKU', 'MRP'])).toEqual({
      sku: 2,
      mrp: 3,
      selling: 1,
    });
  });

  it('accepts the common alternative names for the selling column', () => {
    expect(mapHeader(['SKU', 'MRP', 'Discounted Price'])?.selling).toBe(2);
    expect(mapHeader(['SKU', 'MRP', 'Sale Price'])?.selling).toBe(2);
  });

  it('returns null when a required column is missing', () => {
    expect(mapHeader(['SKU', 'MRP'])).toBeNull();
    expect(mapHeader(['Product', 'MRP', 'Selling Price'])).toBeNull();
  });
});
