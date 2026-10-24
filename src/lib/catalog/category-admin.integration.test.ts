import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { categoryInputSchema, createCategory, deleteCategory, updateCategory } from './category-admin';
import { buildCategoryTree, categoryPairError, listCategoryRows } from './category-store';

/**
 * Category management against the local `itarang_dev` database: a category
 * added in the admin panel becomes a valid home for a product, and one with
 * products in it cannot be deleted from under them.
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

const PARENT = 'zz-test-inverters';
const CHILD = 'zz-test-home-inverters';
const PRODUCT = 'zz-category-fixture';

async function cleanUp() {
  await query('DELETE FROM products WHERE product_key = $1', [PRODUCT]);
  await query('DELETE FROM catalog_categories WHERE slug = $1', [CHILD]);
  await query('DELETE FROM catalog_categories WHERE slug = $1', [PARENT]);
}

const input = (patch: Record<string, unknown>) =>
  categoryInputSchema.parse({ isVisible: true, ...patch });

describe.skipIf(!CONFIGURED)('catalog categories', () => {
  beforeEach(cleanUp);
  afterAll(async () => {
    await cleanUp();
    await closePool();
  });

  it('seeds the existing taxonomy, chargers included', async () => {
    const tree = buildCategoryTree(await listCategoryRows());
    expect(categoryPairError(tree, 'chargers', 'ev-chargers')).toBeNull();
    expect(categoryPairError(tree, 'batteries', 'ev-3-wheeler')).toBeNull();
  });

  it('adds a category and subcategory a product can then be filed under', async () => {
    expect(await createCategory(input({ slug: PARENT, name: 'Inverters', icon: 'inverter' }))).toEqual({ ok: true });
    expect(await createCategory(input({ slug: CHILD, parentSlug: PARENT, name: 'Home inverters' }))).toEqual({
      ok: true,
    });

    const tree = buildCategoryTree(await listCategoryRows());
    expect(categoryPairError(tree, PARENT, CHILD)).toBeNull();
    expect(tree.find((c) => c.slug === PARENT)?.icon).toBe('inverter');
  });

  it('refuses a duplicate URL name and a third level', async () => {
    await createCategory(input({ slug: PARENT, name: 'Inverters' }));
    await createCategory(input({ slug: CHILD, parentSlug: PARENT, name: 'Home inverters' }));

    const duplicate = await createCategory(input({ slug: PARENT, name: 'Again' }));
    expect(duplicate).toMatchObject({ ok: false });

    const tooDeep = await createCategory(input({ slug: 'zz-test-deep', parentSlug: CHILD, name: 'Deep' }));
    expect(tooDeep).toEqual({ ok: false, error: expect.stringMatching(/top-level/) });
  });

  it('hides a category from the storefront tree without deleting it', async () => {
    await createCategory(input({ slug: PARENT, name: 'Inverters' }));
    await updateCategory(input({ slug: PARENT, name: 'Inverters (soon)', isVisible: false }));

    const rows = await listCategoryRows();
    expect(rows.find((r) => r.slug === PARENT)?.name).toBe('Inverters (soon)');
    expect(buildCategoryTree(rows).some((c) => c.slug === PARENT)).toBe(false);
  });

  it('will not delete a category that still has products or subcategories', async () => {
    await createCategory(input({ slug: PARENT, name: 'Inverters' }));
    await createCategory(input({ slug: CHILD, parentSlug: PARENT, name: 'Home inverters' }));
    await query(
      `INSERT INTO products (product_key, slug, status, title, category, subcategory)
       VALUES ($1, $1, 'draft', 'Category fixture', $2, $3)`,
      [PRODUCT, PARENT, CHILD],
    );

    expect(await deleteCategory(CHILD)).toEqual({ ok: false, error: expect.stringMatching(/1 product is/) });
    expect(await deleteCategory(PARENT)).toMatchObject({ ok: false });

    await query('DELETE FROM products WHERE product_key = $1', [PRODUCT]);
    expect(await deleteCategory(PARENT)).toEqual({ ok: false, error: expect.stringMatching(/subcategories/) });
    expect(await deleteCategory(CHILD)).toEqual({ ok: true });
    expect(await deleteCategory(PARENT)).toEqual({ ok: true });
  });
});
