import { describe, expect, it } from 'vitest';
import {
  buildPricingImportReport,
  mapHeader,
  type CatalogueSkuPrice,
  type RawPriceRow,
} from './bulk-pricing';

/**
 * The bulk price import's decision rules.
 *
 * Every case here is one an administrator can produce with a real spreadsheet:
 * a currency-formatted cell, a SKU that has been lower-cased by a CSV round
 * trip, a row pasted twice. The point of the module being pure is that all of
 * them can be checked without a database.
 *
 * The catalogue below carries *prices*, not just SKUs, because the report's
 * central question is no longer "is this row valid" but "does this row say
 * anything new". The template ships pre-filled with current prices, so a real
 * upload is mostly rows that agree with what is already stored.
 *
 * `TK-LiFe-7332-01` is deliberately unpriced. The column is nullable so a draft
 * can exist before its commercial terms do, and giving such a variant a price
 * is a change — with nothing to show as the previous value.
 */

const CATALOGUE: CatalogueSkuPrice[] = [
  { sku: 'TK12100-01', mrp: 4800000, selling: 4200000 },
  { sku: 'TK-LiFe-5145-01', mrp: 3500000, selling: 3200000 },
  { sku: 'TK-LiFe-7332-01', mrp: null, selling: null },
];

function row(rowNumber: number, sku: string, mrp: string, selling: string): RawPriceRow {
  return { rowNumber, sku, mrp, selling };
}

describe('rows that are applied', () => {
  it('accepts a straightforward row and converts rupees to paise', () => {
    const report = buildPricingImportReport([row(2, 'TK12100-01', '45000', '39999')], CATALOGUE);
    expect(report.rejected).toEqual([]);
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
    expect(report.applicable).toBe(true);
  });

  it('accepts paise in the sheet', () => {
    const report = buildPricingImportReport(
      [row(2, 'TK12100-01', '45000.50', '45000.50')],
      CATALOGUE,
    );
    expect(report.accepted[0].mrp).toBe(4500050);
  });

  it('accepts a currency-formatted cell', () => {
    // What a sheet exported from accounting software actually contains.
    const report = buildPricingImportReport([row(2, 'TK12100-01', '₹ 45,000', '39,999')], CATALOGUE);
    expect(report.rejected).toEqual([]);
    expect(report.accepted[0]).toMatchObject({ mrp: 4500000, selling: 3999900 });
  });

  it('accepts a selling price equal to the MRP', () => {
    const report = buildPricingImportReport([row(2, 'TK12100-01', '45000', '45000')], CATALOGUE);
    expect(report.rejected).toEqual([]);
  });

  it('accepts zero, which is how a price is withdrawn', () => {
    const report = buildPricingImportReport([row(2, 'TK12100-01', '0', '0')], CATALOGUE);
    expect(report.accepted[0]).toMatchObject({ mrp: 0, selling: 0 });
  });

  it('matches a SKU whatever case and padding the file uses', () => {
    const report = buildPricingImportReport([row(2, '  tk12100-01 ', '45000', '39999')], CATALOGUE);
    expect(report.rejected).toEqual([]);
    // Written back with the catalogue's spelling, so the UPDATE cannot miss.
    expect(report.accepted[0].sku).toBe('TK12100-01');
  });

  it('reports how many catalogue SKUs the file left alone', () => {
    const report = buildPricingImportReport([row(2, 'TK12100-01', '45000', '39999')], CATALOGUE);
    expect(report.untouchedSkuCount).toBe(2);
  });

  it('prices a variant that had none, with no previous figure to show', () => {
    const report = buildPricingImportReport(
      [row(2, 'TK-LiFe-7332-01', '52000', '48000')],
      CATALOGUE,
    );
    expect(report.accepted[0]).toMatchObject({
      mrp: 5200000,
      selling: 4800000,
      previousMrp: null,
      previousSelling: null,
    });
  });
});

