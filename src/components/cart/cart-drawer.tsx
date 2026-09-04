'use client';

import * as React from 'react';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import type { ProductSummary } from '@/lib/commerce/summary';
import { PURCHASE_ENABLED } from '@/lib/commerce/purchase';
import { useCart } from '@/lib/store/hooks';
import { useUI } from '@/lib/store/ui-provider';
import { Drawer } from '@/components/ui/overlay';
import { ButtonLink } from '@/components/ui/button';
import { ProductCard } from '@/components/product/product-card';
import { CartLineItem, FreeShipMeter, OrderSummary } from './cart-pieces';
import { categoryPath } from '@/lib/routes';

/**
 * Cart drawer — the default cart surface.
 *
 * Cross-sell is fetched lazily and only when the drawer is opened with items in
 * it, so the recommendation query never runs on a cold page load.
 */
export function CartDrawer() {
  const { overlay, close } = useUI();
  const cart = useCart();
  const open = overlay === 'cart';

  const [crossSell, setCrossSell] = React.useState<ProductSummary[]>([]);

  const categories = React.useMemo(
    () => Array.from(new Set(cart.items.map((i) => i.category))).join(','),
    [cart.items],
  );

  React.useEffect(() => {
    if (!open || cart.items.length === 0) return;
    const controller = new AbortController();
    const exclude = cart.items.map((i) => i.productId).join(',');
    fetch(`/api/cross-sell?categories=${categories}&exclude=${exclude}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data: { products: ProductSummary[] }) => setCrossSell(data.products))
      .catch(() => setCrossSell([]));
    return () => controller.abort();
  }, [open, categories, cart.items]);

  const isEmpty = cart.items.length === 0;

  return (
    <Drawer
      open={open}
      onClose={close}
      title="Your cart"
      description={
        isEmpty
          ? undefined
          : `${cart.totals.itemCount} ${cart.totals.itemCount === 1 ? 'item' : 'items'}`
      }
      footer={
        isEmpty ? undefined : (
          <div className="space-y-3">
            <OrderSummary totals={cart.totals} showGst />
            <ButtonLink href="/cart" variant="accent" size="lg" fullWidth onClick={close}>
              {/* Purchase is switched off site-wide; see lib/commerce/purchase.ts. */}
              {PURCHASE_ENABLED ? 'Review cart & checkout' : 'Review cart'}
            </ButtonLink>
            <button
              type="button"
              onClick={close}
              className="w-full text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Continue shopping
            </button>
          </div>
        )
      }
    >
      {isEmpty ? (
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-secondary text-primary">
            <ShoppingBag className="h-7 w-7" />
          </span>
          <h3 className="mt-4 font-display text-lg font-bold text-card-foreground">
            Your cart is empty
          </h3>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            Add an inverter, a battery or a ready-matched combo — or size a system from the
            appliances you actually run.
          </p>
          <div className="mt-6 flex w-full flex-col gap-2">
            <ButtonLink href={categoryPath('combos')} variant="primary" fullWidth onClick={close}>
              Shop combos
            </ButtonLink>
            <ButtonLink
              href="/tools/load-calculator"
              variant="outline"
              fullWidth
              onClick={close}
            >
              Open the load calculator
            </ButtonLink>
          </div>
        </div>
      ) : (
        <>
          <div className="px-4 pt-4 sm:px-5">
            <FreeShipMeter totals={cart.totals} />
          </div>
          <ul className="divide-y divide-border">
            {cart.items.map((item) => (
              <li key={item.id}>
                <CartLineItem item={item} compact />
              </li>
            ))}
          </ul>

          {crossSell.length > 0 ? (
            <section className="border-t border-border bg-surface px-4 py-5 sm:px-5">
              <h3 className="font-display text-sm font-semibold text-foreground">
                Complete your system
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Frequently bought with what is in your cart.
              </p>
              <ul className="mt-3 space-y-3">
                {crossSell.slice(0, 3).map((product) => (
                  <li key={product.id}>
                    <ProductCard product={product} layout="compact" />
                  </li>
                ))}
              </ul>
              <Link
                href="/search"
                onClick={close}
                className="mt-3 inline-block text-xs font-semibold text-accent-600 underline-offset-4 hover:underline"
              >
                Browse the full range
              </Link>
            </section>
          ) : null}
        </>
      )}
    </Drawer>
  );
}
