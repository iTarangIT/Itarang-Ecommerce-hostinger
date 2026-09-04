import { describe, expect, it } from 'vitest';
import { canTransitionProduct, nextProductStatuses, publishBlockers } from './state-machine';
import type { ProductRecord } from './types';

function record(overrides: Partial<ProductRecord> = {}): ProductRecord {
  return {
    id: 1,
    productKey: 'test-product',
    slug: 'test-product',
    status: 'draft',
    brand: null,
    title: 'Test product',
    subtitle: '',
    modelName: null,
    genericName: null,
    productType: null,
    netQuantity: null,
    category: 'batteries',
    subcategory: 'lithium',
    art: 'battery',
    description: ['A paragraph.'],
    highlights: [],
    boxContents: [],
    careInstructions: null,
    countryOfOrigin: null,
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    emiEnabled: false,
    manufacturer: null,
    seller: null,
    hsnCode: null,
    taxRate: null,
    facets: {},
    badges: [],
    launchedAt: null,
    popularityRank: null,
    seoTitle: null,
    seoDescription: null,
    hostingerProductId: null,
    variants: [
      {
        id: 10,
        variantKey: 'default',
        sku: 'TEST-1',
        title: '',
        optionValues: {},
        mrp: 100_000,
        selling: 80_000,
        stock: null,
        availability: 'in-stock',
        position: 0,
      },
    ],
    media: [
      {
        id: 1,
        storagePath: 'a.jpg',
        url: 'https://example.test/a.jpg',
        altText: '',
        role: 'battery',
        mime: null,
        bytes: null,
        width: null,
        height: null,
        position: 0,
        isPrimary: true,
      },
    ],
    specGroups: [],
    faqs: [],
    sections: [],
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    publishedAt: null,
    archivedAt: null,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

describe('canTransitionProduct', () => {
  it('allows publishing and archiving a draft', () => {
    expect(canTransitionProduct('draft', 'published')).toBe(true);
    expect(canTransitionProduct('draft', 'archived')).toBe(true);
  });

  it('allows unpublishing and archiving a published product', () => {
    expect(canTransitionProduct('published', 'draft')).toBe(true);
    expect(canTransitionProduct('published', 'archived')).toBe(true);
  });

  it('refuses to restore an archived product straight to the storefront', () => {
    // Coming back has to pass through draft, which is where the publish gate
    // is applied — a product withdrawn months ago should have its price and
    // warranty looked at before it is on sale again.
    expect(canTransitionProduct('archived', 'published')).toBe(false);
    expect(canTransitionProduct('archived', 'draft')).toBe(true);
  });

  it('offers no transition that is not in the table', () => {
    for (const from of ['draft', 'published', 'archived'] as const) {
      for (const to of nextProductStatuses(from)) {
        expect(canTransitionProduct(from, to)).toBe(true);
      }
    }
  });
});

describe('publishBlockers', () => {
  it('passes a complete product', () => {
    expect(publishBlockers(record())).toEqual([]);
  });

  it('blocks a product whose only variant has no price', () => {
    const unpriced = record({
      variants: [
        {
          id: 10,
          variantKey: 'default',
          sku: 'TRN-TK25100',
          title: '',
          optionValues: {},
          mrp: null,
          selling: null,
          stock: null,
          availability: 'in-stock',
          position: 0,
        },
      ],
    });

    expect(publishBlockers(unpriced)).toContain('a variant with an MRP and a selling price');
  });

  it('names the unpriced SKU when other variants are priced', () => {
    const mixed = record({
      variants: [
        ...record().variants,
        {
          id: 11,
          variantKey: 'second',
          sku: 'TEST-2',
          title: '',
          optionValues: {},
          mrp: null,
          selling: null,
          stock: null,
          availability: null,
          position: 1,
        },
      ],
    });

    expect(publishBlockers(mixed)).toContain('price for TEST-2');
  });

  it('blocks a product with no images or no description', () => {
    expect(publishBlockers(record({ media: [] }))).toContain('at least one image');
    expect(publishBlockers(record({ description: [] }))).toContain('a description');
  });

  it('does NOT require a warranty', () => {
    // Five of the eight source documents state none. Requiring one here would
    // force somebody to invent a warranty to get a product published, which is
    // the exact failure the whole catalogue is built to avoid.
    expect(publishBlockers(record({ warrantyMonths: null, warrantyText: null }))).toEqual([]);
  });

  it('does NOT require a return window, FAQs, specs or a seller', () => {
    expect(
      publishBlockers(
        record({ returnWindowDays: null, faqs: [], specGroups: [], seller: null }),
      ),
    ).toEqual([]);
  });
});
