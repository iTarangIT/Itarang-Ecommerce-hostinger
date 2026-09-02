'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { GitCompare, Heart, Palette, ShoppingCart } from 'lucide-react';
import type { ProductSummary } from '@/lib/commerce/summary';
import { PURCHASE_ENABLED } from '@/lib/commerce/purchase';
import { summaryToCartItem, useCart, useCompare, useWishlist } from '@/lib/store/hooks';
import { useUI } from '@/lib/store/ui-provider';
import { track } from '@/lib/analytics/track';
import { BadgeStack } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { PriceBlock } from './price-block';
import { PurchaseButton } from './purchase-button';
import { cn } from '@/lib/utils';

/**
 * Product card.
 *
 * One implementation serves grids, rails and cross-sell blocks. Layout is
 * fixed-height by section so a row of cards aligns regardless of title length.
 *
 * The reading order — lead spec, title, price, saving, colours, buy — is the
 * retail convention the storefront now follows throughout: the shopper decides
 * on the figure that distinguishes the product, then the price, then acts. The
 * detail that used to sit on the card (rating, warranty, stock, installation)
 * moved to the product page, where there is room to state it properly.
 */
export function ProductCard({
  product,
  layout = 'grid',
  className,
}: {
  product: ProductSummary;
  layout?: 'grid' | 'rail' | 'compact';
  className?: string;
}) {
  const cart = useCart();
  const wishlist = useWishlist();
  const compare = useCompare();
  const { toast, open } = useUI();

  const soldOut = product.availability === 'out-of-stock';
  const inWishlist = wishlist.has(product.id);
  const inCompare = compare.has(product.id);

  const addToCart = React.useCallback(() => {
    cart.addItem(summaryToCartItem(product));
    track('add_to_cart', {
      productId: product.id,
      quantity: 1,
      dedupe: String(Date.now()),
    });
    toast({
      title: 'Added to cart',
      description: product.title,
      tone: 'success',
      action: { label: 'View cart', onClick: () => open('cart') },
    });
  }, [cart, product, toast, open]);

  // Buy now lives on the product page only, as it does on the retail sites
  // this card follows: a card offers one action, not a choice of two.

  if (layout === 'compact') {
    return (
      <div className={cn('flex gap-3', className)}>
        <Link
          href={`/p/${product.slug}`}
          className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-secondary"
        >
          <Image src={product.image} alt="" fill sizes="80px" className="object-contain p-1.5" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <Link
            href={`/p/${product.slug}`}
            className="line-clamp-2 text-sm font-semibold text-foreground transition-colors hover:text-accent-600"
          >
            {product.title}
          </Link>
          <PriceBlock
            price={product.price}
            mrp={product.mrp}
            discount={product.discount}
            size="sm"
            className="mt-1"
          />
        </div>
      </div>
    );
  }

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-raised',
        layout === 'rail' && 'h-full',
        className,
      )}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-surface">
        <Link href={`/p/${product.slug}`} className="absolute inset-0" aria-label={product.title}>
          <Image
            src={product.image}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={cn(
              'object-contain p-3 transition-all duration-300 sm:p-5',
              product.hoverImage && 'group-hover:opacity-0',
              soldOut && 'opacity-55 grayscale',
            )}
          />
          {product.hoverImage ? (
            <Image
              src={product.hoverImage}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-contain p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:p-5"
            />
          ) : null}
        </Link>

        <div className="pointer-events-none absolute left-2.5 top-2.5 z-10">
          <BadgeStack badges={product.badges} />
        </div>

        {/* Compare stays on the image; the heart moved down beside the lead
            spec, where a shopper expects to find it. */}
        <div className="absolute right-2 top-2 z-10 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (!inCompare && compare.isFull) {
                toast({
                  title: 'Compare list is full',
                  description: `You can compare up to ${compare.max} products.`,
                  tone: 'error',
                });
                return;
              }
              compare.toggle(product.id);
            }}
            aria-label={inCompare ? 'Remove from comparison' : 'Add to comparison'}
            aria-pressed={inCompare}
            className={cn(
              'hidden h-9 w-9 place-items-center rounded-full border border-border bg-card/95 shadow-card transition-colors sm:grid',
              inCompare ? 'text-accent-600' : 'text-muted-foreground hover:text-accent-600',
            )}
          >
            <GitCompare className="h-4 w-4" />
          </button>
        </div>

        {product.availability === 'low-stock' && !soldOut ? (
          <p className="absolute inset-x-0 bottom-0 z-10 bg-warning-soft px-3 py-1.5 text-center text-xs font-semibold text-warning">
            Only {product.stock} left
          </p>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        {/* Lead spec + wishlist. Fixed height so a product with no stated
            chemistry or VA rating does not shorten its card. */}
        <div className="flex min-h-[1.5rem] items-start justify-between gap-2">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold leading-6 text-foreground">
            {product.leadSpec ?? product.categoryLabel}
            {product.isDemo ? (
              <span className="rounded-sm bg-warning-soft px-1.5 py-px text-2xs font-bold uppercase tracking-wide text-warning">
                Demo
              </span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={() => {
              wishlist.toggle(product.id);
              toast({
                title: inWishlist ? 'Removed from saved' : 'Saved for later',
                description: product.title,
                tone: 'info',
              });
            }}
            aria-label={inWishlist ? 'Remove from saved products' : 'Save for later'}
            aria-pressed={inWishlist}
            className={cn(
              'relative z-10 -mr-1 -mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors',
              inWishlist ? 'text-sale' : 'text-muted-foreground hover:text-sale',
            )}
          >
            <Heart className={cn('h-[1.125rem] w-[1.125rem]', inWishlist && 'fill-current')} />
          </button>
        </div>

        <h3 className="text-sm leading-snug">
          <Link
            href={`/p/${product.slug}`}
            className="line-clamp-2-fixed text-primary transition-colors after:absolute after:inset-0 after:content-[''] hover:text-primary-600"
          >
            {product.title}
          </Link>
        </h3>

        {/* The remaining comparison figures; the first one already leads above. */}
        {product.specChips.length > 1 ? (
          <ul className="flex flex-wrap gap-1">
            {product.specChips.slice(1).map((chip) => (
              <li
                key={chip}
                className="rounded-sm border border-border bg-surface px-1.5 py-0.5 text-2xs font-semibold text-foreground"
              >
                {chip}
              </li>
            ))}
          </ul>
        ) : null}

        <PriceBlock
          price={product.price}
          mrp={product.mrp}
          discount={product.discount}
          from={product.priceFrom}
          discountPlacement="below"
          className="mt-1"
        />

        {/* Option line. Height is reserved either way so a row of cards keeps
            its buttons on one line. */}
        <div className="flex min-h-[1.25rem] items-center gap-1.5 text-xs text-muted-foreground">
          {product.optionSummary ? (
            <>
              {product.swatchHexes.length > 0 ? (
                <span className="flex items-center -space-x-1">
                  {product.swatchHexes.map((hex) => (
                    <span
                      key={hex}
                      style={{ backgroundColor: hex }}
                      className="h-3.5 w-3.5 rounded-full ring-1 ring-inset ring-border"
                    />
                  ))}
                </span>
              ) : (
                <Palette className="h-3.5 w-3.5 shrink-0" />
              )}
              {product.optionSummary}
            </>
          ) : null}
        </div>

        {/* Relative + z-10 so the actions sit above the card-wide title link. */}
        <div className="relative z-10 mt-auto pt-2">
          {/* Options cannot be chosen from a card, so a card for a product that
              has them sends the shopper to the page that can — but only once
              purchase is switched on. While it is off there is nothing to
              choose between, and every card carries the same disabled button. */}
          {PURCHASE_ENABLED && !soldOut && product.hasOptions ? (
            <ButtonLink href={`/p/${product.slug}`} variant="outline" size="md" fullWidth>
              Choose options
            </ButtonLink>
          ) : (
            <PurchaseButton
              onClick={addToCart}
              disabled={soldOut}
              variant="outline"
              size="md"
              fullWidth
            >
              <ShoppingCart className="h-4 w-4" />
              {soldOut ? 'Out of stock' : 'Add to cart'}
            </PurchaseButton>
          )}
        </div>
      </div>
    </article>
  );
}
