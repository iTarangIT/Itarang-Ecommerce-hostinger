import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { catalog } from '@/lib/commerce';
import type { SearchParamsInput } from '@/lib/catalog/query';
import { CategoryView, categoryMetadata } from '@/components/catalog/category-view';

interface PageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<SearchParamsInput>;
}

/**
 * The taxonomy is a fixed, local set, so every valid path is known at build
 * time and `generateStaticParams` below still prerenders all of them.
 *
 * `dynamicParams: true` matches `/products/[slug]` rather than differing from it.
 * These pages read the same tagged catalogue cache, so an admin save purges
 * them too, and with `false` a purged entry cannot be regenerated — the route
 * would answer `NoFallbackError` for a category that plainly exists. An
 * unknown category still reaches `notFound()` below.
 */
export const dynamicParams = true;

export async function generateStaticParams() {
  const categories = await catalog().listCategories();
  return categories.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await catalog().getCategory(slug);
  if (!category) return { title: 'Not found' };
  return categoryMetadata(category, null);
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { category: slug } = await params;
  const [category, allCategories, resolvedSearchParams] = await Promise.all([
    catalog().getCategory(slug),
    catalog().listCategories(),
    searchParams,
  ]);

  if (!category) notFound();

  return (
    <CategoryView
      category={category}
      subcategory={null}
      searchParams={resolvedSearchParams}
      allCategories={allCategories}
    />
  );
}
