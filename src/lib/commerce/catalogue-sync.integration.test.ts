import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import type { Product } from './types';

/**
 * Duplicate prevention against the local `itarang_dev` database.
 *
 * `health.test.ts` proves the *detector* notices two products on one SKU. These
 * prove the *constraint* refuses to store the second one — which is the whole
 * point of the mirror. A banner appears after the fact; a primary key does not
 * let the fact happen.
 *
 * The case to read first is "the incumbent keeps a contested SKU". Getting that
 * backwards would let a newly-seen product take over the identity of one that
 * already has orders against it.
 */

// Subjects rather than ids: an entry is now found by SKU or url handle as well,
// so `unmappedProductIds` needs the whole product to answer. The stand-in keeps
// the same convention — a product id prefixed `unmapped_` is the one nothing
// claims — so every case below still reads the same way.
vi.mock('./hostinger/enrichment', () => ({
  unmappedProductIds: (subjects: Array<{ productId: string }>) =>
    subjects.filter((subject) => subject.productId.startsWith('unmapped_')).map((s) => s.productId),
}));

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
      ? '\n  [skipped] Catalogue sync integration tests write real rows and DATABASE_URL is ' +
          'remote. Set DB_ALLOW_REMOTE_TESTS=true to run them anyway.\n'
      : '\n  [skipped] Catalogue sync integration tests need DATABASE_URL pointing at a local ' +
          'itarang_dev.\n',
  );
}

function product(id: string, slug: string, skus: string[], title = id): Product {
  return {
    id,
    slug,
    title,
    variants: skus.map((sku, i) => ({ id: `${id}-v${i}`, sku, title: `${title} ${i}` })),
  } as unknown as Product;
}

async function statusOf(productId: string): Promise<string | null> {
  const rows = await query<{ status: string }>(
    `SELECT status FROM catalogue_products WHERE hostinger_product_id = $1`,
    [productId],
  );
  return rows[0]?.status ?? null;
}

async function alertSubjects(kind: string): Promise<string[]> {
  const rows = await query<{ subject: string }>(
    `SELECT subject FROM catalogue_alerts
      WHERE kind = $1 AND resolved_at IS NULL ORDER BY subject`,
    [kind],
  );
  return rows.map((row) => row.subject);
}

