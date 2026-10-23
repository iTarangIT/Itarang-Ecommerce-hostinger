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
  await requireAdminActor();
  const parsed = parse(formData);
  if (!parsed.success) {
    redirect(`${PAGE}?error=${encodeURIComponent(parsed.error.issues.map((i) => i.message).join(' '))}`);
  }
  finish(await createCategory(parsed.data), `Added “${parsed.data.name}”.`);
}

export async function updateCategoryAction(formData: FormData): Promise<void> {
  await requireAdminActor();
  const parsed = parse(formData);
  if (!parsed.success) {
    redirect(`${PAGE}?error=${encodeURIComponent(parsed.error.issues.map((i) => i.message).join(' '))}`);
  }
  finish(await updateCategory(parsed.data), `Saved “${parsed.data.name}”.`);
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  await requireAdminActor();
  const slug = String(formData.get('slug') ?? '').trim();
  if (!slug) redirect(PAGE);
  finish(await deleteCategory(slug), 'Category deleted.');
}
