import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';
import { catalog } from '@/lib/commerce';
import { allProducts } from '@/lib/catalog/collections';

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
  ];

  const categoryRoutes: Route[] = categories.flatMap((category) => [
    { path: `/c/${category.slug}`, priority: 0.9 },
    ...category.subcategories.map((sub) => ({
      path: `/c/${category.slug}/${sub.slug}`,
      priority: 0.8,
    })),
  ]);

  // Products come from the active provider, so the sitemap never advertises a
  // URL the site cannot serve.
  const productRoutes: Route[] = products.map((product) => ({
    path: `/p/${product.slug}`,
    priority: 0.8,
    lastModified: new Date(product.launchedAt),
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes].map((route) => ({
    url: `${SITE.url}${route.path}`,
    lastModified: route.lastModified ?? new Date(),
    changeFrequency: 'weekly' as const,
    priority: route.priority,
  }));
}
