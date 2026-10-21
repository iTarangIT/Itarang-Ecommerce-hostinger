import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';
import { catalog } from '@/lib/commerce';
import { allProducts } from '@/lib/catalog/collections';
import { categoryPath, productPath, subcategoryPath } from '@/lib/routes';
import { ALL_POSTS, postPath } from '@/lib/blog';
import { specSheetPath } from '@/lib/downloads/spec-sheets';

interface Route {
  path: string;
  priority: number;
  lastModified?: Date;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([catalog().listCategories(), allProducts()]);

  const staticRoutes: Route[] = [
    { path: '/', priority: 1 },
    { path: '/offers', priority: 0.7 },
    { path: '/tools/load-calculator', priority: 0.8 },
    { path: '/support', priority: 0.7 },
    { path: '/support/faq', priority: 0.7 },
    { path: '/support/warranty-registration', priority: 0.5 },
    { path: '/support/installation', priority: 0.5 },
    { path: '/support/complaint', priority: 0.5 },
    { path: '/support/dealers', priority: 0.5 },
    { path: '/track', priority: 0.5 },
    { path: '/products', priority: 0.8 },
    { path: '/pricing', priority: 0.8 },
    { path: '/tools/mobility-calculator', priority: 0.8 },
    { path: '/downloads', priority: 0.5 },
    { path: '/blog', priority: 0.6 },
    { path: '/support/grievance', priority: 0.3 },
    { path: '/policies/refund', priority: 0.3 },
    { path: '/policies/payment-failure', priority: 0.3 },
  ];

  const categoryRoutes: Route[] = categories.flatMap((category) => [
    { path: categoryPath(category.slug), priority: 0.9 },
    ...category.subcategories.map((sub) => ({
      path: subcategoryPath(category.slug, sub.slug),
      priority: 0.8,
    })),
  ]);

  // Products come from the active provider, so the sitemap never advertises a
  // URL the site cannot serve.
  const productRoutes: Route[] = products.map((product) => ({
    path: productPath(product.slug),
    priority: 0.8,
    lastModified: new Date(product.launchedAt),
  }));

  const blogRoutes: Route[] = ALL_POSTS.map((post) => ({
    path: postPath(post.slug),
    priority: 0.6,
    lastModified: new Date(post.date),
  }));

  const specRoutes: Route[] = products.map((product) => ({
    path: specSheetPath(product.slug),
    priority: 0.4,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes, ...blogRoutes, ...specRoutes].map((route) => ({
    url: `${SITE.url}${route.path}`,
    lastModified: route.lastModified ?? new Date(),
    changeFrequency: 'weekly' as const,
    priority: route.priority,
  }));
}
