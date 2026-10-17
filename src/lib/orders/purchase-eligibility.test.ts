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
 * Three collaborators are mocked: which provider is active, what it returns,
 * and the coverage lookup (a database read). Everything else — pricing, totals,
 * coupons, the COD rules — is the real code path.
 */

const { allProducts, activeProviderName, lookupPincode } = vi.hoisted(() => ({
  allProducts: vi.fn<() => Promise<Product[]>>(),
  activeProviderName: vi.fn<() => string>(),
  lookupPincode: vi.fn(),
}));

vi.mock('@/lib/catalog/collections', () => ({ allProducts }));
vi.mock('@/lib/commerce', () => ({ activeProviderName }));
// Coverage is a database read; each test sets the answer it needs.
vi.mock('@/lib/support/serviceability-server', () => ({ lookupPincode }));

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
  // Default coverage answer: listed and deliverable. The coverage tests below
  // override it.
  lookupPincode.mockResolvedValue({
    serviceable: true,
    confirmed: true,
    pincode: '122018',
    deliveryDays: 2,
    codAvailable: true,
    installationDays: 3,
    message: 'Delivery in 2–3 working days.',
  });

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

/* --------------------------------------- 12 · serviceability from coverage */

/**
 * Delivery coverage comes from `serviceable_pincodes`, through
 * `lookupPincode` — mocked here so the three answers can be set directly.
 *
 * Only a pincode the coverage list has explicitly switched off refuses an
 * order. An unlisted pincode is "unconfirmed": told, never refused. This used
 * to be decided by the digit sum of the pincode, which refused about one valid
 * pincode in eleven and so could not be allowed to block anything.
 */
describe('serviceability: only a confirmed no-delivery pincode refuses', () => {
  const PINCODE = '226001';

  function coverage(serviceable: boolean, confirmed: boolean) {
    lookupPincode.mockResolvedValue({
      serviceable,
      confirmed,
      pincode: PINCODE,
      deliveryDays: 3,
      codAvailable: false,
      installationDays: 4,
      message: serviceable ? 'Delivery in 3–4 working days.' : 'We do not deliver to this pincode yet.',
    });
  }

  it('places an order to an unlisted pincode, without an issue', async () => {
    coverage(true, false);
    const quote = await buildQuote({
      lines: [{ variantId: SELLABLE_VARIANT_ID, quantity: 1 }],
      pincode: PINCODE,
    });
    expect(quote.placeable).toBe(true);
    expect(codes(quote)).not.toContain('not_serviceable');
    expect(quote.serviceability?.confirmed).toBe(false);
  });

  it('places an order to a listed, active pincode', async () => {
    coverage(true, true);
    const quote = await buildQuote({
      lines: [{ variantId: SELLABLE_VARIANT_ID, quantity: 1 }],
      pincode: PINCODE,
    });
    expect(quote.placeable).toBe(true);
  });

  it('refuses a pincode the coverage list has switched off, and says why', async () => {
    coverage(false, true);
    const quote = await buildQuote({
      lines: [{ variantId: SELLABLE_VARIANT_ID, quantity: 1 }],
      pincode: PINCODE,
    });
    expect(quote.placeable).toBe(false);
    expect(codes(quote)).toContain('not_serviceable');
  });

  it('prices the order identically whatever the coverage answer', async () => {
    coverage(true, true);
    const listed = await buildQuote(line(SELLABLE_VARIANT_ID));
    coverage(true, false);
    const unlisted = await buildQuote({
      lines: [{ variantId: SELLABLE_VARIANT_ID, quantity: 1 }],
      pincode: PINCODE,
    });
    expect(unlisted.totals.total).toBe(listed.totals.total);
  });

  it('leaves a malformed pincode raising its own issue', async () => {
    lookupPincode.mockResolvedValue({ error: 'Enter a valid 6-digit pincode.' });
    const quote = await buildQuote({
      lines: [{ variantId: SELLABLE_VARIANT_ID, quantity: 1 }],
      pincode: '12',
    });
    expect(codes(quote)).toContain('not_serviceable');
  });

  it('still refuses an out-of-stock line', async () => {
    coverage(true, true);
    const outOfStock = toDomainProduct({
      ...asRecord(seedFor(POWERCUBE_1_4)),
      variants: asRecord(seedFor(POWERCUBE_1_4)).variants.map((v) => ({ ...v, stock: 0 })),
    });
    allProducts.mockResolvedValue([outOfStock]);

    const quote = await buildQuote({
      lines: [{ variantId: outOfStock.variants[0]!.id, quantity: 1 }],
      pincode: PINCODE,
    });

    expect(quote.placeable).toBe(false);
    expect(codes(quote)).toContain('out_of_stock');
  });
});
