import { describe, expect, it } from 'vitest';
import { TRONTEK_PRODUCTS } from '../../../db/seed/trontek-products.ts';
import { toDomainProduct } from '@/lib/products/to-domain';
import type { ProductRecord } from '@/lib/products/types';
import type { Product } from '@/lib/commerce/types';
import { CATEGORIES } from '@/lib/commerce/mock/categories';
import { CatalogEngine, buildSuggestions } from './engine';

/**
 * Search, tested against the real catalogue.
 *
 * The products come from `db/seed/trontek-products.ts` — the reviewed
 * transcription of the eight manufacturer listing sheets — projected through
 * the same `toDomainProduct` the storefront uses. No product is defined here,
 * so a query cannot pass by matching a fixture invented to make it pass.
 *
 * The queries themselves are the ones the business reported returning nothing:
 * "e-rickshaw", "2W", and related battery terms.
 */

/** The seed shape as the repository would return it. */
function asRecord(seed: (typeof TRONTEK_PRODUCTS)[number]): ProductRecord {
  return {
    ...seed,
    id: 0,
    status: seed.status,
    emiEnabled: false,
    manufacturer: null,
    seller: null,
    launchedAt: null,
    seoTitle: null,
    seoDescription: null,
    hostingerProductId: null,
    variants: seed.variants.map((variant, index) => ({
      id: index,
      variantKey: variant.variantKey,
      sku: variant.sku,
      title: variant.title ?? '',
      optionValues: variant.optionValues ?? {},
      mrp: variant.mrp,
      selling: variant.selling,
      stock: variant.stock,
      availability: variant.availability,
      position: index,
    })),
    media: seed.media.map((media, index) => ({
      id: index,
      storagePath: media.file,
      url: '',
      altText: media.altText,
      role: media.role,
      mime: null,
      bytes: null,
      width: null,
      height: null,
      position: index,
      isPrimary: index === 0,
    })),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: null,
    archivedAt: null,
    createdBy: null,
    updatedBy: null,
  };
}

const CATALOGUE: Product[] = TRONTEK_PRODUCTS.map((seed) => toDomainProduct(asRecord(seed)));
const engine = new CatalogEngine(CATALOGUE);

