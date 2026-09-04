import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRONTEK_PRODUCTS } from '../../../db/seed/trontek-products.ts';
import { toDomainProduct } from '@/lib/products/to-domain';
import type { ProductRecord } from '@/lib/products/types';
import type { Product } from '@/lib/commerce/types';
import { DEMO_PRODUCT } from '@/lib/commerce/demo/demo-product';
import { resetEnvCache } from '@/lib/env';

/**
 * What may be bought — asserted through the server, not through the rule.
 *
 * The business rule for this release is narrow: only the eight real products in
 * our own database, only when published, priced and in stock, and never cash on
 * delivery. Testing `purchaseBlockFor` alone would prove the rule is written
 * correctly and prove nothing about whether anything consults it, so every case
 * below goes through `buildQuote` — the function that decides what a customer
 * is actually charged.
 *
 * Products come from `db/seed/trontek-products.ts`, projected by the same
 * `toDomainProduct` the storefront uses, so nothing here restates a price or a
 * capacity that could drift from the catalogue.
 *
 * Two collaborators are mocked and only two: which provider is active, and what
 * it returns. Everything else — pricing, totals, coupons, serviceability, the
 * COD rules — is the real code path.
 */

const { allProducts, activeProviderName } = vi.hoisted(() => ({
  allProducts: vi.fn<() => Promise<Product[]>>(),
  activeProviderName: vi.fn<() => string>(),
}));

vi.mock('@/lib/catalog/collections', () => ({ allProducts }));
vi.mock('@/lib/commerce', () => ({ activeProviderName }));

const { buildQuote } = await import('./quote');

/* ----------------------------------------------------- catalogue fixtures */

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

function seedFor(productKey: string) {
  const seed = TRONTEK_PRODUCTS.find((entry) => entry.productKey === productKey);
  if (!seed) throw new Error(`${productKey} is not in the seed data`);
  return seed;
}

/** Exactly what `DbCatalogProvider.listPublished()` would serve. */
const PUBLISHED: Product[] = TRONTEK_PRODUCTS.filter((p) => p.status === 'published').map((p) =>
  toDomainProduct(asRecord(p)),
);

const POWERCUBE_1_4 = 'trontek-tk12100';
const DRAFT_PRODUCT = 'trontek-tk25100';

/** The first sellable variant of the published home battery. */
const sellable = PUBLISHED.find((p) => p.id === POWERCUBE_1_4)!;
const SELLABLE_VARIANT_ID = sellable.variants[0]!.id;

/**
 * A pincode the serviceability fixture accepts.
 *
 * `lib/support/serviceability.ts` is a development stand-in that answers from
 * the digit sum. It no longer blocks a quote — see the closing describe block —
 * but a fixed, known-serviceable value is still used here so the cases in
 * between are about what they say they are about, and not about coverage.
 */
const SERVICEABLE_PINCODE = '110001';

/* ------------------------------------------------------------ environment */

const ENV_KEYS = ['COD_ENABLED', 'COD_FEE_PAISE', 'COD_MAX_ORDER_PAISE', 'PAYMENT_PROVIDER'];
const saved = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of ENV_KEYS) saved.set(key, process.env[key]);
  // Pinned rather than inherited from `.env.local`, so the COD assertions below
  // test the code and not the machine they run on.
  process.env.COD_ENABLED = 'false';
  process.env.COD_FEE_PAISE = '0';
  process.env.COD_MAX_ORDER_PAISE = '2000000';
  process.env.PAYMENT_PROVIDER = 'mock';
  resetEnvCache();

  activeProviderName.mockReturnValue('db');
  allProducts.mockResolvedValue(PUBLISHED);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = saved.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetEnvCache();
  vi.clearAllMocks();
});

const line = (variantId: string, quantity = 1) => ({
  lines: [{ variantId, quantity }],
  pincode: SERVICEABLE_PINCODE,
});

const codes = (quote: Awaited<ReturnType<typeof buildQuote>>) =>
  quote.issues.map((issue) => issue.code);

/* ------------------------------------------------------------ the happy path */