describe.runIf(CONFIGURED)('syncCatalogue', () => {
  let syncCatalogue: typeof import('./catalogue-sync').syncCatalogue;
  let quarantinedProductIds: typeof import('./catalogue-sync').quarantinedProductIds;

  beforeEach(async () => {
    ({ syncCatalogue, quarantinedProductIds } = await import('./catalogue-sync'));
    // Mirror tables only — no order, payment or inventory row is touched.
    await query(`TRUNCATE catalogue_skus, catalogue_variants, catalogue_alerts`);
    await query(`TRUNCATE catalogue_products CASCADE`);
  });

  afterAll(async () => {
    // These tables are exclusively this suite's; leaving the last test's
    // fixtures behind would seed the mirror with products that never existed.
    await query(`TRUNCATE catalogue_skus, catalogue_variants, catalogue_alerts`);
    await query(`TRUNCATE catalogue_products CASCADE`);
    await closePool();
  });

  it('accepts a clean catalogue', async () => {
    const result = await syncCatalogue([
      product('p1', 'inverter-900', ['SKU-A']),
      product('p2', 'battery-150', ['SKU-B']),
    ]);

    expect(result.productsActive).toBe(2);
    expect(result.productsQuarantined).toBe(0);
    expect(await quarantinedProductIds()).toEqual(new Set());
  });

  it('allows one product whose variants share a SKU', async () => {
    // Normal: several variants of the same product on one SKU.
    const result = await syncCatalogue([product('p1', 'combo-900', ['SKU-A', 'SKU-A'])]);

    expect(result.productsActive).toBe(1);
    expect(result.productsQuarantined).toBe(0);
  });

  it('leaves an existing collision on sale and only alerts', async () => {
    // Exactly the live defect, and exactly the shape of the real catalogue:
    // a battery and a combo both on the combo's SKU, both already selling.
    // Withdrawing either one here would take a live product out of sale.
    const result = await syncCatalogue([
      product('prod_battery', 'battery-150', ['ITG-CMB-900VA-150AH']),
      product('prod_combo', 'combo-900-150', ['ITG-CMB-900VA-150AH']),
      product('prod_other', 'lithium-200', ['ITG-BAT-LI-200AH-12V']),
    ]);

    expect(result.productsQuarantined).toBe(0);
    expect(result.productsGrandfathered).toBe(1);
    expect(result.grandfathered).toEqual([
      { productId: 'prod_combo', reason: 'duplicate_sku', subject: 'ITG-CMB-900VA-150AH' },
    ]);

    // Both remain visible; the collision is recorded for a human.
    expect(await statusOf('prod_combo')).toBe('active');
    expect(await statusOf('prod_battery')).toBe('active');
    expect(await quarantinedProductIds()).toEqual(new Set());
    expect(await alertSubjects('duplicate_sku')).toEqual(['ITG-CMB-900VA-150AH']);
  });

  it('quarantines a NEW product that claims an established SKU', async () => {
    await syncCatalogue([product('prod_battery', 'battery-150', ['ITG-CMB-900VA-150AH'])]);

    // A product nobody has seen before turns up on that SKU. This is the
    // creation the constraint exists to refuse.
    const result = await syncCatalogue([
      product('prod_battery', 'battery-150', ['ITG-CMB-900VA-150AH']),
      product('prod_newarrival', 'combo-900-150', ['ITG-CMB-900VA-150AH']),
    ]);

    expect(result.productsQuarantined).toBe(1);
    expect(result.productsGrandfathered).toBe(0);
    expect(await statusOf('prod_newarrival')).toBe('quarantined');
    expect(await statusOf('prod_battery')).toBe('active');
    expect(await quarantinedProductIds()).toEqual(new Set(['prod_newarrival']));
  });

  it('does not withdraw a grandfathered product on later syncs', async () => {
    const catalogue = [
      product('prod_battery', 'battery-150', ['SHARED']),
      product('prod_combo', 'combo-900', ['SHARED']),
    ];

    await syncCatalogue(catalogue);
    await syncCatalogue(catalogue);
    await syncCatalogue(catalogue);

    // Still selling after three passes. A rule that only spares them once
    // would be a delayed outage rather than a safe one.
    expect(await statusOf('prod_battery')).toBe('active');
    expect(await statusOf('prod_combo')).toBe('active');
    expect(await quarantinedProductIds()).toEqual(new Set());
  });

  it('keeps a contested SKU with the incumbent across syncs', async () => {
    await syncCatalogue([product('prod_battery', 'battery-150', ['SHARED-SKU'])]);

    // A newcomer appears later carrying the same SKU. The incumbent already has
    // the claim — and may already have orders against it — so it must keep it.
    await syncCatalogue([
      product('prod_battery', 'battery-150', ['SHARED-SKU']),
      product('prod_newcomer', 'newcomer', ['SHARED-SKU']),
    ]);

    expect(await statusOf('prod_battery')).toBe('active');
    expect(await statusOf('prod_newcomer')).toBe('quarantined');

    const owner = await query<{ hostinger_product_id: string }>(
      `SELECT hostinger_product_id FROM catalogue_skus WHERE sku = 'SHARED-SKU'`,
    );
    expect(owner[0]?.hostinger_product_id).toBe('prod_battery');
  });

  it('alerts on an existing slug collision without hiding either product', async () => {
    // The failure that was previously silent: `.find()` returned the first
    // match and the second product was unreachable at /p/[slug]. It is now
    // reported, but not by withdrawing something that is already selling.
    const result = await syncCatalogue([
      product('prod_first', 'inverter-900va', ['SKU-1']),
      product('prod_second', 'inverter-900va', ['SKU-2']),
    ]);

    expect(result.quarantined).toEqual([]);
    expect(result.grandfathered).toEqual([
      { productId: 'prod_second', reason: 'duplicate_slug', subject: 'inverter-900va' },
    ]);
    expect(await statusOf('prod_second')).toBe('active');
    expect(await alertSubjects('duplicate_slug')).toEqual(['inverter-900va']);
  });

  it('quarantines a NEW product that claims an established slug', async () => {
    await syncCatalogue([product('prod_first', 'inverter-900va', ['SKU-1'])]);

    const result = await syncCatalogue([
      product('prod_first', 'inverter-900va', ['SKU-1']),
      product('prod_late', 'inverter-900va', ['SKU-2']),
    ]);

    expect(result.quarantined).toEqual([
      { productId: 'prod_late', reason: 'duplicate_slug', subject: 'inverter-900va' },
    ]);
    expect(await statusOf('prod_late')).toBe('quarantined');
  });

  it('is idempotent — re-syncing an unchanged catalogue changes nothing', async () => {
    const catalogue = [
      product('p1', 'inverter-900', ['SKU-A']),
      product('p2', 'battery-150', ['SKU-B', 'SKU-C']),
    ];

    await syncCatalogue(catalogue);
    const second = await syncCatalogue(catalogue);

    expect(second.productsActive).toBe(2);
    expect(second.productsQuarantined).toBe(0);
    expect(second.alertsRaised).toBe(0);

    const skus = await query<{ sku: string }>(`SELECT sku FROM catalogue_skus ORDER BY sku`);
    expect(skus.map((row) => row.sku)).toEqual(['SKU-A', 'SKU-B', 'SKU-C']);
  });

  it('marks a disappeared product removed rather than deleting it', async () => {
    await syncCatalogue([
      product('p1', 'inverter-900', ['SKU-A']),
      product('p2', 'battery-150', ['SKU-B']),
    ]);

    await syncCatalogue([product('p1', 'inverter-900', ['SKU-A'])]);

    // Orders still reference p2, and inventory_baseline may hold unreconciled
    // sales against it, so the row has to survive.
    const rows = await query<{ removed_at: Date | null }>(
      `SELECT removed_at FROM catalogue_products WHERE hostinger_product_id = 'p2'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].removed_at).not.toBeNull();
  });

  it('refuses an empty catalogue rather than removing everything', async () => {
    await syncCatalogue([product('p1', 'inverter-900', ['SKU-A'])]);

    await expect(syncCatalogue([])).rejects.toThrow(/returned no products/);
    expect(await statusOf('p1')).toBe('active');
  });

  it('raises and clears enrichment alerts as products are mapped', async () => {
    await syncCatalogue([
      product('unmapped_1', 'mystery', ['SKU-A']),
      product('p2', 'battery-150', ['SKU-B']),
    ]);
    expect(await alertSubjects('unmapped_enrichment')).toEqual(['unmapped_1']);

    // Once the merchant maps it, the alert resolves without being deleted.
    await syncCatalogue([
      product('mapped_1', 'mystery', ['SKU-A']),
      product('p2', 'battery-150', ['SKU-B']),
    ]);
    expect(await alertSubjects('unmapped_enrichment')).toEqual([]);
  });
});
