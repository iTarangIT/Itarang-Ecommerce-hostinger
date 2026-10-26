'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { invalidateCatalogSnapshot } from '@/lib/commerce';
import { CATALOG_TAG } from '@/lib/commerce/db/db-provider';
import { CATEGORIES_TAG } from '@/lib/catalog/category-store';
import {
  categoryInputSchema,
  createCategory,
  deleteCategory,
  updateCategory,
  type CategoryWriteResult,
} from '@/lib/catalog/category-admin';
import { logAdminEvent } from './audit';

/**
 * Category management. Each action re-checks the admin role (a Server Action
 * is its own POST endpoint) and reports back on the query string, like the
 * rest of the console's plain forms.
 */

const PAGE = '/admin/products/categories';

async function requireAdminActor(): Promise<string> {
  const user = await currentUser();
  if (!user || user.role !== 'admin') redirect(`/login?next=${encodeURIComponent(PAGE)}`);
  return user.email;
}

function finish(result: CategoryWriteResult, success: string): never {
  if (!result.ok) redirect(`${PAGE}?error=${encodeURIComponent(result.error)}`);
  // The menu, footer and category pages all read the categories, so the whole
  // storefront layout is refreshed, not just this page.
  invalidateCatalogSnapshot();
  revalidateTag(CATEGORIES_TAG);
  revalidateTag(CATALOG_TAG);
  revalidatePath('/', 'layout');
  redirect(`${PAGE}?notice=${encodeURIComponent(success)}`);
}

function parse(formData: FormData) {
  return categoryInputSchema.safeParse({
    ...Object.fromEntries(formData),
    isVisible: formData.get('isVisible') === 'on',
  });
}

export async function createCategoryAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const parsed = parse(formData);
  if (!parsed.success) {
    redirect(`${PAGE}?error=${encodeURIComponent(parsed.error.issues.map((i) => i.message).join(' '))}`);
  }
  const result = await createCategory(parsed.data);
  if (result.ok) await logCategory(actor, 'Created category', parsed.data.slug, parsed.data.name);
  finish(result, `Added “${parsed.data.name}”.`);
}

export async function updateCategoryAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const parsed = parse(formData);
  if (!parsed.success) {
    redirect(`${PAGE}?error=${encodeURIComponent(parsed.error.issues.map((i) => i.message).join(' '))}`);
  }
  const result = await updateCategory(parsed.data);
  if (result.ok) await logCategory(actor, 'Edited category', parsed.data.slug, parsed.data.name);
  finish(result, `Saved “${parsed.data.name}”.`);
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const slug = String(formData.get('slug') ?? '').trim();
  if (!slug) redirect(PAGE);
  const result = await deleteCategory(slug);
  if (result.ok) await logCategory(actor, 'Deleted category', slug, slug);
  finish(result, 'Category deleted.');
}

async function logCategory(actor: string, action: string, slug: string, name: string): Promise<void> {
  await logAdminEvent({ entityType: 'category', entityId: slug, label: name, action, actor });
}
