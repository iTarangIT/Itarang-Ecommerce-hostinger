import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { productRepository } from './postgres-repository';

/**
 * The bulk price write, against the local `itarang_dev` database.
 *
 * One property matters more than the rest and cannot be checked without a
 * database: **only `mrp` and `selling` change.** The spreadsheet says nothing
 * about stock, availability, option values or variant titles, so an import that
 * went through `replaceVariants` — which deletes a product's variants and
 * reinserts them from its input — would erase all four by omission. That is a
 * silent, catalogue-wide data loss, and it is the reason
 * `updateVariantPricesBySku` exists as a separate method.
 *
 * The second is that the write is all-or-nothing.
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

if (!CONFIGURED) {
  console.warn(
    REMOTE
      ? '\n  [skipped] Bulk pricing integration tests write real rows and DATABASE_URL is remote. ' +
          'Set DB_ALLOW_REMOTE_TESTS=true to run them anyway.\n'
      : '\n  [skipped] Bulk pricing integration tests need DATABASE_URL pointing at a local ' +
          'itarang_dev database. See README → Database.\n',
  );
}

const KEY = 'bulk-pricing-fixture';
const SKU_A = 'BP-FIXTURE-A';
const SKU_B = 'BP-FIXTURE-B';
const ACTOR = 'bulk-pricing.integration.test@itarang.com';

interface VariantSnapshot {
  sku: string;
  mrp: number | null;
  selling: number | null;
  stock: number | null;
  availability: string | null;
  title: string;
  option_values: Record<string, string> | null;
  variant_key: string;
  position: number;
}

async function snapshot(): Promise<VariantSnapshot[]> {
  return query<VariantSnapshot>(
    `SELECT v.sku, v.mrp, v.selling, v.stock, v.availability, v.title,
            v.option_values, v.variant_key, v.position
       FROM product_variants v
       JOIN products p ON p.id = v.product_id
      WHERE p.product_key = $1
      ORDER BY v.position`,
    [KEY],
  );
}

describe.skipIf(!CONFIGURED)('updateVariantPricesBySku', () => {
  beforeEach(async () => {
    await query(`DELETE FROM products WHERE product_key = $1`, [KEY]);
    await query(
      `INSERT INTO products (product_key, slug, status, title, category, subcategory)
       VALUES ($1, $1, 'draft', 'Bulk pricing fixture', 'batteries', 'lithium')`,
      [KEY],
    );
    await query(
      `INSERT INTO product_variants
         (product_id, variant_key, sku, title, option_values, mrp, selling, stock, availability, position)
       SELECT id, 'a', $2, 'Variant A', '{"size":"small"}'::jsonb, 120000, 100000, 7, 'in-stock', 0
         FROM products WHERE product_key = $1`,
      [KEY, SKU_A],
    );
    await query(
      `INSERT INTO product_variants
         (product_id, variant_key, sku, title, option_values, mrp, selling, stock, availability, position)
       SELECT id, 'b', $2, 'Variant B', '{"size":"large"}'::jsonb, 240000, 200000, 0, 'out-of-stock', 1
         FROM products WHERE product_key = $1`,
      [KEY, SKU_B],
    );
  });

  afterAll(async () => {
    await query(`DELETE FROM products WHERE product_key = $1`, [KEY]);
    await closePool();
  });

  it('writes the new prices', async () => {
    const result = await productRepository().updateVariantPricesBySku(
      [{ sku: SKU_A, mrp: 150000, selling: 130000 }],
      ACTOR,
    );

    expect(result).toEqual({ ok: true, updated: 1 });

    const [a] = await snapshot();
    expect(a.mrp).toBe(150000);
    expect(a.selling).toBe(130000);
  });

  it('changes nothing else on the variant it touches', async () => {
    const before = await snapshot();
    await productRepository().updateVariantPricesBySku(
      [{ sku: SKU_A, mrp: 150000, selling: 130000 }],
      ACTOR,
    );
    const after = await snapshot();

    // The whole point of not reusing `replaceVariants`: everything the
    // spreadsheet is silent about must survive untouched.
    expect(after[0].stock).toBe(before[0].stock);
    expect(after[0].availability).toBe(before[0].availability);
    expect(after[0].title).toBe(before[0].title);
    expect(after[0].option_values).toEqual(before[0].option_values);
    expect(after[0].variant_key).toBe(before[0].variant_key);
    expect(after[0].position).toBe(before[0].position);
  });

  it('leaves variants the file did not mention alone', async () => {
    const before = await snapshot();
    await productRepository().updateVariantPricesBySku(
      [{ sku: SKU_A, mrp: 150000, selling: 130000 }],
      ACTOR,
    );
    const after = await snapshot();

    expect(after[1]).toEqual(before[1]);
  });

  it('keeps an out-of-stock variant out of stock', async () => {
    // Repricing is not a restock. A price list that quietly put a sold-out
    // product back on sale would be the worst kind of side effect.
    await productRepository().updateVariantPricesBySku(
      [{ sku: SKU_B, mrp: 300000, selling: 250000 }],
      ACTOR,
    );
    const [, b] = await snapshot();
    expect(b.stock).toBe(0);
    expect(b.availability).toBe('out-of-stock');
  });

  it('records who made the change on the parent product', async () => {
    await productRepository().updateVariantPricesBySku(
      [{ sku: SKU_A, mrp: 150000, selling: 130000 }],
      ACTOR,
    );
    const [product] = await query<{ updated_by: string | null }>(
      `SELECT updated_by FROM products WHERE product_key = $1`,
      [KEY],
    );
    expect(product.updated_by).toBe(ACTOR);
  });

  it('applies several rows in one go', async () => {
    const result = await productRepository().updateVariantPricesBySku(
      [
        { sku: SKU_A, mrp: 150000, selling: 130000 },
        { sku: SKU_B, mrp: 300000, selling: 250000 },
      ],
      ACTOR,
    );
    expect(result).toEqual({ ok: true, updated: 2 });

    const rows = await snapshot();
    expect(rows.map((r) => [r.mrp, r.selling])).toEqual([
      [150000, 130000],
      [300000, 250000],
    ]);
  });

  it('rolls the whole batch back when one SKU has gone', async () => {
    const before = await snapshot();

    const result = await productRepository().updateVariantPricesBySku(
      [
        { sku: SKU_A, mrp: 999900, selling: 999900 },
        { sku: 'SKU-THAT-DOES-NOT-EXIST', mrp: 1, selling: 1 },
      ],
      ACTOR,
    );

    expect(result).toEqual({ ok: false, code: 'not_found', sku: 'SKU-THAT-DOES-NOT-EXIST' });

    // The first row was written inside the transaction before the second one
    // failed. If it survives, the import is not all-or-nothing and a rejected
    // file has silently changed a price.
    expect(await snapshot()).toEqual(before);
  });

  it('does nothing, successfully, for an empty batch', async () => {
    const before = await snapshot();
    expect(await productRepository().updateVariantPricesBySku([], ACTOR)).toEqual({
      ok: true,
      updated: 0,
    });
    expect(await snapshot()).toEqual(before);
  });
});

describe.skipIf(!CONFIGURED)('listVariantSkus', () => {
  afterAll(async () => {
    await query(`DELETE FROM products WHERE product_key = $1`, [KEY]);
    await closePool();
  });

  it('returns the SKUs an uploaded file is validated against', async () => {
    await query(`DELETE FROM products WHERE product_key = $1`, [KEY]);
    await query(
      `INSERT INTO products (product_key, slug, status, title, category, subcategory)
       VALUES ($1, $1, 'draft', 'Bulk pricing fixture', 'batteries', 'lithium')`,
      [KEY],
    );
    await query(
      `INSERT INTO product_variants (product_id, variant_key, sku, mrp, selling)
       SELECT id, 'a', $2, 1, 1 FROM products WHERE product_key = $1`,
      [KEY, SKU_A],
    );

    expect(await productRepository().listVariantSkus()).toContain(SKU_A);
  });
});
