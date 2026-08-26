import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from './types';

/**
 * These cover the two drifts an admin has no other way to notice: an enrichment
 * entry that has stopped matching, and two products sharing a SKU.
 *
 * Both are reported rather than repaired — the storefront cannot invent a
 * merchant's specifications, and it must not silently rewrite a SKU an order
 * item has already snapshotted.
 */

const listProducts = vi.fn();
const inspect = vi.fn();
const providerName = { value: 'hostinger' };

vi.mock('@/lib/catalog/collections', () => ({
  allProducts: () => listProducts(),
}));

vi.mock('.', () => ({
  catalog: () => ({
    get name() {
      return providerName.value;
    },
    ...(providerName.value === 'hostinger' ? { inspect } : {}),
  }),
}));

function product(id: string, skus: string[]): Product {
  return {
    id,
    variants: skus.map((sku, i) => ({ id: `${id}-v${i}`, sku })),
  } as unknown as Product;
}

async function health() {
  // Imported per test so `cache()` never serves one test's result to another.
  vi.resetModules();
  const { catalogHealth } = await import('./health');
  return catalogHealth();
}

beforeEach(() => {
  vi.clearAllMocks();
  providerName.value = 'hostinger';
  inspect.mockResolvedValue({ count: 0, unmapped: [], fetchedAt: 1_700_000_000_000 });
});

describe('catalogHealth', () => {
  it('reports nothing when the catalogue is clean', async () => {
    listProducts.mockResolvedValue([product('p1', ['SKU-A']), product('p2', ['SKU-B'])]);

    const result = await health();

    expect(result.unmapped).toEqual([]);
    expect(result.duplicateSkus).toEqual([]);
    expect(result.total).toBe(2);
  });

  it('flags a SKU carried by two different products', async () => {
    // Exactly the live defect: a battery and a combo both on the combo's SKU.
    listProducts.mockResolvedValue([
      product('prod_battery', ['ITG-CMB-900VA-150AH']),
      product('prod_combo', ['ITG-CMB-900VA-150AH']),
      product('prod_other', ['ITG-BAT-LI-200AH-12V']),
    ]);

    const result = await health();

    expect(result.duplicateSkus).toEqual([
      { sku: 'ITG-CMB-900VA-150AH', productIds: ['prod_battery', 'prod_combo'] },
    ]);
  });

  it('does not flag one product whose variants share a SKU', async () => {
    // Normal: several variants of the same product on one SKU.
    listProducts.mockResolvedValue([product('p1', ['SKU-A', 'SKU-A'])]);

    const result = await health();

    expect(result.duplicateSkus).toEqual([]);
  });

  it('surfaces the ids the provider reports as unenriched', async () => {
    listProducts.mockResolvedValue([product('p1', ['SKU-A'])]);
    inspect.mockResolvedValue({
      count: 1,
      unmapped: ['prod_new_id_1', 'prod_new_id_2'],
      fetchedAt: 1_700_000_000_000,
    });

    const result = await health();

    expect(result.unmapped).toEqual(['prod_new_id_1', 'prod_new_id_2']);
    expect(result.fetchedAt).toBe(1_700_000_000_000);
  });

  it('degrades cleanly on a provider with no snapshot to inspect', async () => {
    providerName.value = 'mock';
    listProducts.mockResolvedValue([product('p1', ['SKU-A'])]);

    const result = await health();

    expect(result.provider).toBe('mock');
    expect(result.unmapped).toEqual([]);
    expect(result.fetchedAt).toBeNull();
    expect(inspect).not.toHaveBeenCalled();
  });
});
