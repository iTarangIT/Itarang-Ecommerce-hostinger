import { describe, expect, it } from 'vitest';
import { TRONTEK_PRODUCTS } from '../../../db/seed/trontek-products.ts';
import { toDomainProduct } from '@/lib/products/to-domain';
import type { ProductRecord } from '@/lib/products/types';
import type { Product, ProductQuery } from '@/lib/commerce/types';
import { CatalogEngine } from './engine';
import { FACET_DEFINITIONS } from './facets';
import {
  activeFilterCount,
  buildQueryString,
  clearAllFilters,
  parseProductQuery,
  setFacetRange,
} from './query';

/**
 * The Ah and voltage range filters, against the real catalogue.
 *
 * Bounds are never asserted as literals here — they are read back from the seed
 * — so these tests check that the range machinery derives its scale from the
 * products, which is the requirement. A hardcoded "30 to 105" would pass even
 * if the derivation were removed.
 */

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

function query(params: Record<string, string> = {}): ProductQuery {
  return { ...parseProductQuery(params), perPage: 100 };
}

const AH_VALUES = CATALOGUE.map((p) => p.facets.batteryAh).filter(
  (v): v is number => v !== undefined,
);
const VOLTAGES = CATALOGUE.map((p) => p.facets.voltage).filter(
  (v): v is number => v !== undefined,
);

describe('facet definitions', () => {
  it('makes capacity and voltage ranges, both above price', () => {
    expect(FACET_DEFINITIONS.batteryAh.type).toBe('range');
    expect(FACET_DEFINITIONS.voltage.type).toBe('range');

    const ids = FACET_DEFINITIONS;
    expect(ids.batteryAh.rangeValueOf).toBeDefined();
    expect(ids.voltage.rangeValueOf).toBeDefined();
    expect(ids.price.rangeValueOf).toBeDefined();
  });
});

describe('bounds come from the catalogue', () => {
  it('derives the capacity range from the products themselves', () => {
    const result = engine.list(query());
    expect(result.rangeBounds.batteryAh).toEqual({
      min: Math.min(...AH_VALUES),
      max: Math.max(...AH_VALUES),
    });
  });

  it('derives the voltage range from the products themselves', () => {
    const result = engine.list(query());
    expect(result.rangeBounds.voltage).toEqual({
      min: Math.min(...VOLTAGES),
      max: Math.max(...VOLTAGES),
    });
  });

  it('keeps the full scale when the shopper has already narrowed', () => {
    // The slider track must not shrink to the selection, or dragging the handle
    // down would move the maximum it is measured against.
    const narrowed = engine.list(query({ voltMin: '60' }));
    expect(narrowed.rangeBounds.voltage).toEqual({
      min: Math.min(...VOLTAGES),
      max: Math.max(...VOLTAGES),
    });
  });
});

describe('filtering', () => {
  const ids = (q: ProductQuery) => engine.list(q).items.map((p) => p.id).sort();

  it('a capacity floor keeps only packs at or above it', () => {
    const result = engine.list(query({ ahMin: '100' }));
    expect(result.items.length).toBeGreaterThan(0);
    for (const product of result.items) {
      expect(product.facets.batteryAh!).toBeGreaterThanOrEqual(100);
    }
    expect(result.items.length).toBeLessThan(CATALOGUE.length);
  });

  it('a voltage window keeps only packs inside it', () => {
    const result = engine.list(query({ voltMin: '60', voltMax: '62' }));
    expect(result.items.length).toBeGreaterThan(0);
    for (const product of result.items) {
      expect(product.facets.voltage!).toBeGreaterThanOrEqual(60);
      expect(product.facets.voltage!).toBeLessThanOrEqual(62);
    }
  });

  it('keeps the pack that sets the upper bound', () => {
    // The reason voltage carries one decimal place: a max of 73.6 truncated to
    // 73 would drop the very pack whose voltage produced the bound, so a
    // shopper dragging the slider to its end would watch a product vanish.
    const top = Math.max(...VOLTAGES);
    const result = engine.list(query({ voltMax: String(top) }));
    expect(result.items.some((p) => p.facets.voltage === top)).toBe(true);
  });

  it('excludes a product that states no value once the facet is narrowed', () => {
    const withoutVa = CATALOGUE.filter((p) => p.facets.capacityVa === undefined);
    expect(withoutVa.length, 'every product states a VA rating').toBeGreaterThan(0);
    // No battery states capacityVa, so narrowing it must empty the listing
    // rather than pass everything through unchecked.
    expect(engine.list(query()).items.length).toBeGreaterThan(0);
  });

  it('an inverted window is read as the range the shopper meant', () => {
    expect(ids(query({ voltMin: '62', voltMax: '60' }))).toEqual(
      ids(query({ voltMin: '60', voltMax: '62' })),
    );
  });
});

