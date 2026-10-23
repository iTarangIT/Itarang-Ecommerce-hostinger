import { describe, expect, it } from 'vitest';
import { TRONTEK_PRODUCTS } from '../../../db/seed/trontek-products.ts';
import { isValidSku, repeatedVariantField } from './sku-rules';

describe('SKU format', () => {
  it('accepts the shapes the catalogue uses', () => {
    for (const sku of ['TK-LiFe-5145-01', 'TK12100-01', 'HESS-261kWh', 'A/B.c_d']) {
      expect(isValidSku(sku), sku).toBe(true);
    }
  });

  it('refuses spaces, a leading symbol and anything over 64 characters', () => {
    for (const sku of ['TK 5145', '-TK5145', '', 'A'.repeat(65), 'TK#1']) {
      expect(isValidSku(sku), sku).toBe(false);
    }
  });

  it('accepts every SKU in the seeded catalogue', () => {
    const skus = TRONTEK_PRODUCTS.flatMap((product) => product.variants.map((variant) => variant.sku));
    expect(skus.length).toBeGreaterThan(0);
    expect(skus.filter((sku) => !isValidSku(sku))).toEqual([]);
  });

  it('has no two seeded SKUs that differ only by capitals', () => {
    const skus = TRONTEK_PRODUCTS.flatMap((product) => product.variants.map((variant) => variant.sku.toUpperCase()));
    expect(new Set(skus).size).toBe(skus.length);
  });
});

describe('repeatedVariantField', () => {
  it('names the rows of a SKU repeated with different capitals', () => {
    expect(
      repeatedVariantField([
        { sku: 'TK-1', variantKey: 'a' },
        { sku: 'tk-1', variantKey: 'b' },
      ]),
    ).toBe('SKU TK-1 appears on rows 1 and 2. Each variant needs its own SKU.');
  });

  it('names a repeated variant key — the case that used to be a 500', () => {
    expect(
      repeatedVariantField([
        { sku: 'TK-1', variantKey: 'default' },
        { sku: 'TK-2', variantKey: 'default' },
      ]),
    ).toMatch(/Variant key "default" appears on rows 1 and 2/);
  });

  it('is null when every row is distinct', () => {
    expect(repeatedVariantField([{ sku: 'TK-1', variantKey: 'default' }])).toBeNull();
  });
});
