'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  BadgeCheck,
  Bookmark,
  Info,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
} from 'lucide-react';
import type { ProductSummary } from '@/lib/commerce/summary';
import { formatPrice } from '@/lib/catalog/pricing';
import { PURCHASE_ENABLED } from '@/lib/commerce/purchase';
import { SITE } from '@/lib/site';
import { useCart } from '@/lib/store/hooks';
import { useUI } from '@/lib/store/ui-provider';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button, ButtonLink } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { StateBlock } from '@/components/ui/states';
import { ProductRail } from '@/components/merch/product-rail';
import { CartLineItem, CouponField, FreeShipMeter, OrderSummary } from './cart-pieces';

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function CartPageBody({
  recommendations,
  signedIn,
}: {
  recommendations: ProductSummary[];
  signedIn: boolean;
}) {
  const cart = useCart();
  const { toast } = useUI();
  const [gstin, setGstinLocal] = React.useState('');
  const [gstinError, setGstinError] = React.useState<string | null>(null);

  React.useEffect(() => setGstinLocal(cart.gstin), [cart.gstin]);

  const isEmpty = cart.items.length === 0;

  return (
    <div className="container py-6 lg:py-10">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Your cart' }]} />

      <h1 className="heading-1 mt-3">Your cart</h1>
      {!isEmpty ? (
        <p className="mt-1.5 text-sm text-muted-foreground">
          {cart.totals.itemCount} {cart.totals.itemCount === 1 ? 'item' : 'items'} · prices include
          GST
        </p>
      ) : null}

      {isEmpty ? (
        <div className="mt-8 space-y-10">
          <StateBlock
            icon={<ShoppingBag className="h-6 w-6" />}
            title="Your cart is empty"
            description="Add an inverter, a battery or a ready-matched combo. If you are not sure what size you need, the load calculator will work it out from your appliances."
            actions={
              <>
                <ButtonLink href="/c/combos" variant="primary">
                  Shop combos
                </ButtonLink>
                <ButtonLink href="/tools/load-calculator" variant="outline">
                  Size my system
                </ButtonLink>
              </>
            }
          />

          {cart.savedForLater.length > 0 ? (
            <SavedForLater />
          ) : (
            <ProductRail
              products={recommendations}
              eyebrow="Popular right now"
              title="Best sellers"
              action={{ label: 'Browse everything', href: '/search' }}
            />
          )}
        </div>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:gap-10">
          {/* Items */}
          <div className="lg:col-span-8">
            <FreeShipMeter totals={cart.totals} />

            <ul className="mt-4 divide-y divide-border border-y border-border">
              {cart.items.map((item) => (
                <li key={item.id}>
                  <CartLineItem item={item} />
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/search"
                className="text-sm font-semibold text-primary underline-offset-4 hover:text-accent-600 hover:underline"
              >
                Continue shopping
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  cart.clear();
                  toast({ title: 'Cart cleared', tone: 'info' });
                }}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Clear cart
              </Button>
            </div>

            <SavedForLater />
          </div>

          {/* Summary */}
          <aside className="lg:col-span-4">
            <div className="space-y-4 lg:sticky lg:top-24">
              <div className="rounded-lg border border-border bg-card p-5">
                <h2 className="font-display text-base font-bold text-card-foreground">
                  Order summary
                </h2>

                <div className="mt-4">
                  <CouponField />
                </div>

                <div className="mt-4">
                  <OrderSummary totals={cart.totals} showGst />
                </div>

                {/* Purchase is switched off site-wide; see lib/commerce/purchase.ts.
                    The route and everything behind it are untouched — this is the
                    door, not the machinery. */}
                {PURCHASE_ENABLED ? (
                  <>
                    <ButtonLink
                      href={signedIn ? '/checkout' : '/login?next=%2Fcheckout'}
                      variant="accent"
                      size="lg"
                      fullWidth
                      className="mt-5"
                    >
                      <Lock className="h-4 w-4" />
                      {signedIn ? 'Proceed to checkout' : 'Sign in to check out'}
                    </ButtonLink>

                    {signedIn ? null : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Your cart is saved on this device and will still be here after you sign in.
                      </p>
                    )}

                    <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Test mode — checkout runs against a local database with a simulated payment
                      step. Nothing is charged.
                    </p>
                  </>
                ) : (
                  <>
                    <Button variant="accent" size="lg" fullWidth className="mt-5" disabled>
                      <Lock className="h-4 w-4" />
                      Checkout unavailable
                    </Button>

                    <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Online purchasing is switched off while the store is being finished. Your
                      cart is saved on this device. To buy any of these, call or email us and we
                      will take it from there.
                    </p>

                    <div className="mt-3 flex flex-col gap-2">
                      <ButtonLink href={SITE.phoneHref} variant="outline" fullWidth>
                        <Phone className="h-4 w-4" />
                        {SITE.phone}
                      </ButtonLink>
                      <ButtonLink href={`mailto:${SITE.email}`} variant="outline" fullWidth>
                        <Mail className="h-4 w-4" />
                        {SITE.email}
                      </ButtonLink>
                    </div>
                  </>
                )}

                <ul className="mt-4 space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Truck className="h-4 w-4 shrink-0 text-success" />
                    Free delivery above ₹4,999
                  </li>
                  <li className="flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 shrink-0 text-success" />
                    Certified installation on inverters and batteries
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
                    Documented warranty with every product
                  </li>
                </ul>
              </div>

              {/* B2B */}
              <div className="rounded-lg border border-border bg-card p-5">
                <h2 className="font-display text-sm font-semibold text-card-foreground">
                  Buying for a business?
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add your GSTIN and the invoice is raised against it so you can claim input credit.
                </p>
                <form
                  className="mt-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const value = gstin.trim().toUpperCase();
                    if (value && !GSTIN_PATTERN.test(value)) {
                      setGstinError('That does not look like a valid 15-character GSTIN.');
                      return;
                    }
                    setGstinError(null);
                    cart.setGstin(value);
                    toast({
                      title: value ? 'GSTIN saved' : 'GSTIN removed',
                      description: value ? `Invoice will be raised against ${value}.` : undefined,
                      tone: 'success',
                    });
                  }}
                >
                  <Field label="GSTIN" htmlFor="gstin" error={gstinError ?? undefined}>
                    <div className="flex gap-2">
                      <Input
                        id="gstin"
                        value={gstin}
                        onChange={(e) => {
                          setGstinLocal(e.target.value.toUpperCase());
                          setGstinError(null);
                        }}
                        maxLength={15}
                        placeholder="22AAAAA0000A1Z5"
                        className="tabular uppercase"
                      />
                      <Button type="submit" variant="outline" className="shrink-0">
                        Save
                      </Button>
                    </div>
                  </Field>
                </form>
                {cart.gstin ? (
                  <p className="mt-2 text-xs font-medium text-success">
                    Invoice will be raised against {cart.gstin}.
                  </p>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      )}

      {!isEmpty ? (
        <div className="mt-14">
          <ProductRail
            products={recommendations}
            eyebrow="Complete the system"
            title="Customers often add these"
            action={{ label: 'Browse everything', href: '/search' }}
          />
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------- saved for later */

function SavedForLater() {
  const cart = useCart();

  if (cart.savedForLater.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
        <Bookmark className="h-4.5 w-4.5 text-accent-600" />
        Saved for later ({cart.savedForLater.length})
      </h2>
      <ul className="mt-4 divide-y divide-border border-y border-border">
        {cart.savedForLater.map((item) => (
          <li key={item.id} className="flex gap-3 py-4">
            <Link
              href={`/p/${item.slug}`}
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-secondary"
            >
              <Image src={item.image} alt="" fill sizes="80px" className="object-contain p-1.5" />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col justify-between">
              <div>
                <Link
                  href={`/p/${item.slug}`}
                  className="line-clamp-2 text-sm font-semibold text-foreground hover:text-accent-600"
                >
                  {item.title}
                </Link>
                <p className="tabular mt-0.5 text-sm font-bold text-foreground">
                  {formatPrice(item.price.selling)}
                </p>
              </div>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => cart.moveToCart(item.id)}
                  className="text-xs font-semibold text-accent-600 underline-offset-4 hover:underline"
                >
                  Move to cart
                </button>
                <button
                  type="button"
                  onClick={() => cart.removeSaved(item.id)}
                  className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
