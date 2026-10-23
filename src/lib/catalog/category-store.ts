import { unstable_cache } from 'next/cache';
import { query } from '@/lib/db/pool';
import { isDatabaseUnavailable } from '@/lib/db/errors';
import { CATEGORIES, CATEGORY_BY_SLUG } from '@/lib/commerce/mock/categories';
import type { Category, CategoryIconKind, Subcategory } from '@/lib/commerce/types';
import { SEARCH_FACET_IDS } from '@/lib/catalog/engine';
import { registerCategoryNames } from '@/lib/catalog/category-names';

/**
 * Categories from `catalog_categories` (migration 0023), edited at
 * /admin/categories.
 *
 * The rows hold what an admin can change — name, description, order, whether
 * the section is shown. The long editorial passages (SEO copy, highlights, the
 * filter set) stay in `mock/categories.ts`; a blank array in the row means
 * "use the built-in copy for this slug if there is any", so a category added
 * from the admin panel works with a name and a description alone.
 *
 * If the table is missing (migration not yet applied) or the database is
 * unreachable, the built-in list is served instead: navigation must never take
 * the whole storefront down.
 */

/** Filed under its own tag and the catalogue's, so either purge refreshes it. */
export const CATEGORIES_TAG = 'categories';

export interface CategoryRow {
  slug: string;
  parent_slug: string | null;
  name: string;
  short_name: string | null;
  tagline: string | null;
  description: string;
  icon: string;
  seo_copy: string[];
  highlights: string[];
  sort_order: number;
  is_visible: boolean;
}

const ICONS: ReadonlySet<CategoryIconKind> = new Set([
  'battery',
  'charger',
  'inverter',
  'ups',
  'combo',
]);

function iconOf(value: string): CategoryIconKind {
  return ICONS.has(value as CategoryIconKind) ? (value as CategoryIconKind) : 'battery';
}

const bySortThenName = (a: CategoryRow, b: CategoryRow) =>
  a.sort_order - b.sort_order || a.name.localeCompare(b.name);

/**
 * Rows → the `Category[]` shape the storefront already uses. Pure, so it is
 * tested without a database. Hidden rows are dropped unless `includeHidden`.
 */
export function buildCategoryTree(
  rows: readonly CategoryRow[],
  { includeHidden = false }: { includeHidden?: boolean } = {},
): Category[] {
  const shown = rows.filter((row) => includeHidden || row.is_visible);
  const parents = shown.filter((row) => row.parent_slug === null).sort(bySortThenName);

  return parents.map((row) => {
    const builtIn = CATEGORY_BY_SLUG.get(row.slug);
    const subcategories: Subcategory[] = shown
      .filter((sub) => sub.parent_slug === row.slug)
      .sort(bySortThenName)
      .map((sub) => {
        const builtInSub = builtIn?.subcategories.find((s) => s.slug === sub.slug);
        return {
          slug: sub.slug,
          name: sub.name,
          description: sub.description || builtInSub?.description || '',
          seoCopy: sub.seo_copy.length ? sub.seo_copy : (builtInSub?.seoCopy ?? []),
        };
      });

    return {
      slug: row.slug,
      name: row.name,
      shortName: row.short_name || row.name,
      tagline: row.tagline || builtIn?.tagline || row.description,
      description: row.description || builtIn?.description || '',
      seoCopy: row.seo_copy.length ? row.seo_copy : (builtIn?.seoCopy ?? []),
      icon: iconOf(row.icon),
      subcategories,
      facetIds: builtIn?.facetIds ?? SEARCH_FACET_IDS.filter((id) => id !== 'category'),
      highlights: row.highlights.length ? row.highlights : (builtIn?.highlights ?? []),
    };
  });
}

export async function listCategoryRows(): Promise<CategoryRow[]> {
  return query<CategoryRow>(
    `SELECT slug, parent_slug, name, short_name, tagline, description, icon,
            seo_copy, highlights, sort_order, is_visible
       FROM catalog_categories
      ORDER BY parent_slug NULLS FIRST, sort_order, name`,
  );
}

const cachedRows = unstable_cache(listCategoryRows, ['catalog-categories'], {
  tags: [CATEGORIES_TAG, 'catalog'],
});

/** `42P01` is "relation does not exist": the migration has not been run yet. */
function isMissingTable(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '42P01';
}

/** Visible categories for the storefront, with the built-in list as fallback. */
export async function loadCategories(): Promise<Category[]> {
  try {
    const rows = await cachedRows();
    if (rows.length === 0) return CATEGORIES;
    registerCategoryNames(rows);
    return buildCategoryTree(rows);
  } catch (error) {
    if (isMissingTable(error) || isDatabaseUnavailable(error)) return CATEGORIES;
    throw error;
  }
}

/**
 * Every category and subcategory slug a product may be filed under, hidden ones
 * included — hiding a section from the menu must not stop an admin editing the
 * products inside it.
 */
export async function loadCategoryOptions(): Promise<Category[]> {
  try {
    const rows = await listCategoryRows();
    if (rows.length === 0) return CATEGORIES;
    return buildCategoryTree(rows, { includeHidden: true });
  } catch (error) {
    if (isMissingTable(error) || isDatabaseUnavailable(error)) return CATEGORIES;
    throw error;
  }
}

/**
 * Why a category/subcategory pair cannot be saved on a product, or null.
 *
 * Replaces a hardcoded `z.enum` in the product form that still listed the four
 * original categories, so a charger could not be saved at all.
 */
export function categoryPairError(
  categories: readonly Category[],
  category: string,
  subcategory: string,
): string | null {
  const parent = categories.find((c) => c.slug === category);
  if (!parent) return `Unknown category "${category}". Add it under Categories first.`;
  if (!parent.subcategories.some((s) => s.slug === subcategory)) {
    return `"${subcategory}" is not a subcategory of ${parent.name}.`;
  }
  return null;
}
