'use client';

import * as React from 'react';
import type { ProductSummary } from '@/lib/commerce/summary';
import { useRecentlyViewed } from '@/lib/store/hooks';
import { ProductRail } from '@/components/merch/product-rail';

/**
 * Recently viewed rail.
 *
 * History lives in local storage, so the summaries are fetched on the client.
 * Renders nothing until there are at least two products worth showing.
 */
export function RecentlyViewed({ excludeSlug }: { excludeSlug?: string }) {
  const { slugs } = useRecentlyViewed();
  const [products, setProducts] = React.useState<ProductSummary[]>([]);

  const wanted = React.useMemo(
    () => slugs.filter((slug) => slug !== excludeSlug).slice(0, 8),
    [slugs, excludeSlug],
  );

  React.useEffect(() => {
    if (wanted.length < 2) {
      setProducts([]);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/products?slugs=${wanted.join(',')}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: { products: ProductSummary[] }) => setProducts(data.products))
      .catch(() => setProducts([]));
    return () => controller.abort();
  }, [wanted]);

  if (products.length < 2) return null;

  return (
    <div className="container section-tight">
      <ProductRail products={products} eyebrow="Your history" title="Recently viewed" />
    </div>
  );
}
