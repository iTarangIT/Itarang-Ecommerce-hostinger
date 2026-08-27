import { describe, expect, it } from 'vitest';
import sample from './__fixtures__/products.sample.json';
import { productsResponseSchema } from './schema';
import {
  htmlToParagraphs,
  inventoryMap,
  mapProduct,
  mapVariant,
  parseSpecBlock,
  popularityRankFor,
  toPaise,
} from './map';
import { unmappedProductIds } from './enrichment';

/**
 * Mapping tests run against `products.sample.json` — the real `/products`
 * response captured from the live Hostinger Sales Channel API. Testing against
 * the actual payload rather than a hand-written stub is what makes these
 * meaningful while the upstream API is unavailable.
 */

const parsed = productsResponseSchema.parse(sample);
const source = parsed.products[0];

describe('schema', () => {
  it('accepts the live payload unchanged', () => {
    expect(parsed.products).toHaveLength(1);
    expect(parsed.count).toBe(1);
  });
});

describe('toPaise', () => {
  it('passes two-decimal currencies through as minor units', () => {
    expect(toPaise(850000, 2)).toBe(850000);
  });

  it('rescales currencies with a different exponent', () => {
    // 8500 in a zero-decimal currency is ₹8,500 → 850000 paise.
    expect(toPaise(8500, 0)).toBe(850000);
    expect(toPaise(8500000, 3)).toBe(850000);
  });
});

describe('htmlToParagraphs', () => {
  it('splits paragraphs and strips markup and entities', () => {
    expect(htmlToParagraphs('<p>One &amp; two</p><p>Three</p>')).toEqual(['One & two', 'Three']);
  });

  it('returns an empty array for missing copy', () => {
    expect(htmlToParagraphs(null)).toEqual([]);
    expect(htmlToParagraphs('')).toEqual([]);
  });
});

describe('parseSpecBlock', () => {
  it('splits "Label: Value" lines', () => {
    expect(parseSpecBlock('<p>VA Rating: 900 VA</p>')).toEqual([
      { label: 'VA Rating', value: '900 VA' },
    ]);
  });

  it('keeps a line without a colon as a value-only row', () => {
    expect(parseSpecBlock('<p>Ships crated</p>')).toEqual([{ label: '', value: 'Ships crated' }]);
  });
});

describe('mapVariant', () => {
  it('reads stock from the inventory map', () => {
    const variant = mapVariant(source.variants[0], inventoryMap([{ id: source.variants[0].id, inventory_quantity: 12 }]));
    expect(variant.stock).toBe(12);
    expect(variant.availability).toBe('in-stock');
  });

  it('marks a managed variant with no stock as out of stock', () => {
    const variant = mapVariant(source.variants[0], new Map());
    expect(variant.stock).toBe(0);
    expect(variant.availability).toBe('out-of-stock');
  });

  it('flags low stock at or below five units', () => {
    const variant = mapVariant(source.variants[0], inventoryMap([{ id: source.variants[0].id, inventory_quantity: 3 }]));
    expect(variant.availability).toBe('low-stock');
  });

  it('treats an unmanaged variant as available', () => {
    const variant = mapVariant({ ...source.variants[0], manage_inventory: false }, new Map());
    expect(variant.availability).toBe('in-stock');
  });

  it('uses amount as MRP and sale_amount as the selling price', () => {
    const price = source.variants[0].prices[0];
    const onSale = mapVariant(
      { ...source.variants[0], prices: [{ ...price, sale_amount: 799900 }] },
      new Map(),
    );
    expect(onSale.price.mrp).toBe(850000);
    expect(onSale.price.selling).toBe(799900);
  });
});