describe('an eligible real product can be quoted', () => {
  it('prices the published home battery from the catalogue row', async () => {
    const quote = await buildQuote(line(SELLABLE_VARIANT_ID));

    expect(quote.placeable).toBe(true);
    expect(quote.items).toHaveLength(1);
    expect(quote.items[0]!.id).toBe(SELLABLE_VARIANT_ID);
    // The price is the catalogue's, not a figure written here.
    expect(quote.items[0]!.price.selling).toBe(seedFor(POWERCUBE_1_4).variants[0]!.selling);
    expect(quote.totals.total).toBeGreaterThan(0);
  });

  it('carries the catalogue SKU onto the order item', async () => {
    const quote = await buildQuote(line(SELLABLE_VARIANT_ID));
    expect(quote.orderItems[0]!.sku).toBe(seedFor(POWERCUBE_1_4).variants[0]!.sku);
  });

  it.each(
    TRONTEK_PRODUCTS.filter((p) => p.status === 'published').map((p) => p.productKey),
  )('%s is quotable, because all seven published products are real', async (key) => {
    const product = PUBLISHED.find((p) => p.id === key)!;
    const quote = await buildQuote(line(product.variants[0]!.id));
    expect(quote.placeable, `${key} could not be quoted`).toBe(true);
  });
});

/* ------------------------------------------------- 1-3 · the wrong catalogue */

describe('only the database catalogue is purchasable', () => {
  it.each(['hostinger', 'mock'])(
    'quotes nothing at all under COMMERCE_PROVIDER=%s',
    async (provider) => {
      activeProviderName.mockReturnValue(provider);

      // The variant id is a real, sellable one. The refusal is about whose
      // catalogue it is, not about whether the id resolves.
      const quote = await buildQuote(line(SELLABLE_VARIANT_ID));

      expect(quote.placeable).toBe(false);
      expect(quote.items).toEqual([]);
      expect(quote.orderItems).toEqual([]);
      expect(codes(quote)).toContain('not_purchasable');
      expect(quote.totals.total).toBe(0);
    },
  );

  it('refuses a Hostinger product id even while the db provider is active', async () => {
    // Hostinger ids look nothing like ours, and the db catalogue does not hold
    // them — so this is `not_found`, which is the same answer any unknown id
    // gets. Asserted so the shape of the refusal is deliberate.
    const quote = await buildQuote(line('prod_01JQZ8Y7K3ABCDEF:default'));
    expect(quote.placeable).toBe(false);
    expect(codes(quote)).toContain('not_found');
  });
});

/* ---------------------------------------------------- 2-5 · ineligible rows */

describe('an ineligible product cannot be quoted', () => {
  it('refuses an id that was never real', async () => {
    const quote = await buildQuote(line('not-a-real-variant'));
    expect(quote.placeable).toBe(false);
    expect(codes(quote)).toContain('not_found');
  });

  it('refuses the draft product, which is not in the published catalogue', async () => {
    const draft = toDomainProduct(asRecord(seedFor(DRAFT_PRODUCT)));
    // Not served: `listPublished()` never returns it. The id is real, and the
    // answer is still the one an unknown id gets — the endpoint must not
    // confirm that an unreleased product exists.
    const quote = await buildQuote(line(draft.variants[0]!.id));
    expect(quote.placeable).toBe(false);
    expect(codes(quote)).toContain('not_found');
  });

  it('refuses the draft product even if it somehow reached the served list', async () => {
    // Defence in depth: the draft is unpriced, so the per-variant rule refuses
    // it on price alone. A publishing accident cannot turn it into a free order.
    const draft = toDomainProduct(asRecord(seedFor(DRAFT_PRODUCT)));
    allProducts.mockResolvedValue([...PUBLISHED, draft]);

    const quote = await buildQuote(line(draft.variants[0]!.id));

    expect(quote.placeable).toBe(false);
    expect(codes(quote)).toContain('not_purchasable');
    expect(quote.items).toEqual([]);
  });

  it('refuses the demo fixture', async () => {
    allProducts.mockResolvedValue([...PUBLISHED, DEMO_PRODUCT]);

    const quote = await buildQuote(line(DEMO_PRODUCT.variants[0]!.id));

    expect(quote.placeable).toBe(false);
    expect(codes(quote)).toContain('not_purchasable');
    expect(quote.issues[0]!.message).toMatch(/demonstration listing/i);
  });

  it('refuses an out-of-stock variant', async () => {
    const outOfStock = toDomainProduct({
      ...asRecord(seedFor(POWERCUBE_1_4)),
      variants: asRecord(seedFor(POWERCUBE_1_4)).variants.map((v) => ({ ...v, stock: 0 })),
    });
    allProducts.mockResolvedValue([outOfStock]);

    const quote = await buildQuote(line(outOfStock.variants[0]!.id));

    expect(quote.placeable).toBe(false);
    expect(codes(quote)).toContain('out_of_stock');
  });

  it('refuses a variant an administrator marked out of stock without a count', async () => {
    // Untracked stock projects to the sentinel 99, so only the label says this
    // is unavailable. A raw `stock > 0` check would sell it.
    const labelled = toDomainProduct({
      ...asRecord(seedFor(POWERCUBE_1_4)),
      variants: asRecord(seedFor(POWERCUBE_1_4)).variants.map((v) => ({
        ...v,
        stock: null,
        availability: 'out-of-stock' as const,
      })),
    });
    allProducts.mockResolvedValue([labelled]);

    expect(labelled.variants[0]!.stock).toBe(99);
    const quote = await buildQuote(line(labelled.variants[0]!.id));
    expect(quote.placeable).toBe(false);
    expect(codes(quote)).toContain('out_of_stock');
  });

  it('refuses a published-but-unpriced variant rather than selling it for nothing', async () => {
    const free = toDomainProduct({
      ...asRecord(seedFor(POWERCUBE_1_4)),
      variants: asRecord(seedFor(POWERCUBE_1_4)).variants.map((v) => ({
        ...v,
        mrp: null,
        selling: null,
      })),
    });
    allProducts.mockResolvedValue([free]);

    expect(free.variants[0]!.price.selling).toBe(0);
    const quote = await buildQuote(line(free.variants[0]!.id));

    expect(quote.placeable).toBe(false);
    expect(codes(quote)).toContain('not_purchasable');
    expect(quote.totals.total).toBe(0);
  });
});

