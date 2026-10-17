import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createProductAction } from '@/lib/admin/product-actions';
import { CATEGORIES } from '@/lib/commerce/mock/categories';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'New product',
  robots: { index: false, follow: false },
};

/**
 * Create asks for identity and taxonomy, and nothing else.
 *
 * Everything a product page actually shows — specifications, media, warranty,
 * the seller block — is edited on the product itself, where each part has room
 * and its own save. A create form carrying all of it would be forty fields
 * before the first one could be checked, and would fail as a whole.
 *
 * What is here is the set that nothing else works without: the title and where
 * the product is filed. The internal key and the URL are derived from the title
 * by `createProductAction`, so they cannot be mistyped.
 */
export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const subcategories = CATEGORIES.flatMap((category) =>
    category.subcategories.map((sub) => ({
      value: sub.slug,
      label: `${category.name} · ${sub.name}`,
      category: category.slug,
    })),
  );

  return (
    <div className="container max-w-3xl py-8">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Products
      </Link>

      <h1 className="heading-2 mt-4">New product</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        It is created as a draft. Nothing reaches the storefront until it has a price, an image
        and a description, and you publish it.
      </p>

      {error ? (
        <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <form action={createProductAction} className="mt-6 grid gap-5">
        <Field
          label="Product name"
          htmlFor="title"
          required
          hint="As customers should see it, e.g. Trontek TK-LiFe-5145 Lithium Battery. The product page address is created from this automatically."
        >
          <Input
            id="title"
            name="title"
            required
            autoComplete="off"
            placeholder="e.g. Trontek TK-LiFe-5145 Lithium Battery"
          />
        </Field>

        <Field
          label="Subtitle"
          htmlFor="subtitle"
          hint="One line under the title, and the description used in search results."
        >
          <Input
            id="subtitle"
            name="subtitle"
            autoComplete="off"
            placeholder="e.g. 51.2V 45Ah LiFePO4 battery for electric two-wheelers"
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Brand" htmlFor="brand">
            <Input id="brand" name="brand" autoComplete="off" placeholder="e.g. Trontek" />
          </Field>
          <Field label="Model number" htmlFor="modelName">
            <Input
              id="modelName"
              name="modelName"
              autoComplete="off"
              placeholder="e.g. TK-LiFe-5145"
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Category" htmlFor="category" required>
            <Select id="category" name="category" defaultValue="batteries" required>
              {CATEGORIES.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Type"
            htmlFor="subcategory"
            required
            hint="Must belong to the category chosen on the left."
          >
            <Select id="subcategory" name="subcategory" defaultValue="ev-3-wheeler" required>
              {subcategories.map((sub) => (
                <option key={sub.value} value={sub.value}>
                  {sub.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Illustration"
          htmlFor="art"
          hint="Which generated illustration stands in until this product has its own images."
        >
          <Select id="art" name="art" defaultValue="battery">
            <option value="battery">Battery</option>
            <option value="inverter">Inverter</option>
            <option value="ups">UPS</option>
            <option value="combo">Combo</option>
          </Select>
        </Field>

        <div className="flex gap-3">
          <Button type="submit">Create draft</Button>
          <Link
            href="/admin/products"
            className="inline-flex h-11 items-center px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
