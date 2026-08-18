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
 * time. `dynamicParams: false` turns an unknown category into a routing-level
 * 404 rather than a soft 404 rendered with HTTP 200.
 */
export const dynamicParams = false;

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
