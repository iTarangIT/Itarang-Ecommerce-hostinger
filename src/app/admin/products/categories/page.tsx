import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from '@/lib/admin/category-actions';
import {
  CATEGORY_ICONS,
  listCategoriesForAdmin,
  productCountsBySlug,
} from '@/lib/catalog/category-admin';
import type { CategoryRow } from '@/lib/catalog/category-store';
import { categoryPath, subcategoryPath } from '@/lib/routes';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { Notice } from '@/components/admin/service-nav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Categories',
  robots: { index: false, follow: false },
};

/**
 * Product categories, as the storefront's "All products" menu shows them.
 *
 * A top-level category is a URL like /batteries; a subcategory sits under one
 * (/batteries/ev-2-wheeler). The menu only shows a section once at least one
 * published product is filed under it, so a new category can be prepared here
 * before its first product goes live.
 */
export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const search = await searchParams;
  const [rows, counts] = await Promise.all([listCategoriesForAdmin(), productCountsBySlug()]);
  const parents = rows.filter((row) => row.parent_slug === null);

  return (
    <div className="container max-w-5xl py-8">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Products
      </Link>
      <h1 className="heading-2 mt-4">Categories</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        What the storefront&rsquo;s <strong>All products</strong> menu lists. A category or
        subcategory appears in the menu once a published product is filed under it. Hide one to take
        it off the menu without touching its products; delete only works on an empty one.
      </p>
      <Notice text={search.notice} />
      <Notice text={search.error} tone="error" />

      <div className="mt-6 space-y-5">
        {parents.map((parent) => {
          const children = rows.filter((row) => row.parent_slug === parent.slug);
          return (
            <section key={parent.slug} className="rounded-lg border border-border bg-card">
              <CategoryEditor row={parent} count={counts.get(parent.slug) ?? 0} href={categoryPath(parent.slug)} />
              <ul className="divide-y divide-border border-t border-border">
                {children.map((child) => (
                  <li key={child.slug} className="pl-6">
                    <CategoryEditor
                      row={child}
                      count={counts.get(child.slug) ?? 0}
                      href={subcategoryPath(parent.slug, child.slug)}
                    />
                  </li>
                ))}
                {children.length === 0 ? (
                  <li className="px-6 py-3 text-sm text-muted-foreground">
                    No subcategories yet. A product needs one to be filed here.
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>

      <form
        action={createCategoryAction}
        className="mt-8 space-y-4 rounded-lg border border-border bg-card p-5"
      >
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide">
          Add a category or subcategory
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="new-name" required>
            <Input id="new-name" name="name" required placeholder="e.g. Inverters" />
          </Field>
          <Field
            label="URL name"
            htmlFor="new-slug"
            required
            hint="Lower-case words with hyphens. Cannot be changed later."
          >
            <Input id="new-slug" name="slug" required placeholder="e.g. inverters" pattern="[a-z0-9]+(-[a-z0-9]+)*" />
          </Field>
          <Field label="Sits under" htmlFor="new-parent" hint="Leave as “Top level” for a new main category.">
            <Select id="new-parent" name="parentSlug" defaultValue="">
              <option value="">Top level</option>
              {parents.map((parent) => (
                <option key={parent.slug} value={parent.slug}>
                  {parent.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Icon" htmlFor="new-icon">
            <Select id="new-icon" name="icon" defaultValue="battery">
              {CATEGORY_ICONS.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" htmlFor="new-description" className="sm:col-span-2">
            <Textarea id="new-description" name="description" rows={2} placeholder="One or two sentences shown on the category page." />
          </Field>
          <Field label="Order" htmlFor="new-sort" hint="Lower numbers come first.">
            <Input id="new-sort" name="sortOrder" type="number" defaultValue={100} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-3 text-sm">
            <Checkbox name="isVisible" defaultChecked />
            Show in the menu
          </label>
        </div>
        <Button type="submit">Add</Button>
      </form>
    </div>
  );
}

function CategoryEditor({ row, count, href }: { row: CategoryRow; count: number; href: string }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
        {row.is_visible ? (
          <Eye className="h-4 w-4 text-success" aria-label="Shown" />
        ) : (
          <EyeOff className="h-4 w-4 text-muted-foreground" aria-label="Hidden" />
        )}
        <span className="font-medium text-foreground">{row.name}</span>
        <span className="text-xs text-muted-foreground">{href}</span>
        <span className="tabular ml-auto text-xs text-muted-foreground">
          {count} product{count === 1 ? '' : 's'} · order {row.sort_order}
        </span>
        <span className="text-xs font-medium text-primary group-open:hidden">Edit</span>
      </summary>
      <div className="space-y-3 border-t border-border px-4 py-4">
        <form action={updateCategoryAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="slug" value={row.slug} />
          <Field label="Name" htmlFor={`name-${row.slug}`} required>
            <Input id={`name-${row.slug}`} name="name" defaultValue={row.name} required />
          </Field>
          <Field label="Short name" htmlFor={`short-${row.slug}`} hint="Used where space is tight.">
            <Input id={`short-${row.slug}`} name="shortName" defaultValue={row.short_name ?? ''} />
          </Field>
          <Field label="Description" htmlFor={`desc-${row.slug}`} className="sm:col-span-2">
            <Textarea id={`desc-${row.slug}`} name="description" rows={2} defaultValue={row.description} />
          </Field>
          <Field label="Tagline" htmlFor={`tag-${row.slug}`} className="sm:col-span-2">
            <Input id={`tag-${row.slug}`} name="tagline" defaultValue={row.tagline ?? ''} />
          </Field>
          <Field label="Icon" htmlFor={`icon-${row.slug}`}>
            <Select id={`icon-${row.slug}`} name="icon" defaultValue={row.icon}>
              {CATEGORY_ICONS.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Order" htmlFor={`sort-${row.slug}`} hint="Lower numbers come first.">
            <Input id={`sort-${row.slug}`} name="sortOrder" type="number" defaultValue={row.sort_order} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="isVisible" defaultChecked={row.is_visible} />
            Show in the menu
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm">
              Save
            </Button>
          </div>
        </form>
        {count === 0 ? (
          <form action={deleteCategoryAction}>
            <input type="hidden" name="slug" value={row.slug} />
            <Button type="submit" size="sm" variant="ghost" className="text-destructive">
              Delete
            </Button>
          </form>
        ) : null}
      </div>
    </details>
  );
}