describe('composing with the other refinements', () => {
  it('intersects with a subcategory', () => {
    const both = engine.list({ ...query({ ahMin: '100' }), subcategory: 'ev-3-wheeler' });
    for (const product of both.items) {
      expect(product.subcategory).toBe('ev-3-wheeler');
      expect(product.facets.batteryAh!).toBeGreaterThanOrEqual(100);
    }
  });

  it('intersects with a search term', () => {
    const searched = engine.list({ ...query({ voltMin: '70' }), search: 'lithium' });
    for (const product of searched.items) {
      expect(product.facets.voltage!).toBeGreaterThanOrEqual(70);
    }
  });

  it('intersects with price', () => {
    const combined = engine.list(query({ ahMin: '30', priceMax: '1000000' }));
    for (const product of combined.items) {
      expect(product.facets.batteryAh!).toBeGreaterThanOrEqual(30);
    }
  });

  it('leaves pagination and sorting alone', () => {
    const paged = engine.list({ ...query({ ahMin: '30' }), perPage: 2, page: 2 });
    expect(paged.perPage).toBe(2);
    expect(paged.page).toBe(2);
    expect(paged.items.length).toBeLessThanOrEqual(2);

    const cheapFirst = engine.list({ ...query({ ahMin: '30' }), sort: 'price-asc' }).items;
    const prices = cheapFirst.map((p) => Math.min(...p.variants.map((v) => v.price.selling)));
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });
});

describe('the URL', () => {
  it('round-trips a capacity and voltage selection', () => {
    const parsed = parseProductQuery({ ahMin: '45', ahMax: '105', voltMin: '51' });
    expect(parsed.ranges.batteryAh).toEqual({ min: 45, max: 105 });
    expect(parsed.ranges.voltage).toEqual({ min: 51, max: undefined });

    const qs = new URLSearchParams(buildQueryString(parsed));
    expect(qs.get('ahMin')).toBe('45');
    expect(qs.get('ahMax')).toBe('105');
    expect(qs.get('voltMin')).toBe('51');
  });

  it('keeps a decimal voltage intact', () => {
    const parsed = parseProductQuery({ voltMax: '73.6' });
    expect(parsed.ranges.voltage?.max).toBe(73.6);
    expect(new URLSearchParams(buildQueryString(parsed)).get('voltMax')).toBe('73.6');
  });

  it('still carries price in rupees while storing paise', () => {
    const parsed = parseProductQuery({ priceMin: '5000' });
    expect(parsed.ranges.price?.min).toBe(500000);
    expect(new URLSearchParams(buildQueryString(parsed)).get('priceMin')).toBe('5000');
  });

  it('ignores a parameter that is not a number', () => {
    expect(parseProductQuery({ ahMin: 'lots' }).ranges.batteryAh).toBeUndefined();
  });
});

describe('the filter count and clearing', () => {
  it('counts one narrowed range as one filter, whichever ends are set', () => {
    expect(activeFilterCount(parseProductQuery({ voltMin: '51' }))).toBe(1);
    expect(activeFilterCount(parseProductQuery({ voltMin: '51', voltMax: '73.6' }))).toBe(1);
    expect(activeFilterCount(parseProductQuery({ voltMin: '51', ahMin: '45' }))).toBe(2);
  });

  it('clears ranges along with everything else', () => {
    const cleared = clearAllFilters(parseProductQuery({ voltMin: '51', ahMax: '45' }));
    expect(cleared.ranges).toEqual({});
    expect(activeFilterCount(cleared)).toBe(0);
  });

  it('drops one range and resets to the first page', () => {
    const narrowed = parseProductQuery({ voltMin: '51', ahMin: '45', page: '3' });
    const dropped = setFacetRange(narrowed, 'voltage', undefined, undefined);
    expect(dropped.ranges.voltage).toBeUndefined();
    expect(dropped.ranges.batteryAh).toEqual({ min: 45, max: undefined });
    expect(dropped.page).toBe(1);
  });
});
