import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { catalog } from '@/lib/commerce';
import type { SearchParamsInput } from '@/lib/catalog/query';
import { CategoryView, categoryMetadata } from '@/components/catalog/category-view';

interface PageProps {
  params: Promise<{ category: string; sub: string }>;
  searchParams: Promise<SearchParamsInput>;
}

/** Same reasoning as the parent category route. */
export const dynamicParams = true;

export async function generateStaticParams() {
  const categories = await catalog().listCategories();
  return categories.flatMap((category) =>
    category.subcategories.map((sub) => ({ category: category.slug, sub: sub.slug })),
  );
}

async function resolve(slug: string, subSlug: string) {
  const category = await catalog().getCategory(slug);
  if (!category) return null;
  const subcategory = category.subcategories.find((s) => s.slug === subSlug);
  if (!subcategory) return null;
  return { category, subcategory };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: slug, sub } = await params;
  const resolved = await resolve(slug, sub);
  if (!resolved) return { title: 'Not found' };
  return categoryMetadata(resolved.category, resolved.subcategory);
}

export default async function SubcategoryPage({ params, searchParams }: PageProps) {
  const { category: slug, sub } = await params;
  const [resolved, allCategories, resolvedSearchParams] = await Promise.all([
    resolve(slug, sub),
    catalog().listCategories(),
    searchParams,
  ]);

  if (!resolved) notFound();

  return (
    <CategoryView
      category={resolved.category}
      subcategory={resolved.subcategory}
      searchParams={resolvedSearchParams}
      allCategories={allCategories}
    />
  );
}
