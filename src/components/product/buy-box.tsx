'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Heart, Loader2, PackageCheck, ShoppingCart } from 'lucide-react';
import type { Paise, Product, ProductOption, ProductVariant } from '@/lib/commerce/types';
import { discountPercent, formatPrice } from '@/lib/catalog/pricing';
import { PURCHASE_BLOCK_NOTE, purchaseBlockFor } from '@/lib/commerce/purchase';
import { SITE } from '@/lib/site';
import { useCart, useRecentlyViewed, useWishlist } from '@/lib/store/hooks';
import { useUI } from '@/lib/store/ui-provider';
import { track } from '@/lib/analytics/track';
import { Button } from '@/components/ui/button';
import { QuantityStepper } from '@/components/cart/quantity-stepper';
import { PriceBlock } from './price-block';
import { DeliveryCheck } from './delivery-check';
import { PurchaseButton } from './purchase-button';
import { ServiceStrip } from './service-strip';
import { cn } from '@/lib/utils';

/** Pick the variant matching a full option selection. */
function findVariant(product: Product, selection: Record<string, string>): ProductVariant {
  const match = product.variants.find((variant) =>
    Object.entries(selection).every(([key, value]) => variant.optionValues[key] === value),
  );
  return match ?? product.variants[0];
}

/**
 * The cheapest price reachable by picking `value` for `optionId`.
 *
 * Shown beside an option value only when the values are not all one price —
 * otherwise the figure repeats the headline price on every pill and reads as
 * noise. Uses the cheapest rather than the current combination's price because
 * the shopper is being told what the choice would cost them at best, before
 * they have narrowed the other options.
 */
function priceForValue(product: Product, optionId: string, value: string): Paise | null {
  const prices = product.variants
    .filter((variant) => variant.optionValues[optionId] === value)
    .map((variant) => variant.price.selling);
  return prices.length > 0 ? Math.min(...prices) : null;
}

/** True when an option's values span more than one price. */
function optionHasPriceSpread(product: Product, option: ProductOption): boolean {
  const prices = option.values
    .map((value) => priceForValue(product, option.id, value))
    .filter((price): price is Paise => price !== null);
  return new Set(prices).size > 1;
}

