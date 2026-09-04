import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MANUFACTURERS, SELLERS, TRONTEK_PRODUCTS } from '../../../db/seed/trontek-products.ts';
import { publishBlockers } from './state-machine';
import type { ProductRecord } from './types';

/**
 * The transcription, held to its own rules.
 *
 * `seed-types.ts` states two: a `[insert …]` placeholder becomes `null`, and
 * strings are copied verbatim. The first is the one that can be broken by
 * accident — somebody filling a blank warranty with a figure from the product
 * artwork, or pricing the unpriced product to make it publish — so it is
 * asserted rather than trusted.
 */

const ROOT = resolve(__dirname, '../../..');

describe('the seed data is internally consistent', () => {
  it('has all eight products', () => {
    expect(TRONTEK_PRODUCTS).toHaveLength(8);
    expect(MANUFACTURERS).toHaveLength(1);
    expect(SELLERS).toHaveLength(1);
  });

  it('gives every product a unique key, slug and SKU', () => {
    const keys = TRONTEK_PRODUCTS.map((product) => product.productKey);
    const slugs = TRONTEK_PRODUCTS.map((product) => product.slug);
    const skus = TRONTEK_PRODUCTS.flatMap((product) =>
      product.variants.map((variant) => variant.sku),
    );

    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(slugs).size).toBe(slugs.length);
    // `product_variants.sku` is unique table-wide and `order_items.sku` is a
    // permanent invoice snapshot, so a collision here is not a display bug.
    expect(new Set(skus).size).toBe(skus.length);
  });

  it('files every product in a subcategory the taxonomy actually has', async () => {
    const { CATEGORIES } = await import('@/lib/commerce/mock/categories');
    const known = new Set(
      CATEGORIES.flatMap((category) =>
        category.subcategories.map((sub) => `${category.slug}/${sub.slug}`),
      ),
    );

    for (const product of TRONTEK_PRODUCTS) {
      expect(known, `${product.productKey} is filed under an unknown subcategory`).toContain(
        `${product.category}/${product.subcategory}`,
      );
    }
  });

  it('references four images per product, and all thirty-two are distinct', () => {
    const files = TRONTEK_PRODUCTS.flatMap((product) =>
      product.media.map((media) => media.file),
    );
    expect(files).toHaveLength(32);
    expect(new Set(files).size).toBe(32);

    for (const product of TRONTEK_PRODUCTS) {
      expect(product.media, `${product.productKey}`).toHaveLength(4);
      // A product's images must be its own. Sharing a file between two products
      // would put one battery's dimensions on another's page.
      expect(product.media.every((media) => media.altText.length > 0)).toBe(true);
    }
  });

  it('gives every product a distinct sort rank', () => {
    const ranks = TRONTEK_PRODUCTS.map((product) => product.popularityRank);
    expect(new Set(ranks).size).toBe(ranks.length);
  });
});

describe('placeholders in the source documents became nulls, not guesses', () => {
  /**
   * The five products whose documents read
   * "[insert Trontek warranty terms — typically expressed in months or cycles]".
   * Their supplied artwork does state a warranty; a marketing image is not a
   * warranty document, and this test is what stops it becoming one.
   */
  const WARRANTY_UNSTATED = [
    'trontek-tk25100',
    'trontek-tk-life-5145',
    'trontek-tk-life-6130-v2',
    'trontek-tk-life-6130-metal-top',
    'trontek-tk-life-6145',
    'trontek-tk-life-7332',
  ];

  it.each(WARRANTY_UNSTATED)('%s states no warranty', (key) => {
    const product = TRONTEK_PRODUCTS.find((entry) => entry.productKey === key);
    expect(product, `${key} is missing from the seed data`).toBeDefined();
    expect(product!.warrantyMonths).toBeNull();
    expect(product!.warrantyCycles).toBeNull();
    expect(product!.warrantyText).toBeNull();
    expect(product!.facets.warrantyMonths).toBeUndefined();
  });

  it('the two products whose documents do state one carry it', () => {
    const powercube = TRONTEK_PRODUCTS.find((p) => p.productKey === 'trontek-tk12100')!;
    expect(powercube.warrantyText).toBe('5 years or 4000 cycles, whichever is earlier');
    expect(powercube.warrantyMonths).toBe(60);

    const erickshaw = TRONTEK_PRODUCTS.find((p) => p.productKey === 'trontek-tk-liev-51105')!;
    expect(erickshaw.warrantyText).toBe('3 years or 1200 cycles, whichever is earlier');
    expect(erickshaw.warrantyMonths).toBe(36);
  });

  it('the unpriced product has no price and is a draft', () => {
    const powercube = TRONTEK_PRODUCTS.find((p) => p.productKey === 'trontek-tk25100')!;
    expect(powercube.status).toBe('draft');
    for (const variant of powercube.variants) {
      expect(variant.mrp).toBeNull();
      expect(variant.selling).toBeNull();
    }
  });

  it("leaves the manufacturer's unconfirmed legal name and address null", () => {
    const [trontek] = MANUFACTURERS;
    expect(trontek!.legalName ?? null).toBeNull();
    expect(trontek!.address ?? null).toBeNull();
  });

  it('leaves the unconfirmed customer-care email null', () => {
    const [itarang] = SELLERS;
    expect(itarang!.customerCareEmail ?? null).toBeNull();
  });

  it('does not enable EMI on any imported product', () => {
    // `emiEnabled` is deliberately absent from `ProductSeed`: the column
    // defaults to false and the importer never writes it, so a re-import
    // cannot revoke an offer an administrator has enabled — and no source
    // document mentions EMI, so none of the eight starts with it on.
    for (const product of TRONTEK_PRODUCTS) {
      expect(product, `${product.productKey} carries an EMI field`).not.toHaveProperty(
        'emiEnabled',
      );
    }
  });

  it('never leaks a placeholder string into any field', () => {
    // The cheapest possible guard against a half-finished transcription: no
    // "[insert …]" may survive anywhere in the seed modules.
    for (const file of [
      'trontek-shared.ts',
      'trontek-home-products.ts',
      'trontek-ev-products.ts',
    ]) {
      const text = readFileSync(join(ROOT, 'db', 'seed', file), 'utf8');
      // Strip comments: the header explains the rule and quotes the
      // placeholders it is about.
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code, `${file} still contains a placeholder`).not.toMatch(/\[insert/i);
    }
  });
});

describe('every product marked published can actually be published', () => {
  /** The seed shape, as the publish gate expects to see it. */
  function asRecord(seed: (typeof TRONTEK_PRODUCTS)[number]): ProductRecord {
    return {
      ...seed,
      id: 0,
      status: seed.status,
      // Not a seed field: the column defaults to false and the importer never
      // writes it, so no imported product carries the EMI offer.
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
      // The importer writes media separately, so the gate is checked against
      // the images the seed names.
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

  it.each(TRONTEK_PRODUCTS.filter((p) => p.status === 'published').map((p) => p.productKey))(
    '%s clears the publish gate',
    (key) => {
      const seed = TRONTEK_PRODUCTS.find((entry) => entry.productKey === key)!;
      expect(publishBlockers(asRecord(seed))).toEqual([]);
    },
  );

  it('the draft product does not clear it', () => {
    const seed = TRONTEK_PRODUCTS.find((p) => p.productKey === 'trontek-tk25100')!;
    expect(publishBlockers(asRecord(seed)).length).toBeGreaterThan(0);
  });
});
