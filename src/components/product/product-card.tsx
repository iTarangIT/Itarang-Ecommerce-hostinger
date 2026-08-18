'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgeCheck, GitCompare, Heart, ShieldCheck, ShoppingCart } from 'lucide-react';
import type { ProductSummary } from '@/lib/commerce/summary';
import { summaryToCartItem, useCart, useCompare, useWishlist } from '@/lib/store/hooks';
import { useUI } from '@/lib/store/ui-provider';
import { BadgeStack } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { RatingSummaryInline } from '@/components/ui/rating';
import { PriceBlock } from './price-block';
import { cn } from '@/lib/utils';

/**
 * Product card.
 *
 * One implementation serves grids, rails and cross-sell blocks. Layout is
 * fixed-height by section so a row of cards aligns regardless of title length.
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
  const router = useRouter();

  const soldOut = product.availability === 'out-of-stock';
  const inWishlist = wishlist.has(product.id);
  const inCompare = compare.has(product.id);

  const addToCart = React.useCallback(() => {
    cart.addItem(summaryToCartItem(product));
    toast({
      title: 'Added to cart',
      description: product.title,
      tone: 'success',
      action: { label: 'View cart', onClick: () => open('cart') },
    });
  }, [cart, product, toast, open]);

  const buyNow = () => {
    cart.addItem(summaryToCartItem(product));
    router.push('/cart');
  };

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
      <div className="relative aspect-square overflow-hidden bg-surface">
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

        <div className="absolute right-2 top-2 z-10 flex flex-col gap-1.5">
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
              'grid h-9 w-9 place-items-center rounded-full border border-border bg-card/95 shadow-card transition-colors',
              inWishlist ? 'text-sale' : 'text-muted-foreground hover:text-sale',
            )}
          >
            <Heart className={cn('h-4 w-4', inWishlist && 'fill-current')} />
          </button>
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

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          {product.categoryLabel}
          {product.keySpec ? <span className="text-accent-600"> · {product.keySpec}</span> : null}
        </p>

        <h3 className="text-sm font-semibold leading-snug">
          <Link
            href={`/p/${product.slug}`}
            className="line-clamp-2-fixed text-foreground transition-colors after:absolute after:inset-0 after:content-[''] hover:text-accent-600"
          >
            {product.title}
          </Link>
        </h3>

        <div className="min-h-[1.25rem]">
          {product.rating ? (
            <RatingSummaryInline average={product.rating.average} count={product.rating.count} />
          ) : (
            <span className="text-xs text-muted-foreground">No reviews yet</span>
          )}
        </div>

        <PriceBlock price={product.price} mrp={product.mrp} discount={product.discount} />

        <ul className="mt-0.5 space-y-1 text-xs text-muted-foreground">
          {product.warrantyMonths !== undefined ? (
            <li className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success" />
              {Math.round(product.warrantyMonths / 12)}-year warranty
            </li>
          ) : null}
          {product.installationIncluded ? (
            <li className="flex items-center gap-1.5">
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-success" />
              Installation included
            </li>
          ) : null}
        </ul>

        {/* Relative + z-10 so the actions sit above the card-wide title link. */}
        <div className="relative z-10 mt-auto flex flex-col gap-2 pt-2">
          {soldOut ? (
            <ButtonLink href={`/p/${product.slug}`} variant="outline" size="md" fullWidth>
              View details
            </ButtonLink>
          ) : product.hasOptions ? (
            <ButtonLink href={`/p/${product.slug}`} variant="primary" size="md" fullWidth>
              Choose options
            </ButtonLink>
          ) : (
            <>
              <Button onClick={addToCart} variant="primary" size="md" fullWidth>
                <ShoppingCart className="h-4 w-4" />
                Add to cart
              </Button>
              <Button
                onClick={buyNow}
                variant="accent"
                size="md"
                fullWidth
                className="hidden sm:inline-flex"
              >
                Buy now
              </Button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