export function BuyBox({ product }: { product: Product }) {
  const cart = useCart();
  const wishlist = useWishlist();
  const recentlyViewed = useRecentlyViewed();
  const { toast, open } = useUI();
  const router = useRouter();

  const [selection, setSelection] = React.useState<Record<string, string>>(() => {
    const first = product.variants[0];
    return { ...first.optionValues };
  });
  const [quantity, setQuantity] = React.useState(1);
  // One visible note serves both disabled buttons, so both point at this id
  // rather than each minting a hidden copy of the same sentence.
  const noteId = React.useId();

  const variant = findVariant(product, selection);
  const soldOut = variant.availability === 'out-of-stock';
  /**
   * Why this variant may not be bought, or null.
   *
   * Recomputed per selected variant, not per product: a product can have one
   * variant in stock and another not, and the buttons follow the selection.
   * `null` here is not permission — the server re-runs the same rule against
   * the live row before it prices anything.
   */
  const block = purchaseBlockFor(product, variant);
  const discount = discountPercent(variant.price);

  React.useEffect(() => {
    // Wait for the store to hydrate before recording anything.
    //
    // This effect belongs to a child of StoreProvider, so it runs *before* the
    // provider's own hydrate effect — and the hydrate reducer replaces state
    // wholesale rather than merging. A push dispatched now is discarded, which
    // is why a cold load of a product page never recorded that product: only
    // client-side navigations to it were ever kept.
    if (!recentlyViewed.hydrated) return;
    recentlyViewed.push(product.slug);
    // Record once per product view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.slug, recentlyViewed.hydrated]);

  // The funnel's product-view stage.
  //
  // Fired from the client, not the server, on purpose: /products/[slug] is
  // prerendered with `dynamicParams: false`, and recording this in the page
  // would force it dynamic and cost the whole route its static generation.
  // The event is worth far less than the page speed.
  React.useEffect(() => {
    track('product_view', { productId: product.id });
  }, [product.id]);

  React.useEffect(() => {
    setQuantity((q) => Math.min(Math.max(1, q), Math.max(1, variant.stock)));
  }, [variant.stock]);

  const addToCart = () => {
    cart.add(product, variant, quantity);
    track('add_to_cart', {
      productId: product.id,
      variantId: variant.id,
      quantity,
      // Adding the same variant twice is two real intents, so each one counts.
      dedupe: String(Date.now()),
    });
    toast({
      title: 'Added to cart',
      description: `${product.title}${product.options.length ? ` — ${variant.title}` : ''}`,
      tone: 'success',
      action: { label: 'View cart', onClick: () => open('cart') },
    });
  };

  // Feedback for the gap between the click and /cart’s own skeleton.
  const [navigating, startNavigating] = React.useTransition();

  const buyNow = () => {
    cart.add(product, variant, quantity);
    // Buy Now is otherwise indistinguishable from add-to-cart server-side —
    // same reducer action, same destination — so this event is the only thing
    // that separates the two paths in the funnel.
    track('buy_now', {
      productId: product.id,
      variantId: variant.id,
      quantity,
      dedupe: String(Date.now()),
    });
    startNavigating(() => router.push('/cart'));
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
        // Only when the catalogue states it. Passing this unconditionally is
        // what put a no-cost EMI offer on every product over ₹5,000.
        showEmi={product.emiEnabled === true}
        showTaxNote
      />

      {/* Variant selection — unavailable combinations are disabled, never hidden. */}
      {product.options.map((option) => {
        const showPrices = optionHasPriceSpread(product, option);
        const isColor = option.kind === 'color';

        return (
          <fieldset key={option.id}>
            <legend className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {option.name}:{' '}
              <span className="normal-case text-foreground">{selection[option.id]}</span>
            </legend>

            <div className={cn('mt-2.5 flex flex-wrap', isColor ? 'gap-3' : 'gap-2')}>
              {option.values.map((value) => {
                const selected = selection[option.id] === value;
                const available = isValueAvailable(option.id, value);
                const swatch = option.swatches?.find((entry) => entry.value === value);
                const price = showPrices ? priceForValue(product, option.id, value) : null;

                if (isColor) {
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSelection((s) => ({ ...s, [option.id]: value }))}
                      aria-pressed={selected}
                      aria-label={available ? value : `${value} — out of stock`}
                      title={value}
                      disabled={!available}
                      className={cn(
                        'relative h-10 w-10 overflow-hidden rounded-full border border-border transition-all',
                        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                        !available && 'cursor-not-allowed opacity-40',
                      )}
                      style={swatch?.hex ? { backgroundColor: swatch.hex } : undefined}
                    >
                      {swatch?.image ? (
                        <Image src={swatch.image} alt="" fill sizes="40px" className="object-cover" />
                      ) : null}
                      {/* No hex and no image: fall back to the value's initial so
                          the chip is never a blank circle. */}
                      {!swatch?.hex && !swatch?.image ? (
                        <span className="grid h-full w-full place-items-center text-sm font-semibold text-foreground">
                          {value.charAt(0)}
                        </span>
                      ) : null}
                    </button>
                  );
                }

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
                    {price !== null ? (
                      <span
                        className={cn(
                          'tabular text-xs',
                          selected ? 'text-primary-foreground/80' : 'text-muted-foreground',
                        )}
                      >
                        {formatPrice(price)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}

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
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              max={Math.max(1, variant.stock)}
              disabled={block !== null}
            />
          </div>
        ) : null}

        {/* Disabled for anything this product's own values say may not be sold
            — the demo fixture, an unpriced variant, an out-of-stock one — with
            the reason stated below. `purchaseBlockFor` is the same rule the
            server applies in `lib/orders/quote.ts`; this copy is a courtesy so
            a shopper is not sent to a checkout that would refuse them, and is
            never the protection. See lib/commerce/purchase.ts. */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <PurchaseButton
            onClick={addToCart}
            disabled={block !== null}
            describedBy={block === null ? undefined : noteId}
            variant="primary"
            size="lg"
            fullWidth
            wrapperClassName="sm:flex-1"
          >
            <ShoppingCart className="h-4.5 w-4.5" />
            {soldOut ? 'Out of stock' : 'Add to cart'}
          </PurchaseButton>
          <PurchaseButton
            onClick={buyNow}
            disabled={block !== null || navigating}
            describedBy={block === null ? undefined : noteId}
            variant="accent"
            size="lg"
            fullWidth
            wrapperClassName="sm:flex-1"
          >
            {navigating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Buy now
          </PurchaseButton>
        </div>

        {block !== null && block !== 'out-of-stock' ? (
          <p id={noteId} className="text-xs text-muted-foreground">
            {PURCHASE_BLOCK_NOTE[block]} Meanwhile you can{' '}
            <Link
              href="/tools/load-calculator"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              size your system
            </Link>{' '}
            or{' '}
            <a
              href={`mailto:${SITE.email}?subject=${encodeURIComponent(`Enquiry: ${product.title}`)}`}
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              enquire about this product
            </a>
            .
          </p>
        ) : null}

        {/* Save is the only secondary action here now. "Compare" sat beside it
            and has been withdrawn from the product page; the comparison system
            itself — the store, the tray and `/compare` — is untouched and still
            reachable from the product cards in the listing grids, which is
            where a shopper is actually choosing between products. */}
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
      </div>

      {/* Delivery date, then the service promises. The warranty and
          installation assurances that used to sit here are stated by the
          service strip and again in the specification grid — three times on
          one page was two too many. */}
      <DeliveryCheck installationIncluded={product.installationIncluded} />

      <ServiceStrip
        installationIncluded={product.installationIncluded}
        returnWindowDays={product.returnWindowDays}
      />

      {/* Rendered whether or not purchase is enabled, so the page behaves the
          same on scroll either way; the button inside carries the gate. */}
      <StickyBuyBar product={product} variant={variant} onAdd={addToCart} soldOut={soldOut} />
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
      {/* On a phone the bar is the button — the price and title are already on
          screen above it, and a full-width target is the easier one to hit.
          From `sm` up there is room to restate what is being added. */}
      <div className="container flex items-center gap-3 py-2.5">
        <div className="relative hidden h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-surface sm:block">
          <Image src={product.images[0]} alt="" fill sizes="48px" className="object-contain p-1" />
        </div>
        <div className="hidden min-w-0 flex-1 sm:block">
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
        <PurchaseButton
          onClick={onAdd}
          disabled={soldOut}
          variant="accent"
          size="lg"
          fullWidth
          wrapperClassName="flex-1 sm:w-auto sm:flex-none"
          tabIndex={visible ? 0 : -1}
        >
          <ShoppingCart className="h-4 w-4" />
          {soldOut ? 'Out of stock' : 'Add to Cart'}
        </PurchaseButton>
      </div>
    </div>
  );
}
