'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Plus, ShoppingCart } from 'lucide-react';
import type { ProductSummary } from '@/lib/commerce/summary';
import { formatPrice } from '@/lib/catalog/pricing';
import { summaryToCartItem, useCart } from '@/lib/store/hooks';
import { useUI } from '@/lib/store/ui-provider';
import { Checkbox } from '@/components/ui/field';
import { PurchaseButton } from './purchase-button';
import { productPath } from '@/lib/routes';

/**
 * Frequently bought together.
 *
 * The anchor product is always included; companions can be unticked. The total
 * updates live so the value of buying together is visible before committing.
 */
export function FrequentlyBought({
  anchor,
  companions,
}: {
  anchor: ProductSummary;
  companions: ProductSummary[];
}) {
  const cart = useCart();
  const { toast, open } = useUI();
  const [selected, setSelected] = React.useState<string[]>(() => companions.map((c) => c.id));

  if (companions.length === 0) return null;

  const chosen = companions.filter((c) => selected.includes(c.id));
  const items = [anchor, ...chosen];
  const total = items.reduce((sum, item) => sum + item.price, 0);
  const mrpTotal = items.reduce((sum, item) => sum + item.mrp, 0);
  const savings = Math.max(0, mrpTotal - total);

  const addAll = () => {
    for (const item of items) cart.addItem(summaryToCartItem(item));
    toast({
      title: `${items.length} products added`,
      description: 'Everything you selected is in your cart.',
      tone: 'success',
      action: { label: 'View cart', onClick: () => open('cart') },
    });
  };

  return (
    <section aria-labelledby="fbt-heading" className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <h2 id="fbt-heading" className="heading-3">
        Frequently bought together
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        These are the products customers most often pair with this one.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-12">
        <ul className="flex flex-wrap items-center gap-3 lg:col-span-8">
          {items.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 ? (
                <li aria-hidden="true">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </li>
              ) : null}
              <li>
                <Link
                  href={productPath(item.slug)}
                  className="relative block h-24 w-24 overflow-hidden rounded-md border border-border bg-surface transition-colors hover:border-accent/50 sm:h-28 sm:w-28"
                >
                  <Image src={item.image} alt={item.title} fill sizes="112px" className="object-contain p-2" />
                </Link>
              </li>
            </React.Fragment>
          ))}
        </ul>

        <div className="lg:col-span-4">
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2.5">
              <Checkbox checked disabled aria-label="This product is always included" />
              <span className="min-w-0 text-sm">
                <span className="block font-medium text-foreground">This product</span>
                <span className="tabular block text-muted-foreground">{formatPrice(anchor.price)}</span>
              </span>
            </li>
            {companions.map((companion) => (
              <li key={companion.id} className="flex items-start gap-2.5">
                <Checkbox
                  checked={selected.includes(companion.id)}
                  onChange={() =>
                    setSelected((s) =>
                      s.includes(companion.id)
                        ? s.filter((id) => id !== companion.id)
                        : [...s, companion.id],
                    )
                  }
                  aria-label={`Include ${companion.title}`}
                />
                <span className="min-w-0 text-sm">
                  <Link
                    href={productPath(companion.slug)}
                    className="block font-medium text-foreground hover:text-accent-600"
                  >
                    {companion.title}
                  </Link>
                  <span className="tabular block text-muted-foreground">
                    {formatPrice(companion.price)}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 border-t border-border pt-4">
            <p className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">
                Total for {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
              <span className="tabular font-display text-lg font-bold text-foreground">
                {formatPrice(total)}
              </span>
            </p>
            {savings > 0 ? (
              <p className="tabular mt-1 text-xs font-semibold text-success">
                You save {formatPrice(savings)} against MRP
              </p>
            ) : null}
            {/* Purchase is switched off site-wide; the button stays, disabled.
                See lib/commerce/purchase.ts. */}
            <PurchaseButton variant="accent" fullWidth className="mt-3" onClick={addAll}>
              <ShoppingCart className="h-4 w-4" />
              Add {items.length} to cart
            </PurchaseButton>
          </div>
        </div>
      </div>
    </section>
  );
}