/* ------------------------------------------- 6-8 · client-supplied values */

describe('nothing the client sends decides what is charged', () => {
  it('ignores a price the client would like to pay', async () => {
    // There is nowhere to put one: the quote request carries variant ids and
    // quantities only. Asserted as a property of the result rather than of the
    // schema, so a future field cannot quietly become load-bearing.
    const quote = await buildQuote({
      ...line(SELLABLE_VARIANT_ID),
      // @ts-expect-error — deliberately sending a field the type forbids.
      price: 1,
      unitPrice: 1,
      total: 1,
    });

    expect(quote.items[0]!.price.selling).toBe(seedFor(POWERCUBE_1_4).variants[0]!.selling);
    expect(quote.totals.total).toBe(
      seedFor(POWERCUBE_1_4).variants[0]!.selling! * 1 + quote.totals.shipping,
    );
  });

  it('caps a quantity above the available stock instead of honouring it', async () => {
    const stock = sellable.variants[0]!.stock;
    const quote = await buildQuote(line(SELLABLE_VARIANT_ID, stock + 25));

    expect(quote.items[0]!.quantity).toBe(stock);
    expect(codes(quote)).toContain('quantity_reduced');
  });

  it('ignores a negative or fractional quantity', async () => {
    expect((await buildQuote(line(SELLABLE_VARIANT_ID, -5))).items).toEqual([]);
    const fractional = await buildQuote(line(SELLABLE_VARIANT_ID, 2.9));
    expect(fractional.items[0]!.quantity).toBe(2);
  });

  it('prices a quantity from the catalogue unit price, not from a line total', async () => {
    const unit = seedFor(POWERCUBE_1_4).variants[0]!.selling!;
    const quote = await buildQuote(line(SELLABLE_VARIANT_ID, 3));
    expect(quote.orderItems[0]!.lineTotal).toBe(unit * 3);
  });
});

/* ------------------------------------------------------------- 11 · COD */

describe('cash on delivery is closed', () => {
  it('is never available while COD_ENABLED is false', async () => {
    const quote = await buildQuote(line(SELLABLE_VARIANT_ID));
    expect(quote.codAvailable).toBe(false);
    expect(quote.codFee).toBe(0);
  });

  it('refuses a quote that asks for it, so no COD order can be placed', async () => {
    const quote = await buildQuote({
      ...line(SELLABLE_VARIANT_ID),
      paymentMethod: 'cod',
    });

    expect(quote.placeable).toBe(false);
    expect(codes(quote)).toContain('cod_unavailable');
  });

  it('adds no COD fee to a quote that asked for it', async () => {
    process.env.COD_FEE_PAISE = '5000';
    resetEnvCache();

    const quote = await buildQuote({
      ...line(SELLABLE_VARIANT_ID),
      paymentMethod: 'cod',
    });

    expect(quote.codFee).toBe(0);
    expect(quote.totals.codFee).toBe(0);
  });

  it('does not fall back to COD when online payment is requested', async () => {
    const quote = await buildQuote({
      ...line(SELLABLE_VARIANT_ID),
      paymentMethod: 'razorpay-test',
    });
    expect(quote.placeable).toBe(true);
    expect(quote.codAvailable).toBe(false);
    expect(quote.totals.codFee).toBe(0);
  });
});

