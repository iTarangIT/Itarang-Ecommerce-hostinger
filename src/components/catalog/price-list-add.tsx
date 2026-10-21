'use client';

import { ShoppingCart } from 'lucide-react';
import type { ProductSummary } from '@/lib/commerce/summary';
import { PURCHASE_ENABLED } from '@/lib/commerce/purchase';
import { summaryToCartItem, useCart } from '@/lib/store/hooks';
import { useUI } from '@/lib/store/ui-provider';
import { track } from '@/lib/analytics/track';
import { Button } from '@/components/ui/button';

/** Add-to-cart for one row of the price list — the same path a product card uses. */
export function PriceListAdd({ product }: { product: ProductSummary }) {
  const cart = useCart();
  const { toast, open } = useUI();

  if (!PURCHASE_ENABLED || product.availability === 'out-of-stock' || product.hasOptions) {
    return null;
  }

  return (
    <Button
      size="sm"
      variant="outline"
      aria-label={`Add ${product.title} to cart`}
      onClick={() => {
        cart.addItem(summaryToCartItem(product));
        track('add_to_cart', { productId: product.id, quantity: 1, dedupe: String(Date.now()) });
        toast({
          title: 'Added to cart',
          description: product.title,
          tone: 'success',
          action: { label: 'View cart', onClick: () => open('cart') },
        });
      }}
    >
      <ShoppingCart className="h-4 w-4" />
      <span className="hidden sm:inline">Add</span>
    </Button>
  );
}
