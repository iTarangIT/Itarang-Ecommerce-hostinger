import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/lib/commerce/mock/categories';
import { buildCategoryTree, categoryPairError, type CategoryRow } from './category-store';

function row(patch: Partial<CategoryRow> & Pick<CategoryRow, 'slug'>): CategoryRow {
  return {
    parent_slug: null,
    name: patch.slug,
    short_name: null,
    tagline: null,
    description: '',
    icon: 'battery',
    seo_copy: [],
    highlights: [],
    sort_order: 0,
    is_visible: true,
    ...patch,
  };
}

const ROWS: CategoryRow[] = [
  row({ slug: 'chargers', name: 'Chargers', sort_order: 20, icon: 'charger' }),
  row({ slug: 'batteries', name: 'Batteries', sort_order: 10 }),
  row({ slug: 'ev-2-wheeler', parent_slug: 'batteries', name: '2W', sort_order: 20 }),
  row({ slug: 'ev-3-wheeler', parent_slug: 'batteries', name: '3W', sort_order: 10 }),
  row({ slug: 'ev-chargers', parent_slug: 'chargers', name: 'EV chargers' }),
  row({ slug: 'inverters', name: 'Inverters', sort_order: 30, icon: 'inverter', description: 'Sine-wave inverters.' }),
  row({ slug: 'home-inverters', parent_slug: 'inverters', name: 'Home inverters' }),
  row({ slug: 'old-stuff', name: 'Old stuff', is_visible: false }),
];

describe('buildCategoryTree', () => {
  const tree = buildCategoryTree(ROWS);

  it('orders categories and subcategories by sort order', () => {
    expect(tree.map((c) => c.slug)).toEqual(['batteries', 'chargers', 'inverters']);
    expect(tree[0]?.subcategories.map((s) => s.slug)).toEqual(['ev-3-wheeler', 'ev-2-wheeler']);
  });

  it('leaves hidden rows out of the storefront, but not out of the admin options', () => {
    expect(tree.some((c) => c.slug === 'old-stuff')).toBe(false);
    expect(buildCategoryTree(ROWS, { includeHidden: true }).some((c) => c.slug === 'old-stuff')).toBe(true);
  });

  it('keeps the built-in editorial copy for the original categories', () => {
    const builtIn = CATEGORIES.find((c) => c.slug === 'batteries')!;
    const batteries = tree.find((c) => c.slug === 'batteries')!;
    expect(batteries.seoCopy).toEqual(builtIn.seoCopy);
    expect(batteries.facetIds).toEqual(builtIn.facetIds);
    expect(batteries.highlights).toEqual(builtIn.highlights);
    // The name comes from the row: that is what an admin edits.
    expect(batteries.name).toBe('Batteries');
  });

  it('gives a category added in the admin panel working defaults', () => {
    const inverters = tree.find((c) => c.slug === 'inverters')!;
    expect(inverters.icon).toBe('inverter');
    expect(inverters.shortName).toBe('Inverters');
    expect(inverters.tagline).toBe('Sine-wave inverters.');
    expect(inverters.facetIds).toContain('subcategory');
    expect(inverters.facetIds).not.toContain('category');
    expect(inverters.subcategories.map((s) => s.slug)).toEqual(['home-inverters']);
  });
});

describe('categoryPairError', () => {
  const tree = buildCategoryTree(ROWS);

  it('accepts a subcategory under its own category, chargers included', () => {
    expect(categoryPairError(tree, 'batteries', 'ev-2-wheeler')).toBeNull();
    expect(categoryPairError(tree, 'chargers', 'ev-chargers')).toBeNull();
  });

  it('refuses an unknown category and a subcategory from another category', () => {
    expect(categoryPairError(tree, 'ups', 'ev-chargers')).toMatch(/Unknown category/);
    expect(categoryPairError(tree, 'chargers', 'ev-2-wheeler')).toMatch(/not a subcategory/);
  });
});
