import { z } from 'zod';
import { query, queryOne } from '@/lib/db/pool';
import { listCategoryRows, type CategoryRow } from './category-store';

/**
 * Writes behind /admin/products/categories.
 *
 * The slug is fixed once created: products store it as plain text in
 * `products.category` / `products.subcategory`, so renaming it would orphan
 * them. The name, description, order and visibility are what an admin edits.
 */

export const CATEGORY_ICONS = ['battery', 'charger', 'inverter', 'ups', 'combo'] as const;

const blankToNull = (value: string | undefined) => (value ? value : null);

export const categoryInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Enter a URL name.')
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'URL name: lower-case words separated by single hyphens, e.g. two-wheeler-batteries.'),
  parentSlug: z.string().trim().optional().transform(blankToNull),
  name: z.string().trim().min(1, 'Enter a name.').max(80),
  shortName: z.string().trim().max(40).optional().transform(blankToNull),
  tagline: z.string().trim().max(200).optional().transform(blankToNull),
  description: z.string().trim().max(1000).optional().default(''),
  icon: z.enum(CATEGORY_ICONS).optional().default('battery'),
  sortOrder: z.coerce.number().int().min(-1000).max(100_000).optional().default(0),
  isVisible: z.boolean().default(true),
});

export type CategoryInput = z.output<typeof categoryInputSchema>;

export type CategoryWriteResult = { ok: true } | { ok: false; error: string };

/** How many products are filed under each category or subcategory slug. */
export async function productCountsBySlug(): Promise<Map<string, number>> {
  const rows = await query<{ slug: string; count: string }>(
    `SELECT category AS slug, count(*)::text AS count FROM products GROUP BY category
     UNION ALL
     SELECT subcategory AS slug, count(*)::text AS count FROM products GROUP BY subcategory`,
  );
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.slug, (counts.get(row.slug) ?? 0) + Number(row.count));
  return counts;
}

export async function listCategoriesForAdmin(): Promise<CategoryRow[]> {
  return listCategoryRows();
}

async function parentError(parentSlug: string | null, slug: string): Promise<string | null> {
  if (!parentSlug) return null;
  if (parentSlug === slug) return 'A category cannot sit under itself.';
  const parent = await queryOne<{ parent_slug: string | null }>(
    'SELECT parent_slug FROM catalog_categories WHERE slug = $1',
    [parentSlug],
  );
  if (!parent) return 'That parent category does not exist.';
  // Two levels only: the storefront URL is /category/subcategory.
  if (parent.parent_slug) return 'A subcategory can only sit under a top-level category.';
  return null;
}

export async function createCategory(input: CategoryInput): Promise<CategoryWriteResult> {
  const invalidParent = await parentError(input.parentSlug, input.slug);
  if (invalidParent) return { ok: false, error: invalidParent };

  try {
    await query(
      `INSERT INTO catalog_categories
         (slug, parent_slug, name, short_name, tagline, description, icon, sort_order, is_visible)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        input.slug,
        input.parentSlug,
        input.name,
        input.shortName,
        input.tagline,
        input.description,
        input.icon,
        input.sortOrder,
        input.isVisible,
      ],
    );
    return { ok: true };
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      return { ok: false, error: `The URL name "${input.slug}" is already used by another category.` };
    }
    throw error;
  }
}

/** Everything but the slug and the parent, which products depend on. */
export async function updateCategory(input: CategoryInput): Promise<CategoryWriteResult> {
  const rows = await query<{ slug: string }>(
    `UPDATE catalog_categories
        SET name = $2, short_name = $3, tagline = $4, description = $5, icon = $6,
            sort_order = $7, is_visible = $8, updated_at = now()
      WHERE slug = $1
      RETURNING slug`,
    [
      input.slug,
      input.name,
      input.shortName,
      input.tagline,
      input.description,
      input.icon,
      input.sortOrder,
      input.isVisible,
    ],
  );
  return rows.length ? { ok: true } : { ok: false, error: 'That category no longer exists.' };
}

/**
 * Delete only an empty category: no products filed under it, no subcategories.
 * Hiding is the safe way to take a section with products off the menu.
 */
export async function deleteCategory(slug: string): Promise<CategoryWriteResult> {
  const used = await queryOne<{ count: string }>(
    'SELECT count(*)::text AS count FROM products WHERE category = $1 OR subcategory = $1',
    [slug],
  );
  const products = Number(used?.count ?? 0);
  if (products > 0) {
    return {
      ok: false,
      error: `${products} product${products === 1 ? ' is' : 's are'} filed under it. Move them first, or hide the category instead.`,
    };
  }
  const children = await queryOne<{ count: string }>(
    'SELECT count(*)::text AS count FROM catalog_categories WHERE parent_slug = $1',
    [slug],
  );
  if (Number(children?.count ?? 0) > 0) {
    return { ok: false, error: 'Delete or move its subcategories first.' };
  }
  const rows = await query<{ slug: string }>(
    'DELETE FROM catalog_categories WHERE slug = $1 RETURNING slug',
    [slug],
  );
  return rows.length ? { ok: true } : { ok: false, error: 'That category no longer exists.' };
}
