'use client';

import * as React from 'react';
import { Check, Copy, Tag } from 'lucide-react';
import type { CouponRule } from '@/lib/offers/coupons';
import { formatPrice } from '@/lib/catalog/pricing';
import { useUI } from '@/lib/store/ui-provider';
import { cn } from '@/lib/utils';

export function CouponCard({ coupon }: { coupon: CouponRule }) {
  const { toast } = useUI();
  const [copied, setCopied] = React.useState(false);

  const value =
    coupon.kind === 'percent'
      ? `${coupon.value}% off`
      : coupon.kind === 'free-shipping'
        ? 'Free delivery'
        : `${formatPrice(coupon.value)} off`;

  return (
    <article className="flex h-full flex-col rounded-lg border border-dashed border-accent/50 bg-accent-50 p-5">
      <Tag className="h-5 w-5 text-accent-600" />
      <p className="mt-3 font-display text-lg font-bold text-foreground">{value}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{coupon.label}</p>
      <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground">
        {coupon.description}
      </p>

      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(coupon.code).then(
            () => {
              setCopied(true);
              toast({
                title: 'Code copied',
                description: `Paste ${coupon.code} into the coupon field in your cart.`,
                tone: 'success',
              });
              window.setTimeout(() => setCopied(false), 2500);
            },
            () => toast({ title: 'Could not copy the code', tone: 'error' }),
          );
        }}
        className={cn(
          'mt-4 flex items-center justify-between gap-2 rounded-md border border-dashed border-accent bg-card px-3 py-2.5 text-sm font-bold tracking-wide text-accent-600 transition-colors hover:bg-accent hover:text-accent-foreground',
          copied && 'bg-success text-success-foreground hover:bg-success',
        )}
      >
        <span className="tabular">{coupon.code}</span>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        <span className="sr-only">Copy coupon code</span>
      </button>
    </article>
  );
}