/**
 * The half of the feature that makes the round trip safe.
 *
 * The downloaded template carries every current price, so an administrator
 * changing two products uploads a file that restates the other forty. Writing
 * those forty would stamp `updated_by` and `updated_at` on products nobody
 * touched, which is a false audit trail, and would push forty pointless rows
 * through the catalogue invalidation.
 */
describe('rows that say nothing new', () => {
  it('classifies a row matching the catalogue as unchanged, not accepted', () => {
    const report = buildPricingImportReport([row(2, 'TK12100-01', '48000', '42000')], CATALOGUE);
    expect(report.rejected).toEqual([]);
    expect(report.accepted).toEqual([]);
    expect(report.unchanged).toEqual([
      { rowNumber: 2, sku: 'TK12100-01', mrp: 4800000, selling: 4200000 },
    ]);
  });

  it('compares in paise, so formatting the same figure differently is still unchanged', () => {
    // The three ways one price reaches us from a spreadsheet.
    for (const [mrp, selling] of [
      ['48000', '42000'],
      ['₹48,000', '₹42,000'],
      ['48000.00', '42000.00'],
    ]) {
      const report = buildPricingImportReport([row(2, 'TK12100-01', mrp!, selling!)], CATALOGUE);
      expect(report.accepted).toEqual([]);
      expect(report.unchanged).toHaveLength(1);
    }
  });

  it('treats a half-change as a change', () => {
    // Only the selling price moved. The row is still a write.
    const report = buildPricingImportReport([row(2, 'TK12100-01', '48000', '39999')], CATALOGUE);
    expect(report.accepted).toHaveLength(1);
    expect(report.unchanged).toEqual([]);
  });

  it('does not count an unchanged row as a SKU the file failed to mention', () => {
    // Both halves describe "left alone", and a row must land in exactly one of
    // them or the report double-counts the catalogue.
    const report = buildPricingImportReport(
      [row(2, 'TK12100-01', '48000', '42000'), row(3, 'TK-LiFe-5145-01', '30000', '28000')],
      CATALOGUE,
    );
    expect(report.unchanged).toHaveLength(1);
    expect(report.accepted).toHaveLength(1);
    expect(report.untouchedSkuCount).toBe(1);
  });

  it('is not applicable when every row is unchanged, and reports no rejections', () => {
    // An administrator who downloads the template and uploads it untouched has
    // not made a mistake. Nothing is written and nothing is wrong.
    const report = buildPricingImportReport(
      [row(2, 'TK12100-01', '48000', '42000'), row(3, 'TK-LiFe-5145-01', '35000', '32000')],
      CATALOGUE,
    );
    expect(report.applicable).toBe(false);
    expect(report.rejected).toEqual([]);
    expect(report.unchanged).toHaveLength(2);
  });

  it('still rejects an invalid row that happens to sit beside unchanged ones', () => {
    const report = buildPricingImportReport(
      [row(2, 'TK12100-01', '48000', '42000'), row(3, 'TK-LiFe-5145-01', '30000', '31000')],
      CATALOGUE,
    );
    expect(report.rejected.map((r) => r.problem)).toEqual(['selling-above-mrp']);
    expect(report.applicable).toBe(false);
  });
});

/**
 * The bug that made every upload fail, and the rule that fixes it.
 *
 * The template used to arrive blank and said "leave a row blank to leave that
 * product unchanged" — a wholly empty line, SKU included, which the reader
 * dropped before classification. Pre-filling the sheet put a SKU on every row,
 * so a variant with no price in the catalogue came back as a present row with
 * two empty price cells. That was `missing-price`, and since the import is all
 * or nothing, one unpriced variant refused the whole file.
 *
 * `TK-LiFe-7332-01` is unpriced in the fixture for exactly this reason.
 */
