'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  BadgeCheck,
  Check,
  GitCompare,
  Heart,
  PackageCheck,
  ShieldCheck,
  ShoppingCart,
} from 'lucide-react';
import type { Product, ProductVariant } from '@/lib/commerce/types';
import { discountPercent, formatPrice } from '@/lib/catalog/pricing';
import { useCart, useCompare, useRecentlyViewed, useWishlist } from '@/lib/store/hooks';
import { useUI } from '@/lib/store/ui-provider';
import { Button } from '@/components/ui/button';
import { QuantityStepper } from '@/components/cart/quantity-stepper';
import { PriceBlock } from './price-block';
import { DeliveryCheck } from './delivery-check';
import { cn } from '@/lib/utils';

/** Pick the variant matching a full option selection. */
function findVariant(product: Product, selection: Record<string, string>): ProductVariant {
  const match = product.variants.find((variant) =>
    Object.entries(selection).every(([key, value]) => variant.optionValues[key] === value),
  );
  return match ?? product.variants[0];
}

export function BuyBox({ product }: { product: Product }) {
  const cart = useCart();
  const wishlist = useWishlist();
  const compare = useCompare();
  const recentlyViewed = useRecentlyViewed();
  const { toast, open } = useUI();
  const router = useRouter();

  const [selection, setSelection] = React.useState<Record<string, string>>(() => {
    const first = product.variants[0];
    return { ...first.optionValues };
  });
  const [quantity, setQuantity] = React.useState(1);

  const variant = findVariant(product, selection);
  const soldOut = variant.availability === 'out-of-stock';
  const discount = discountPercent(variant.price);

  React.useEffect(() => {
    recentlyViewed.push(product.slug);
    // Record once per product view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.slug]);

  React.useEffect(() => {
    setQuantity((q) => Math.min(Math.max(1, q), Math.max(1, variant.stock)));
  }, [variant.stock]);

  const addToCart = () => {
    cart.add(product, variant, quantity);
    toast({
      title: 'Added to cart',
      description: `${product.title}${product.options.length ? ` — ${variant.title}` : ''}`,
      tone: 'success',
      action: { label: 'View cart', onClick: () => open('cart') },
    });
  };

  const buyNow = () => {
    cart.add(product, variant, quantity);
    router.push('/cart');
  };

  /** Is this option value available given the rest of the current selection? */
  const isValueAvailable = (optionId: string, value: string) =>
    product.variants.some(
      (candidate) =>
        candidate.optionValues[optionId] === value && candidate.availability !== 'out-of-stock',
    );

  return (
    <div className="space-y-5">
      <PriceBlock
        price={variant.price.selling}
        mrp={variant.price.mrp}
        discount={discount}
        size="lg"
        showEmi
        showTaxNote
      />

      {/* Variant selection — unavailable combinations are disabled, never hidden. */}
      {product.options.map((option) => (
        <fieldset key={option.id}>
          <legend className="text-sm font-semibold text-foreground">
            {option.name}
            <span className="ml-2 font-normal text-muted-foreground">
              {selection[option.id]}
            </span>
          </legend>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {option.values.map((value) => {
              const selected = selection[option.id] === value;
              const available = isValueAvailable(option.id, value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelection((s) => ({ ...s, [option.id]: value }))}
                  aria-pressed={selected}
                  disabled={!available}
                  className={cn(
                    'inline-flex min-h-[2.75rem] items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-foreground hover:border-accent/60',
                    !available && 'cursor-not-allowed opacity-45 line-through',
                  )}
                >
                  {selected ? <Check className="h-4 w-4" /> : null}
                  {value}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      {/* Availability */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {soldOut ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-muted-foreground">
            <PackageCheck className="h-4 w-4" /> Out of stock
          </span>
        ) : variant.availability === 'low-stock' ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-warning">
            <PackageCheck className="h-4 w-4" /> Only {variant.stock} left
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-semibold text-success">
            <PackageCheck className="h-4 w-4" /> In stock
          </span>
        )}
        <span className="text-muted-foreground">
          SKU <span className="tabular">{variant.sku}</span>
        </span>
      </div>

      {/* Quantity + primary actions */}
      <div className="space-y-3">
        {!soldOut ? (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">Quantity</span>
            <QuantityStepper value={quantity} onChange={setQuantity} max={Math.max(1, variant.stock)} />
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={addToCart}
            disabled={soldOut}
            variant="primary"
            size="lg"
            fullWidth
            className="sm:flex-1"
          >
            <ShoppingCart className="h-4.5 w-4.5" />
            {soldOut ? 'Out of stock' : 'Add to cart'}
          </Button>
          <Button
            onClick={buyNow}
            disabled={soldOut}
            variant="accent"
            size="lg"
            fullWidth
            className="sm:flex-1"
          >
            Buy now
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            fullWidth
            onClick={() => {
              wishlist.toggle(product.id);
              toast({
                title: wishlist.has(product.id) ? 'Removed from saved' : 'Saved for later',
                tone: 'info',
              });
            }}
            className={cn(wishlist.has(product.id) && 'border-sale/40 text-sale')}
          >
            <Heart className={cn('h-4 w-4', wishlist.has(product.id) && 'fill-current')} />
            {wishlist.has(product.id) ? 'Saved' : 'Save'}
          </Button>
          <Button
            variant="outline"
            fullWidth
            onClick={() => {
              if (!compare.has(product.id) && compare.isFull) {
                toast({
                  title: 'Compare list is full',
                  description: `You can compare up to ${compare.max} products.`,
                  tone: 'error',
                });
                return;
              }
              compare.toggle(product.id);
            }}
            className={cn(compare.has(product.id) && 'border-accent/50 text-accent-600')}
          >
            <GitCompare className="h-4 w-4" />
            {compare.has(product.id) ? 'Comparing' : 'Compare'}
          </Button>
        </div>
      </div>

      {/* Assurances — omitted entirely when the catalogue supports neither claim. */}
      {product.warrantyMonths !== undefined || product.installationIncluded ? (
        <ul className="grid gap-2 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
          {product.warrantyMonths !== undefined ? (
            <li className="flex items-start gap-2 text-sm text-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              {Math.round(product.warrantyMonths / 12)}-year warranty, documented
            </li>
          ) : null}
          {product.installationIncluded ? (
            <li className="flex items-start gap-2 text-sm text-foreground">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              Certified installation included
            </li>
          ) : null}
        </ul>
      ) : null}

      <DeliveryCheck installationIncluded={product.installationIncluded} />

      <StickyBuyBar
        product={product}
        variant={variant}
        onAdd={addToCart}
        soldOut={soldOut}
      />
    </div>
  );
}

/* --------------------------------------------------------- sticky buy bar */

function StickyBuyBar({
  product,
  variant,
  onAdd,
  soldOut,
}: {
  product: Product;
  variant: ProductVariant;
  onAdd: () => void;
  soldOut: boolean;
}) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 620);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-[var(--bottom-nav-height)] z-40 border-t border-border bg-card/95 backdrop-blur transition-transform duration-300 lg:bottom-0',
        visible ? 'translate-y-0' : 'translate-y-full',
      )}
      aria-hidden={!visible}
    >
      <div className="container flex items-center gap-3 py-2.5">
        <div className="relative hidden h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-surface sm:block">
          <Image src={product.images[0]} alt="" fill sizes="48px" className="object-contain p-1" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{product.title}</p>
          <p className="tabular text-sm font-bold text-foreground">
            {formatPrice(variant.price.selling)}
            {variant.price.mrp > variant.price.selling ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground line-through">
                {formatPrice(variant.price.mrp)}
              </span>
            ) : null}
          </p>
        </div>
        <Button
          onClick={onAdd}
          disabled={soldOut}
          variant="accent"
          size="md"
          className="shrink-0"
          tabIndex={visible ? 0 : -1}
        >
          <ShoppingCart className="h-4 w-4" />
          <span className="hidden xs:inline">{soldOut ? 'Out of stock' : 'Add to cart'}</span>
          <span className="xs:hidden">{soldOut ? 'Sold out' : 'Add'}</span>
        </Button>
      </div>
    </div>
  );
}