/* --------------------------------------------- 12 · serviceability advises */

/**
 * A development fixture must not refuse a real customer.
 *
 * `lib/support/serviceability.ts` answers from the digit sum of the pincode
 * (`serviceable = checksum % 11 !== 0`), which has no relationship to where we
 * deliver — so roughly one valid Indian pincode in eleven was being refused at
 * checkout. `not_serviceable` has been removed from the blocking set in
 * `quote.ts`: the issue is still raised, so the customer can still be told we
 * cannot confirm delivery, but it no longer stops the order.
 *
 * The pincodes below are real cities chosen because the fixture rejects them,
 * and the digit sum is asserted here rather than trusted, so the day the
 * fixture's rule changes these tests say so instead of quietly passing.
 */
describe('the serviceability fixture advises but does not refuse', () => {
  /** Lucknow. 2+2+6+0+0+1 = 11. */
  const UNSERVICEABLE_PINCODE = '226001';
  /** Srinagar. 1+9+0+0+0+1 = 11. */
  const ALSO_UNSERVICEABLE = '190001';

  const digitSum = (pincode: string) =>
    pincode.split('').reduce((sum, digit) => sum + Number(digit), 0);

  it.each([UNSERVICEABLE_PINCODE, ALSO_UNSERVICEABLE])(
    '%s is genuinely rejected by the fixture, so these cases test what they claim to',
    (pincode) => {
      expect(digitSum(pincode) % 11).toBe(0);
    },
  );

  it('still places a real order to a pincode the fixture calls unserviceable', async () => {
    const quote = await buildQuote({
      lines: [{ variantId: SELLABLE_VARIANT_ID, quantity: 1 }],
      pincode: UNSERVICEABLE_PINCODE,
    });

    expect(quote.placeable).toBe(true);
  });

  it('still raises the issue, so the customer can be told', async () => {
    const quote = await buildQuote({
      lines: [{ variantId: SELLABLE_VARIANT_ID, quantity: 1 }],
      pincode: UNSERVICEABLE_PINCODE,
    });

    // Advisory, not blocking: present in `issues`, absent from the decision.
    expect(codes(quote)).toContain('not_serviceable');
  });

  it('prices the order identically whichever pincode it goes to', async () => {
    const [serviceable, unserviceable] = await Promise.all([
      buildQuote(line(SELLABLE_VARIANT_ID)),
      buildQuote({
        lines: [{ variantId: SELLABLE_VARIANT_ID, quantity: 1 }],
        pincode: UNSERVICEABLE_PINCODE,
      }),
    ]);

    expect(unserviceable.totals.total).toBe(serviceable.totals.total);
  });

  it('leaves a malformed pincode raising its own issue', async () => {
    // Address *data* validation is a separate concern and is unchanged.
    const quote = await buildQuote({
      lines: [{ variantId: SELLABLE_VARIANT_ID, quantity: 1 }],
      pincode: '12',
    });

    expect(codes(quote)).toContain('not_serviceable');
  });

  it('still refuses an out-of-stock line at an unserviceable pincode', async () => {
    // The gates that matter are untouched: only the fictional one was removed.
    const outOfStock = toDomainProduct({
      ...asRecord(seedFor(POWERCUBE_1_4)),
      variants: asRecord(seedFor(POWERCUBE_1_4)).variants.map((v) => ({ ...v, stock: 0 })),
    });
    allProducts.mockResolvedValue([outOfStock]);

    const quote = await buildQuote({
      lines: [{ variantId: outOfStock.variants[0]!.id, quantity: 1 }],
      pincode: UNSERVICEABLE_PINCODE,
    });

    expect(quote.placeable).toBe(false);
    expect(codes(quote)).toContain('out_of_stock');
  });

  it('still refuses a product that is not ours at an unserviceable pincode', async () => {
    allProducts.mockResolvedValue([DEMO_PRODUCT]);

    const quote = await buildQuote({
      lines: [{ variantId: DEMO_PRODUCT.variants[0]!.id, quantity: 1 }],
      pincode: UNSERVICEABLE_PINCODE,
    });

    expect(quote.placeable).toBe(false);
    expect(codes(quote)).toContain('not_purchasable');
  });
});