describe('rows that state no price', () => {
  it('skips a row with both price cells empty instead of rejecting it', () => {
    const report = buildPricingImportReport([row(2, 'TK12100-01', '', '')], CATALOGUE);

    expect(report.rejected).toEqual([]);
    expect(report.accepted).toEqual([]);
    expect(report.blank).toEqual([{ rowNumber: 2, sku: 'TK12100-01' }]);
  });

  it('counts a skipped row as a SKU the file did not mention', () => {
    // It made no statement about that price, which is what "untouched" means.
    const report = buildPricingImportReport([row(2, 'TK12100-01', '', '')], CATALOGUE);
    expect(report.untouchedSkuCount).toBe(3);
  });

  it('lets the rest of the file through — the actual regression', () => {
    // A downloaded template with one unpriced variant in it, one price edited.
    // Before the fix this reported `applicable: false` and wrote nothing.
    const report = buildPricingImportReport(
      [
        row(2, 'TK12100-01', '45000', '39999'),
        row(3, 'TK-LiFe-5145-01', '35000', '32000'),
        row(4, 'TK-LiFe-7332-01', '', ''),
      ],
      CATALOGUE,
    );

    expect(report.rejected).toEqual([]);
    expect(report.applicable).toBe(true);
    expect(report.accepted.map((r) => r.sku)).toEqual(['TK12100-01']);
    expect(report.unchanged.map((r) => r.sku)).toEqual(['TK-LiFe-5145-01']);
    expect(report.blank.map((r) => r.sku)).toEqual(['TK-LiFe-7332-01']);
  });

  it('still refuses a file whose only rows state no price', () => {
    // Nothing to write is not something to write. Not an error either.
    const report = buildPricingImportReport([row(2, 'TK12100-01', '', '')], CATALOGUE);
    expect(report.applicable).toBe(false);
    expect(report.rejected).toEqual([]);
  });

  it('accepts a price for a variant that had none, from a blank template cell', () => {
    // The other half: an unpriced variant is priced by typing into those cells.
    const report = buildPricingImportReport(
      [row(2, 'TK-LiFe-7332-01', '52000', '48000')],
      CATALOGUE,
    );
    expect(report.blank).toEqual([]);
    expect(report.accepted[0]).toMatchObject({ sku: 'TK-LiFe-7332-01', previousMrp: null });
  });
});

describe('rows that are rejected', () => {
  const reject = (r: RawPriceRow) => buildPricingImportReport([r], CATALOGUE).rejected[0];

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

  it('does not reject a row with neither price', () => {
    // The regression. See the "rows that state no price" block below.
    expect(buildPricingImportReport([row(2, 'TK12100-01', '', '')], CATALOGUE).rejected).toEqual(
      [],
    );
  });

  it('rejects a selling price above the MRP', () => {
    expect(reject(row(2, 'TK12100-01', '39999', '45000')).problem).toBe('selling-above-mrp');
  });

  it('rejects both copies of a repeated SKU, not just the second', () => {
    // The file states two different prices for one product; neither can be
    // assumed to be the intended one, so neither is applied.
    const report = buildPricingImportReport(
      [row(2, 'TK12100-01', '45000', '39999'), row(3, 'tk12100-01', '46000', '41000')],
      CATALOGUE,
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
      CATALOGUE,
    );

    // The good rows are still reported as accepted, so the administrator can
    // see the file was 2/3 right — but nothing is written.
    expect(report.accepted).toHaveLength(2);
    expect(report.rejected).toHaveLength(1);
    expect(report.applicable).toBe(false);
  });

  it('refuses an empty file rather than reporting a successful no-op', () => {
    const report = buildPricingImportReport([], CATALOGUE);
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

  it('reads the template this console generates', () => {
    // The generated sheet carries a Product column for legibility, ignored on
    // the way back in. This is the assertion that says so.
    expect(mapHeader(['SKU', 'Product', 'MRP', 'Selling Price'])).toEqual({
      sku: 0,
      mrp: 2,
      selling: 3,
    });
  });

  it('reads it with the Variant column too, for a multi-variant catalogue', () => {
    // The column is conditional, so both shapes must import.
    expect(mapHeader(['SKU', 'Product', 'Variant', 'MRP', 'Selling Price'])).toEqual({
      sku: 0,
      mrp: 3,
      selling: 4,
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