describe('mapProduct', () => {
  const product = mapProduct(source, inventoryMap([{ id: source.variants[0].id, inventory_quantity: 25 }]));

  it('maps identity and pricing from the live SKU', () => {
    expect(product.id).toBe('prod_01KZXJ4DSGQCSHXW7BME2NJG0B');
    expect(product.slug).toBe('itarang-inverter-900-va');
    expect(product.title).toBe('iTarang Home Inverter 900VA');
    expect(product.variants[0].sku).toBe('ITG-INV-900VA-150AH');
    // ₹8,500 with decimal_digits 2 → 850000 paise, no sale price set.
    expect(product.variants[0].price).toEqual({ mrp: 850000, selling: 850000 });
  });

  it('applies the enrichment entry rather than guessing', () => {
    expect(product.category).toBe('combos');
    expect(product.subcategory).toBe('home-combos');
    expect(product.facets.capacityVa).toBe(900);
    expect(product.facets.batteryAh).toBe(150);
    expect(product.warrantyMonths).toBe(36);
    expect(product.installationIncluded).toBe(true);
  });

  it('parses the Key Specifications block into rows', () => {
    expect(product.specGroups).toHaveLength(1);
    expect(product.specGroups[0].title).toBe('Key Specifications');
    expect(product.specGroups[0].specs).toHaveLength(6);
    expect(product.specGroups[0].specs[0]).toEqual({ label: 'VA Rating', value: '900 VA' });
  });

  it('carries the merchant image and description across', () => {
    expect(product.images).toHaveLength(1);
    expect(product.images[0]).toContain('cdn.zyrosite.com');
    expect(product.description[0]).toContain('900VA pure sine wave home inverter');
  });

  it('never fabricates a rating — reviews are disabled on this store', () => {
    expect(product.rating).toBeNull();
  });

  it('falls back to local illustrations when the merchant has no imagery', () => {
    const withoutImages = mapProduct({ ...source, images: [], thumbnail: null }, new Map());
    expect(withoutImages.images[0]).toMatch(/^\/art\//);
  });
});

describe('enrichment identity', () => {
  /**
   * The failure these cover: a Hostinger product id is not stable. Recreating a
   * product in hPanel mints a new one, its entry stops matching, and the product
   * silently loses its warranty, installation commitment, taxonomy and every
   * facet. That has happened to this catalogue twice.
   */

  it('finds an entry by SKU when the product id has changed', () => {
    const recreated = mapProduct({ ...source, id: 'prod_brand_new_id' }, new Map());

    expect(recreated.category).toBe('combos');
    expect(recreated.subcategory).toBe('home-combos');
    expect(recreated.warrantyMonths).toBe(36);
    expect(recreated.installationIncluded).toBe(true);
  });

  it('finds an entry by url handle when both the id and the SKU have changed', () => {
    const recreated = mapProduct(
      {
        ...source,
        id: 'prod_brand_new_id',
        variants: [{ ...source.variants[0], sku: 'SOME-NEW-SKU' }],
      },
      new Map(),
    );

    expect(recreated.subcategory).toBe('home-combos');
    expect(recreated.warrantyMonths).toBe(36);
  });

  it('prefers the product id over the other identities', () => {
    // A SKU pointing at a different entry must not override an exact id match.
    const conflicting = mapProduct(
      { ...source, variants: [{ ...source.variants[0], sku: 'ITR-BAT-LI-200' }] },
      new Map(),
    );

    expect(conflicting.id).toBe('prod_01KZXJ4DSGQCSHXW7BME2NJG0B');
    expect(conflicting.subcategory).toBe('home-combos');
  });

  it('never resolves an entry from a variant id standing in for a missing SKU', () => {
    // `mapVariant` falls back to the variant id so the cart has something to
    // carry. That id is as unstable as the product id and must never decide
    // merchandising — a warranty claim cannot rest on it.
    const noSku = mapProduct(
      {
        ...source,
        id: 'prod_brand_new_id',
        url_handle: 'a-handle-nobody-claims',
        slug: null,
        variants: [{ ...source.variants[0], sku: null }],
      },
      new Map(),
    );

    expect(noSku.variants[0].sku).toBe(source.variants[0].id);
    expect(noSku.warrantyMonths).toBeUndefined();
    expect(noSku.installationIncluded).toBe(false);
  });

  it('reattaches the live products by url handle', () => {
    // The catalogue was recreated and every id changed. These three are matched
    // by handle because their SKUs cannot be trusted: one is duplicated across
    // two products upstream and two live products carry no SKU at all.
    const cases = [
      { slug: 'itarang-lithium-battery-150ah-12v-lifepo4', subcategory: 'lithium' },
      { slug: 'itarang-lithium-battery-200ah', subcategory: 'lithium' },
      { slug: 'itarang-home-inverter-1500va', subcategory: 'pure-sine-wave' },
    ];

    for (const expected of cases) {
      const live = mapProduct(
        {
          ...source,
          id: `prod_live_${expected.slug}`,
          url_handle: expected.slug,
          slug: null,
          variants: [{ ...source.variants[0], sku: null }],
        },
        new Map(),
      );

      expect(live.subcategory).toBe(expected.subcategory);
      // A real entry states a warranty; the title fallback never does.
      expect(live.warrantyMonths).toBeGreaterThan(0);
    }
  });

  it('never lends an entry to another product sharing its SKU upstream', () => {
    // The 150Ah LiFePO4 battery and the 900VA combo both carry
    // `ITG-CMB-900VA-150AH` in hPanel. That SKU is deliberately not a match key,
    // so the combo must fall through to the title guess rather than inherit a
    // battery's warranty, chemistry and box contents.
    const combo = mapProduct(
      {
        ...source,
        id: 'prod_live_combo',
        url_handle: 'itarang-900va-inverter-150ah-battery-combo',
        slug: null,
        title: 'iTarang 900VA Inverter + 150Ah Battery Combo',
        subtitle: null,
        variants: [{ ...source.variants[0], sku: 'ITG-CMB-900VA-150AH' }],
      },
      new Map(),
    );

    expect(combo.subcategory).not.toBe('lithium');
    expect(combo.warrantyMonths).toBeUndefined();
    expect(combo.installationIncluded).toBe(false);
    expect(combo.boxContents).toEqual([]);
  });

  it('leaves the duplicate 150Ah battery to the fallback', () => {
    // Confirmed by the merchant as a duplicate of the LiFePO4 product. Giving it
    // an entry would give a duplicate the same standing in search and facets as
    // the product it duplicates.
    const duplicate = mapProduct(
      {
        ...source,
        id: 'prod_live_duplicate',
        url_handle: 'itarang-lithium-battery-150ah',
        slug: null,
        title: 'iTarang Lithium Battery 150Ah',
        subtitle: null,
        variants: [{ ...source.variants[0], sku: 'ITG-BAT-LI-150AH-12V' }],
      },
      new Map(),
    );

    expect(duplicate.warrantyMonths).toBeUndefined();
    expect(duplicate.facets.batteryAh).toBeUndefined();
  });

  it('stops reporting a product as unmapped once another identity finds it', () => {
    const subject = {
      productId: 'prod_brand_new_id',
      title: source.title,
      subtitle: source.subtitle,
      slug: 'itarang-inverter-900-va',
      skus: [source.variants[0].sku],
    };

    expect(unmappedProductIds([subject])).toEqual([]);
    // And a product nothing claims is still reported.
    expect(
      unmappedProductIds([{ ...subject, slug: 'nobody', skus: [null] }]),
    ).toEqual(['prod_brand_new_id']);
  });
});

describe('enrichment fallback', () => {
  it('files an unmapped product by title rather than dropping it', () => {
    const unknown = mapProduct(
      // Every identity cleared, not just the id: an entry is now also found by
      // SKU and url handle, so a product still carrying those is not unmapped.
      {
        ...source,
        id: 'prod_unknown',
        url_handle: 'talltube-150-battery',
        slug: null,
        title: 'iTarang TallTube 150 Battery',
        subtitle: '150Ah tubular',
        variants: [{ ...source.variants[0], sku: 'ITG-BAT-TT-150' }],
      },
      new Map(),
    );
    expect(unknown.category).toBe('batteries');
  });

  it('states no warranty for a product it cannot vouch for', () => {
    const unknown = mapProduct(
      // Every identity cleared, not just the id: an entry is now also found by
      // SKU and url handle, so a product still carrying those is not unmapped.
      {
        ...source,
        id: 'prod_unknown',
        url_handle: 'talltube-150-battery',
        slug: null,
        title: 'iTarang TallTube 150 Battery',
        subtitle: '150Ah tubular',
        variants: [{ ...source.variants[0], sku: 'ITG-BAT-TT-150' }],
      },
      new Map(),
    );
    // An invented warranty is a commercial promise nobody made.
    expect(unknown.warrantyMonths).toBeUndefined();
    expect(unknown.facets.warrantyMonths).toBeUndefined();
    expect(unknown.installationIncluded).toBe(false);
  });
});

describe('popularityRankFor', () => {
  it('always ranks a curated product ahead of an unranked one', () => {
    // Hostinger's `order` is negative on this store, which is exactly the case
    // that used to push the curated bestseller to the bottom of the rail.
    expect(popularityRankFor(1, undefined)).toBeLessThan(popularityRankFor(undefined, -4));
    expect(popularityRankFor(99, undefined)).toBeLessThan(popularityRankFor(undefined, -999));
    // Holds however extreme the upstream value is, because it is clamped.
    expect(popularityRankFor(99, undefined)).toBeLessThan(
      popularityRankFor(undefined, Number.MIN_SAFE_INTEGER),
    );
  });

  it('keeps Hostinger ordering among unranked products', () => {
    expect(popularityRankFor(undefined, -4)).toBeLessThan(popularityRankFor(undefined, -3));
    expect(popularityRankFor(undefined, 0)).toBeLessThan(popularityRankFor(undefined, 1));
  });

  it('treats a missing order as the neutral position', () => {
    expect(popularityRankFor(undefined, null)).toBe(popularityRankFor(undefined, 0));
  });

  it('uses the curated rank verbatim when present', () => {
    expect(popularityRankFor(3, -4)).toBe(3);
  });
});
