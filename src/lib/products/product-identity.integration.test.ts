import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { productRepository } from './postgres-repository';
import type { VariantInput } from './types';

/**
 * The product creation rules in docs/product-rules.md, against the local
 * `itarang_dev` database: names may repeat, SKUs may not (ignoring capitals),
 * and every clash is reported as a sentence rather than a server error.
 */

function targetsRemote(): boolean {
  const raw = process.env.DATABASE_URL;
  if (!raw) return false;
  try {
    return !isLocalHost(inspectDatabaseUrl(raw).host);
  } catch {
    return false;
  }
}

const REMOTE = targetsRemote();
const CONFIGURED =
  Boolean(process.env.DATABASE_URL) && (!REMOTE || process.env.DB_ALLOW_REMOTE_TESTS === 'true');

const ACTOR = 'product-identity.integration.test@itarang.com';
const KEY_A = 'zz-identity-a';
const KEY_B = 'zz-identity-b';
const TITLE = 'Identity Fixture Battery';

const variant = (sku: string, variantKey = 'default'): VariantInput => ({
  variantKey,
  sku,
  mrp: 100_000,
  selling: 90_000,
  stock: 3,
  availability: null,
});

async function cleanUp() {
  await query('DELETE FROM products WHERE product_key = ANY($1)', [[KEY_A, KEY_B]]);
}

describe.skipIf(!CONFIGURED)('product identity rules', () => {
  beforeEach(cleanUp);
  afterAll(async () => {
    await cleanUp();
    await closePool();
  });

  async function create(productKey: string) {
    return productRepository().createProduct(
      { productKey, slug: productKey, title: TITLE, category: 'batteries', subcategory: 'ev-2-wheeler' },
      ACTOR,
    );
  }

  const pricing = { hsnCode: null, taxRate: null, emiEnabled: false };

  it('allows two products with the same name and different SKUs', async () => {
    expect((await create(KEY_A)).ok).toBe(true);
    expect((await create(KEY_B)).ok).toBe(true);
    expect((await productRepository().updatePricing(KEY_A, pricing, [variant('ZZ-ID-1')], ACTOR)).ok).toBe(true);
    expect((await productRepository().updatePricing(KEY_B, pricing, [variant('ZZ-ID-2')], ACTOR)).ok).toBe(true);
  });

  it('refuses the same SKU on another product, even in different capitals, naming it', async () => {
    await create(KEY_A);
    await create(KEY_B);
    await productRepository().updatePricing(KEY_A, pricing, [variant('ZZ-ID-1')], ACTOR);

    const clash = await productRepository().updatePricing(KEY_B, pricing, [variant('zz-id-1')], ACTOR);
    expect(clash).toEqual({ ok: false, code: 'duplicate', field: 'sku', value: 'ZZ-ID-1' });
  });

  it('reports a repeated variant key as a duplicate, not a server error', async () => {
    await create(KEY_A);
    const result = await productRepository().updatePricing(
      KEY_A,
      pricing,
      [variant('ZZ-ID-1', 'default'), variant('ZZ-ID-2', 'default')],
      ACTOR,
    );
    expect(result).toMatchObject({ ok: false, code: 'duplicate', field: 'variant_key' });
  });

  it('refuses a duplicate product key (the URL), which the create form avoids by adding -2', async () => {
    await create(KEY_A);
    expect(await create(KEY_A)).toMatchObject({ ok: false, code: 'duplicate' });
  });
});
