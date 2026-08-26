import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '@/lib/env';

/**
 * What actually goes on the wire to Hostinger.
 *
 * The batch variant endpoint documents that "prices replace the variant's
 * existing prices in full". A request carrying a `prices` field — even one
 * copied faithfully from a read moments earlier — would overwrite the
 * merchant's pricing with whatever we happened to be holding. There is no
 * recovery from that except restoring by hand.
 *
 * So the body is asserted key by key rather than by shape: this is a test about
 * what must NOT be present.
 */

const ORIGINAL = { ...process.env };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.HOSTINGER_API_TOKEN = 'test-token-1234567890';
  process.env.HOSTINGER_STORE_ID = 'store_TEST';
  process.env.HOSTINGER_ACCOUNT_API_URL = 'https://developers.hostinger.com';
  // `vitest.setup.ts` loads .env.local, so a real machine's settings would
  // otherwise decide what these tests assert. Every value this file depends on
  // is set explicitly, including the ones it wants absent.
  delete process.env.HOSTINGER_INVENTORY_PUSH;
  resetEnvCache();

  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  resetEnvCache();
  vi.unstubAllGlobals();
});

function ok(body: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

async function client() {
  vi.resetModules();
  return import('./admin-client');
}

describe('setVariantInventory', () => {
  it('sends only variant_id and inventory_quantity', async () => {
    fetchMock.mockResolvedValue(
      ok({ variants: [{ id: 'variant_1', inventory_quantity: 4 }] }),
    );

    const { setVariantInventory } = await client();
    await setVariantInventory('prod_1', 'variant_1', 4);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);

    expect(body).toEqual({ variants: [{ variant_id: 'variant_1', inventory_quantity: 4 }] });

    // Stated separately and explicitly: a future edit that adds a price field
    // should fail here loudly rather than quietly overwrite live pricing.
    const variant = body.variants[0];
    expect(Object.keys(variant).sort()).toEqual(['inventory_quantity', 'variant_id']);
    expect(variant).not.toHaveProperty('prices');
    expect(variant).not.toHaveProperty('price');
    expect(variant).not.toHaveProperty('amount');
    expect(variant).not.toHaveProperty('sale_amount');
    expect(variant).not.toHaveProperty('currency');
    expect(variant).not.toHaveProperty('title');
    expect(variant).not.toHaveProperty('manage_inventory');
    expect(JSON.stringify(body)).not.toMatch(/price|amount|currency/i);
  });

  it('PATCHes the batch endpoint under the configured store', async () => {
    fetchMock.mockResolvedValue(ok({ variants: [{ id: 'v', inventory_quantity: 1 }] }));

    const { setVariantInventory } = await client();
    await setVariantInventory('prod_9', 'v', 1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://developers.hostinger.com/api/ecommerce/v1/stores/store_TEST/products/prod_9/variants/batch',
    );
    expect(init.method).toBe('PATCH');
    expect(init.headers.Authorization).toBe('Bearer test-token-1234567890');
  });

  it('returns the quantity the API reports, not the one we asked for', async () => {
    // The caller compares these. Echoing the request back would defeat the
    // check that catches a write which was accepted but not applied.
    fetchMock.mockResolvedValue(ok({ variants: [{ id: 'v', inventory_quantity: 99 }] }));

    const { setVariantInventory } = await client();
    expect(await setVariantInventory('p', 'v', 4)).toBe(99);
  });

  it('refuses a negative quantity before any request is made', async () => {
    const { setVariantInventory } = await client();
    await expect(setVariantInventory('p', 'v', -1)).rejects.toThrow(/negative/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('marks a network failure on a write as indeterminate', async () => {
    // The outcome is genuinely unknown, and the caller must verify rather than
    // retry blindly. Getting this flag wrong is how a double decrement happens.
    fetchMock.mockRejectedValue(new Error('socket hang up'));

    const { setVariantInventory } = await client();
    await expect(setVariantInventory('p', 'v', 4)).rejects.toMatchObject({
      indeterminate: true,
    });
  });

  it('marks a rejected write as determinate', async () => {
    // A 4xx/5xx is a real answer: the request was received and refused, so
    // nothing was written and a retry needs no verification.
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => 'invalid',
    } as unknown as Response);

    const { setVariantInventory } = await client();
    await expect(setVariantInventory('p', 'v', 4)).rejects.toMatchObject({
      indeterminate: false,
      status: 422,
    });
  });

  it('refuses to run without credentials', async () => {
    // The push flag must be off too: `env.ts` refuses to boot at all when the
    // flag is on and a credential is missing, and that is a different guard
    // from the one under test here.
    delete process.env.HOSTINGER_API_TOKEN;
    delete process.env.HOSTINGER_INVENTORY_PUSH;
    resetEnvCache();

    const { setVariantInventory } = await client();
    await expect(setVariantInventory('p', 'v', 4)).rejects.toThrow(/not configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('readVariantInventory', () => {
  it('reads variants with their stock and tracking flag', async () => {
    fetchMock.mockResolvedValue(
      ok({
        data: [
          { id: 'v1', inventory_quantity: 5, manage_inventory: true },
          { id: 'v2', inventory_quantity: 0, manage_inventory: false },
        ],
      }),
    );

    const { readVariantInventory } = await client();
    const variants = await readVariantInventory('prod_1');

    expect(variants).toEqual([
      { variantId: 'v1', quantity: 5, managed: true },
      { variantId: 'v2', quantity: 0, managed: false },
    ]);
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
  });

  it('ignores entries without a usable quantity', async () => {
    fetchMock.mockResolvedValue(ok({ data: [{ id: 'v1' }, { inventory_quantity: 3 }] }));

    const { readVariantInventory } = await client();
    expect(await readVariantInventory('prod_1')).toEqual([]);
  });
});

describe('inventoryPushEnabled', () => {
  it('stays off until switched on deliberately', async () => {
    // Holding a token is not consent to start mutating the merchant catalogue.
    const { inventoryPushEnabled } = await client();
    expect(inventoryPushEnabled()).toBe(false);
  });

  it('is on only when the flag and both credentials are present', async () => {
    process.env.HOSTINGER_INVENTORY_PUSH = 'true';
    resetEnvCache();

    const { inventoryPushEnabled } = await client();
    expect(inventoryPushEnabled()).toBe(true);
  });
});
