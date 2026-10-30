import { describe, expect, it } from 'vitest';
import { toDomainProduct } from '@/lib/products/to-domain';
import type { ProductRecord } from '@/lib/products/types';
import { familyOptions } from './variant-family';

/** A published product, projected the way the storefront sees it. */
function product(slug: string, overrides: Partial<ProductRecord> = {}, selling = 80_000, stock: number | null = null) {
  const record: ProductRecord = {
    id: 1,
    productKey: slug,
    slug,
    status: 'published',
    brand: null,
    title: slug,
    subtitle: '',
    modelName: null,
    genericName: null,
    productType: null,
    netQuantity: null,
    category: 'batteries',
    subcategory: 'lithium',
    art: 'battery',
    description: [],
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
        id: 1,
        variantKey: 'default',
        sku: `${slug}-SKU`,
        title: '',
        optionValues: {},
        mrp: selling + 10_000,
        selling,
        stock,
        availability: 'in-stock',
        position: 0,
      },
    ],
    media: [],
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
  return toDomainProduct(record);
}

const small = product('powercube-1-4', { variantGroup: 'powercube', variantLabel: '1.4 kWh' }, 2_500_000);
const large = product('powercube-2-7', { variantGroup: 'powercube', variantLabel: '2.7 kWh' }, 4_500_000, 0);
const huge = product('powercube-10', { variantGroup: 'powercube', variantLabel: '10 kWh' }, 9_000_000);
const loner = product('tk-lifr-5145');

describe('familyOptions', () => {
  it('shows no dropdown for a product with no family', () => {
    expect(familyOptions(loner, [loner, small, large])).toBeNull();
  });

  it('shows no dropdown for a family of one', () => {
    // Powercube 2.7 is not listed yet (B-01): the 1.4 page must not offer a
    // dropdown with only itself in it.
    expect(familyOptions(small, [small, loner])).toBeNull();
  });

  it('lists every published member with its own price and stock, smallest first', () => {
    const options = familyOptions(large, [huge, loner, large, small]);
    expect(options).toEqual([
      { slug: 'powercube-1-4', label: '1.4 kWh', selling: 2_500_000, available: true, current: false },
      { slug: 'powercube-2-7', label: '2.7 kWh', selling: 4_500_000, available: false, current: true },
      { slug: 'powercube-10', label: '10 kWh', selling: 9_000_000, available: true, current: false },
    ]);
  });

  it('lists only what the catalogue holds, so an unpublished sibling never appears', () => {
    // The storefront catalogue is published products only; a draft 2.7 is
    // simply absent from it.
    expect(familyOptions(small, [small, huge])?.map((option) => option.slug)).toEqual([
      'powercube-1-4',
      'powercube-10',
    ]);
  });

  it('keeps the current product even when the catalogue snapshot lacks it', () => {
    expect(familyOptions(small, [large])?.map((option) => option.current)).toEqual([true, false]);
  });
});