/** Titles of everything the query matches, best first. */
function hits(term: string): string[] {
  return CATALOGUE.map((product) => ({ product, score: engine.score(product, term) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((hit) => hit.product.subcategory + ' · ' + hit.product.title);
}

function subcategoriesFound(term: string): Set<string> {
  return new Set(
    CATALOGUE.filter((product) => engine.score(product, term) > 0).map((p) => p.subcategory),
  );
}

describe('the catalogue is not empty', () => {
  it('has the three battery lines the storefront sells', () => {
    // Guards every assertion below: if the seed ever stopped containing these,
    // the "finds something" tests would pass vacuously against an empty set.
    const subcategories = new Set(CATALOGUE.map((p) => p.subcategory));
    expect(subcategories).toContain('lithium');
    expect(subcategories).toContain('ev-2-wheeler');
    expect(subcategories).toContain('ev-3-wheeler');
  });
});

describe('searches the meeting reported as broken', () => {
  it('finds e-rickshaw packs for "e-rickshaw"', () => {
    // The failure was structural, not a ranking problem: `e-rickshaw` split
    // into `e` and `rickshaw`, every token had to match, and `e` matched
    // nothing — so the query returned zero before `rickshaw` was considered.
    expect(subcategoriesFound('e-rickshaw')).toEqual(new Set(['ev-3-wheeler']));
  });

  it('finds the same packs for "erickshaw" and "rickshaw"', () => {
    expect(subcategoriesFound('erickshaw')).toEqual(new Set(['ev-3-wheeler']));
    expect(subcategoriesFound('rickshaw')).toEqual(new Set(['ev-3-wheeler']));
  });

  it('finds 2-wheeler packs for "2W", and does not confuse them with 3W', () => {
    // The point of expanding an alias to a contiguous phrase rather than to
    // loose tokens: both subcategories contain the word "wheeler", so `2` plus
    // `wheeler` would have matched all seven packs.
    expect(subcategoriesFound('2W')).toEqual(new Set(['ev-2-wheeler']));
    expect(subcategoriesFound('3W')).toEqual(new Set(['ev-3-wheeler']));
  });

  it('finds 2-wheeler packs for the spelled-out forms', () => {
    expect(subcategoriesFound('2 wheeler')).toEqual(new Set(['ev-2-wheeler']));
    expect(subcategoriesFound('2-wheeler')).toEqual(new Set(['ev-2-wheeler']));
  });
});

describe('the words the catalogue is described with', () => {
  it('matches a subcategory display name that appears in no slug', () => {
    // "rickshaw" exists only in "3-Wheeler & E-Rickshaw Batteries". Before the
    // display names were indexed, the corpus held the slug `ev-3-wheeler` and
    // the word was absent from the catalogue entirely.
    expect(hits('rickshaw').length).toBeGreaterThan(0);
  });

  it('matches the chemistry by name and by abbreviation', () => {
    expect(hits('lifepo4').length).toBeGreaterThan(0);
    expect(hits('lfp').length).toBe(hits('lifepo4').length);
  });

  it('matches lithium across both home and vehicle packs', () => {
    expect(hits('lithium').length).toBeGreaterThan(1);
  });
});

describe('model numbers and SKUs', () => {
  it('finds a product by the manufacturer model on its listing sheet', () => {
    const withModel = CATALOGUE.find((p) => p.model);
    expect(withModel, 'the seed states no model number').toBeDefined();
    expect(engine.score(withModel!, withModel!.model!)).toBeGreaterThan(0);
  });

  it('finds a product by variant SKU', () => {
    const sku = CATALOGUE[0].variants[0].sku;
    expect(engine.score(CATALOGUE[0], sku)).toBeGreaterThan(0);
  });
});

describe('electrical figures', () => {
  it('finds a pack by its voltage, with and without the unit', () => {
    const pack = CATALOGUE.find((p) => p.facets.voltage === 73.6);
    expect(pack, 'the seed has no 73.6 V pack').toBeDefined();
    expect(engine.score(pack!, '73.6V')).toBeGreaterThan(0);
    expect(engine.score(pack!, '73.6')).toBeGreaterThan(0);
  });

  it('finds a pack by its capacity in Ah', () => {
    const pack = CATALOGUE.find((p) => p.facets.batteryAh === 32);
    expect(pack, 'the seed has no 32 Ah pack').toBeDefined();
    expect(engine.score(pack!, '32Ah')).toBeGreaterThan(0);
  });
});

describe('search has not simply become broader', () => {
  it('returns nothing for a term the catalogue has no claim to', () => {
    expect(hits('refrigerator')).toEqual([]);
    expect(hits('washing machine')).toEqual([]);
    expect(hits('solar panel')).toEqual([]);
  });

  it('still requires every term to match', () => {
    // "lithium" matches plenty; "aeroplane" matches nothing; together they must
    // match nothing, or the engine has quietly become an OR.
    expect(hits('lithium aeroplane')).toEqual([]);
  });

  it('does not match a 2-wheeler query against a home battery', () => {
    expect(subcategoriesFound('2W')).not.toContain('lithium');
  });
});

describe('suggestions', () => {
  it('offers the subcategory rather than its parent', () => {
    const suggestions = buildSuggestions('e-rickshaw', engine.productSuggestions('e-rickshaw'), CATEGORIES);
    const category = suggestions.find((s) => s.type === 'category');
    expect(category?.href).toBe('/batteries/ev-3-wheeler');
  });

  it('applies the same aliases the results page does', () => {
    const suggestions = buildSuggestions('2W', engine.productSuggestions('2W'), CATEGORIES);
    expect(suggestions.some((s) => s.href === '/batteries/ev-2-wheeler')).toBe(true);
  });

  it('stays quiet for a single character', () => {
    expect(buildSuggestions('e', engine.productSuggestions('e'), CATEGORIES)).toEqual([]);
  });
});
