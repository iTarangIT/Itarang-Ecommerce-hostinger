'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck, Bookmark, Tag, Trash2, Truck, X } from 'lucide-react';
import type { CartItem } from '@/lib/store/types';
import type { CartTotals } from '@/lib/store/totals';
import { FREE_SHIPPING_THRESHOLD } from '@/lib/store/totals';
import { formatPrice } from '@/lib/catalog/pricing';
import { validateCoupon } from '@/lib/offers/coupons';
import { useCart } from '@/lib/store/hooks';
import { useUI } from '@/lib/store/ui-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { QuantityStepper } from './quantity-stepper';
import { cn } from '@/lib/utils';
import { productPath } from '@/lib/routes';

/* ------------------------------------------------------------- line item */

export function CartLineItem({
  item,
  compact = false,
}: {
  item: CartItem;
  compact?: boolean;
}) {
  const cart = useCart();
  const { toast, close } = useUI();
  const lineTotal = item.price.selling * item.quantity;
  const lineMrp = item.price.mrp * item.quantity;

  const remove = () => {
    cart.remove(item.id);
    toast({
      title: 'Removed from cart',
      description: item.title,
      tone: 'info',
      action: { label: 'Undo', onClick: () => cart.setQuantity(item.id, item.quantity) },
    });
  };

  return (
    <div className={cn('flex gap-3 py-4', compact ? 'px-4 sm:px-5' : 'px-0')}>
      <Link
        href={productPath(item.slug)}
        onClick={compact ? close : undefined}
        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-secondary sm:h-24 sm:w-24"
      >
        <Image src={item.image} alt="" fill sizes="96px" className="object-contain p-1.5" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={productPath(item.slug)}
              onClick={compact ? close : undefined}
              className="line-clamp-2 text-sm font-semibold text-foreground transition-colors hover:text-accent-600"
            >
              {item.title}
            </Link>
            {item.variantTitle ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{item.variantTitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={remove}
            aria-label={`Remove ${item.title}`}
            className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
          >
            {compact ? <X className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>

        {item.installationIncluded ? (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-success">
            <BadgeCheck className="h-3.5 w-3.5" /> Installation included
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-2">
          <div className="flex items-center gap-2">
            <QuantityStepper
              value={item.quantity}
              max={item.maxQuantity}
              size="sm"
              onChange={(next) => cart.setQuantity(item.id, next)}
            />
            {!compact ? (
              <button
                type="button"
                onClick={() => cart.saveForLater(item.id)}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-accent-600"
              >
                <Bookmark className="h-3.5 w-3.5" /> Save for later
              </button>
            ) : null}
          </div>
          <div className="text-right">
            <p className="tabular text-sm font-bold text-foreground">{formatPrice(lineTotal)}</p>
            {lineMrp > lineTotal ? (
              <p className="tabular text-xs text-muted-foreground line-through">
                {formatPrice(lineMrp)}
              </p>
            ) : null}
          </div>
        </div>

        {item.quantity >= item.maxQuantity ? (
          <p className="mt-1.5 text-xs text-warning">
            Only {item.maxQuantity} available at the moment.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- free ship meter */

export function FreeShipMeter({ totals }: { totals: CartTotals }) {
  if (totals.itemCount === 0) return null;

  const qualified = totals.amountToFreeShipping <= 0;
  const progress = Math.min(
    100,
    Math.round(((FREE_SHIPPING_THRESHOLD - totals.amountToFreeShipping) / FREE_SHIPPING_THRESHOLD) * 100),
  );

  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="flex items-center gap-2 text-xs font-medium text-foreground">
        <Truck className={cn('h-4 w-4', qualified ? 'text-success' : 'text-accent-600')} />
        {qualified ? (
          <span className="text-success">Your order qualifies for free delivery.</span>
        ) : (
          <span>
            Add <strong className="tabular">{formatPrice(totals.amountToFreeShipping)}</strong> more
            for free delivery.
          </span>
        )}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500 ease-out',
            qualified ? 'bg-success' : 'bg-accent',
          )}
          style={{ width: `${Math.max(4, progress)}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ coupon field */

export function CouponField() {
  const cart = useCart();
  const { toast } = useUI();
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  if (cart.coupon) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-success/30 bg-success-soft px-3 py-2.5">
        <p className="flex min-w-0 items-center gap-2 text-sm">
          <Tag className="h-4 w-4 shrink-0 text-success" />
          <span className="min-w-0">
            <span className="font-semibold text-foreground">{cart.coupon.code}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {cart.coupon.label}
            </span>
          </span>
        </p>
        <button
          type="button"
          onClick={() => {
            cart.applyCoupon(null);
            setCode('');
          }}
          className="shrink-0 text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const result = validateCoupon(code, cart.items);
        if (result.ok) {
          cart.applyCoupon(result.coupon);
          setError(null);
          toast({ title: 'Coupon applied', description: result.coupon.label, tone: 'success' });
        } else {
          setError(result.reason);
        }
      }}
    >
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          placeholder="Coupon code"
          aria-label="Coupon code"
          aria-invalid={Boolean(error)}
          className="uppercase"
        />
        <Button type="submit" variant="outline" className="shrink-0">
          Apply
        </Button>
      </div>
      {error ? <p className="mt-1.5 text-xs font-medium text-destructive">{error}</p> : null}
    </form>
  );
}

/* ----------------------------------------------------------- order summary */

export function OrderSummary({
  totals,
  showGst = false,
  children,
}: {
  totals: CartTotals;
  showGst?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5 text-sm">
      <Row label={`Subtotal (${totals.itemCount} ${totals.itemCount === 1 ? 'item' : 'items'})`}>
        {formatPrice(totals.subtotal)}
      </Row>
      {totals.productSavings > 0 ? (
        <Row label="Product savings" tone="success">
          −{formatPrice(totals.productSavings)}
        </Row>
      ) : null}
      {totals.couponDiscount > 0 ? (
        <Row label="Coupon discount" tone="success">
          −{formatPrice(totals.couponDiscount)}
        </Row>
      ) : null}
      <Row label="Delivery" tone={totals.shipping === 0 ? 'success' : undefined}>
        {totals.shipping === 0 ? 'Free' : formatPrice(totals.shipping)}
      </Row>

      {children}

      <div className="flex items-baseline justify-between border-t border-border pt-3">
        <span className="font-display text-base font-bold text-foreground">Total</span>
        <span className="tabular font-display text-xl font-bold text-foreground">
          {formatPrice(totals.total)}
        </span>
      </div>
      {showGst ? (
        <p className="text-xs text-muted-foreground">
          Inclusive of {formatPrice(totals.gstIncluded)} GST. A GST invoice is issued with every
          order.
        </p>
      ) : null}
      {totals.totalSavings > 0 ? (
        <p className="rounded-sm bg-success-soft px-2.5 py-2 text-xs font-semibold text-success">
          You save {formatPrice(totals.totalSavings)} on this order.
        </p>
      ) : null}
    </div>
  );
}

function Row({
  label,
  children,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  tone?: 'success';
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn('tabular font-medium', tone === 'success' ? 'text-success' : 'text-foreground')}
      >
        {children}
      </span>
    </div>
  );
}
