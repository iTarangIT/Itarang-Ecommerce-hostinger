import { describe, expect, it } from 'vitest';
import { toDomainProduct } from './to-domain';
import type { ProductRecord } from './types';

/**
 * The projection from a stored product to a shopper-facing one.
 *
 * Most of these assert an *absence*. The rule the whole catalogue is built on
 * is that an unknown value renders as nothing rather than as a plausible
 * default, and the only way that rule survives a refactor is if something fails
 * when a `?? 24` appears.
 */

function record(overrides: Partial<ProductRecord> = {}): ProductRecord {
  return {
    id: 1,
    productKey: 'test-product',
    slug: 'test-product',
    status: 'published',
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
}

describe('toDomainProduct', () => {
  it('uses our own key as the product id, never an upstream one', () => {
    const product = toDomainProduct(record({ hostingerProductId: 'prod_upstream_123' }));
    expect(product.id).toBe('test-product');
    expect(JSON.stringify(product)).not.toContain('prod_upstream_123');
  });

  it('namespaces variant ids by product so two products cannot collide', () => {
    expect(toDomainProduct(record()).variants[0]?.id).toBe('test-product:default');
  });

  it('omits an unstated warranty entirely rather than defaulting it', () => {
    const product = toDomainProduct(record());
    expect('warrantyMonths' in product).toBe(false);
    expect('warrantyText' in product).toBe(false);
    expect('warrantyCycles' in product).toBe(false);
  });

  it('carries a stated warranty in all three forms', () => {
    const product = toDomainProduct(
      record({
        warrantyMonths: 36,
        warrantyCycles: 1200,
        warrantyText: '3 years or 1200 cycles, whichever is earlier',
      }),
    );
    expect(product.warrantyMonths).toBe(36);
    expect(product.warrantyCycles).toBe(1200);
    expect(product.warrantyText).toBe('3 years or 1200 cycles, whichever is earlier');
  });

  it('omits the return window, care block and seller when unstated', () => {
    const product = toDomainProduct(record());
    expect('returnWindowDays' in product).toBe(false);
    expect('careInstructions' in product).toBe(false);
    expect('seller' in product).toBe(false);
    expect('manufacturer' in product).toBe(false);
  });

  it('never fabricates a rating', () => {
    expect(toDomainProduct(record()).rating).toBeNull();
  });

  it('treats an untracked stock as available rather than sold out', () => {
    // `stock: null` means "we do not track a number", which must not render as
    // "there are none".
    const product = toDomainProduct(record());
    expect(product.variants[0]?.availability).toBe('in-stock');
    expect(product.variants[0]?.stock).toBeGreaterThan(0);
  });

  it('derives availability from the stock number when no override is given', () => {
    const withStock = (stock: number) =>
      toDomainProduct(
        record({
          variants: [
            {
              id: 10,
              variantKey: 'default',
              sku: 'TEST-1',
              title: '',
              optionValues: {},
              mrp: 100_000,
              selling: 80_000,
              stock,
              availability: null,
              position: 0,
            },
          ],
        }),
      ).variants[0]?.availability;

    expect(withStock(0)).toBe('out-of-stock');
    expect(withStock(3)).toBe('low-stock');
    expect(withStock(40)).toBe('in-stock');
  });

  it('lets a counted zero override an explicit in-stock', () => {
    // Every imported variant carries an explicit `in-stock`. Without this rule
    // an administrator setting stock to 0 would change nothing a shopper sees,
    // and the first person to find out would be the one who ordered it.
    const product = toDomainProduct(
      record({
        variants: [
          {
            id: 10,
            variantKey: 'default',
            sku: 'TEST-1',
            title: '',
            optionValues: {},
            mrp: 100_000,
            selling: 80_000,
            stock: 0,
            availability: 'in-stock',
            position: 0,
          },
        ],
      }),
    );

    expect(product.variants[0]?.availability).toBe('out-of-stock');
    expect(product.variants[0]?.stock).toBe(0);
  });

  it('lets a tracked count outrank the label, in both directions', () => {
    const withOverride = (stock: number | null, availability: 'preorder' | 'in-stock') =>
      toDomainProduct(
        record({
          variants: [
            {
              id: 10,
              variantKey: 'default',
              sku: 'TEST-1',
              title: '',
              optionValues: {},
              mrp: 100_000,
              selling: 80_000,
              stock,
              availability,
              position: 0,
            },
          ],
        }),
      ).variants[0]?.availability;

    // A count of 2 reads as low stock even though the label says in-stock —
    // otherwise "1 left" and "200 left" would look identical to a shopper.
    expect(withOverride(2, 'in-stock')).toBe('low-stock');
    expect(withOverride(40, 'preorder')).toBe('in-stock');

    // Untracked is where the label is the only statement there is, so it wins.
    expect(withOverride(null, 'preorder')).toBe('preorder');
    expect(withOverride(null, 'in-stock')).toBe('in-stock');
  });

  it('treats untracked stock and zero stock as different statements', () => {
    const untracked = toDomainProduct(record()).variants[0];
    expect(untracked?.availability).toBe('in-stock');
    expect(untracked?.stock).toBeGreaterThan(0);
  });

  it('renders net quantity from the column, not from a specification row', () => {
    const product = toDomainProduct(
      record({
        netQuantity: '2 Count',
        specGroups: [
          {
            title: 'Product details',
            specs: [
              { label: 'Net quantity', value: '1 Count' },
              { label: 'Colour', value: 'Grey' },
            ],
          },
        ],
      }),
    );

    // The column is what the page shows.
    expect(product.netQuantity).toBe('2 Count');
    // The duplicate row is gone, so it cannot contradict the column.
    const labels = product.specGroups.flatMap((g) => g.specs.map((s) => s.label));
    expect(labels).not.toContain('Net quantity');
    // Every other specification survives untouched.
    expect(labels).toContain('Colour');
    expect(product.specGroups).toHaveLength(1);
  });

  it('drops a specification group that held only the duplicated row', () => {
    const product = toDomainProduct(
      record({
        netQuantity: '1 Count',
        specGroups: [
          { title: 'Only duplicates', specs: [{ label: ' NET QUANTITY ', value: '1 Count' }] },
          { title: 'Real', specs: [{ label: 'Voltage', value: '12.8 V' }] },
        ],
      }),
    );

    expect(product.specGroups.map((g) => g.title)).toEqual(['Real']);
  });

  it('derives the warranty facet from the column, not from stored facets', () => {
    // The Warranty filter reads `facets.warrantyMonths`. Storing it there as
    // well as in the column meant the admin's Comparison-values form — which
    // rebuilds `facets` from the five inputs it has, none of them a warranty —
    // silently dropped it and broke the filter with no way to restore it.
    const product = toDomainProduct(
      record({
        warrantyMonths: 36,
        facets: { batteryAh: 105, technology: 'LiFePO4' },
      }),
    );

    expect(product.facets.warrantyMonths).toBe(36);
    // Every other facet value is preserved.
    expect(product.facets.batteryAh).toBe(105);
    expect(product.facets.technology).toBe('LiFePO4');
  });

  it('clears the warranty facet when the column is cleared', () => {
    // A stale facet copy must not outlive the column it mirrors, or the filter
    // would keep offering a warranty the page no longer states.
    const product = toDomainProduct(
      record({
        warrantyMonths: null,
        facets: { batteryAh: 105, warrantyMonths: 60 },
      }),
    );

    expect(product.facets.warrantyMonths).toBeUndefined();
    expect(product.facets.batteryAh).toBe(105);
  });

  it('puts the primary image first, whatever its position', () => {
    const product = toDomainProduct(
      record({
        media: [
          {
            id: 1,
            storagePath: 'a.jpg',
            url: 'https://example.test/a.jpg',
            altText: '',
            role: 'size',
            mime: null,
            bytes: null,
            width: null,
            height: null,
            position: 0,
            isPrimary: false,
          },
          {
            id: 2,
            storagePath: 'b.jpg',
            url: 'https://example.test/b.jpg',
            altText: '',
            role: 'battery',
            mime: null,
            bytes: null,
            width: null,
            height: null,
            position: 1,
            isPrimary: true,
          },
        ],
      }),
    );

    expect(product.images).toEqual(['https://example.test/b.jpg', 'https://example.test/a.jpg']);
  });

  it('falls back to generated art when a product has no images', () => {
    const product = toDomainProduct(record());
    expect(product.images.length).toBeGreaterThan(0);
    expect(product.images[0]).toMatch(/^\/art\/battery-/);
  });

  it('splits the seller from the manufacturer', () => {
    const product = toDomainProduct(
      record({
        manufacturer: {
          id: 1,
          key: 'maker',
          name: 'Maker Ltd',
          legalName: null,
          address: null,
          website: 'www.example.test',
          email: null,
          phone: null,
          countryOfOrigin: 'India',
        },
        seller: {
          id: 2,
          key: 'reseller',
          name: 'Reseller Pvt Ltd',
          address: 'Somewhere',
          customerCarePhone: '9000000000',
          customerCareEmail: null,
          gstin: 'GSTIN123',
          grievanceOfficerName: 'A Person',
          grievanceOfficerPhone: '9000000001',
          packedBy: null,
        },
      }),
    );

    expect(product.manufacturer?.name).toBe('Maker Ltd');
    // Unconfirmed fields stay absent rather than becoming empty strings.
    expect('legalName' in (product.manufacturer ?? {})).toBe(false);
    expect(product.seller?.name).toBe('Reseller Pvt Ltd');
    expect(product.seller?.gstin).toBe('GSTIN123');
    expect(product.seller?.grievanceOfficer).toBe('A Person — 9000000001');
    // An unstated care email must not become an empty mailto: link.
    expect('customerCareEmail' in (product.seller ?? {})).toBe(false);
  });

  it('carries page sections through unchanged', () => {
    const product = toDomainProduct(
      record({ sections: [{ kind: 'compatibility', items: ['One', 'Two'] }] }),
    );
    expect(product.sections).toEqual([{ kind: 'compatibility', items: ['One', 'Two'] }]);
  });

  it('omits sections entirely when a product has none', () => {
    expect('sections' in toDomainProduct(record())).toBe(false);
  });

  it('omits the EMI offer unless the product carries it', () => {
    // No-cost EMI used to appear on any product priced over ₹5,000, because a
    // price threshold stood in for an agreement with a lender. Absence is now
    // the default and the only thing that turns it on is the product saying so.
    expect('emiEnabled' in toDomainProduct(record())).toBe(false);
    expect(toDomainProduct(record({ emiEnabled: true })).emiEnabled).toBe(true);
  });
});
