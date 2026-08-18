'use client';

import Image from 'next/image';
import { AlertTriangle, ShieldCheck, Truck } from 'lucide-react';
import type { CartItem } from '@/lib/store/types';
import type { CartTotals } from '@/lib/store/totals';
import { formatPrice } from '@/lib/catalog/pricing';
import type { QuoteIssue } from '@/lib/orders/quote';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Order summary.
 *
 * Every figure shown here comes from the server quote, not from the client
 * cart — so the price on screen is the price that will be charged.
 */
export function OrderSummaryPanel({
  items,
  totals,
  issues,
  loading,
}: {
  items: CartItem[];
  totals: CartTotals | null;
  issues: QuoteIssue[];
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-display text-base font-bold text-card-foreground">Order summary</h2>

      <ul className="mt-4 space-y-3 border-b border-border pb-4">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3">
            <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-surface">
              {item.image ? (
                <Image src={item.image} alt="" fill sizes="56px" className="object-contain p-1" />
              ) : null}
              <span className="tabular absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-2xs font-bold text-primary-foreground">
                {item.quantity}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm font-medium text-foreground">{item.title}</span>
              {item.variantTitle ? (
                <span className="block text-xs text-muted-foreground">{item.variantTitle}</span>
              ) : null}
            </span>
            <span className="tabular shrink-0 text-sm font-semibold text-foreground">
              {formatPrice(item.price.selling * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      {issues.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {issues.map((issue, index) => (
            <li
              key={`${issue.code}-${index}`}
              className="flex items-start gap-2 rounded-md bg-warning-soft p-2.5 text-xs text-foreground"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}

      {loading || !totals ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-6 w-1/2" />
        </div>
      ) : (
        <dl className="mt-4 space-y-2.5 text-sm">
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
          {totals.codFee > 0 ? (
            <Row label="Cash on delivery fee">{formatPrice(totals.codFee)}</Row>
          ) : null}

          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <dt className="font-display text-base font-bold text-foreground">Total</dt>
            <dd className="tabular font-display text-xl font-bold text-foreground">
              {formatPrice(totals.total)}
            </dd>
          </div>
          <p className="text-xs text-muted-foreground">
            Inclusive of {formatPrice(totals.gstIncluded)} GST.
          </p>
        </dl>
      )}

      <ul className="mt-5 space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <li className="flex items-center gap-2">
          <Truck className="h-4 w-4 shrink-0 text-success" />
          Free delivery above ₹4,999
        </li>
        <li className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
          Documented warranty with every product
        </li>
      </ul>
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
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn('tabular font-medium', tone === 'success' ? 'text-success' : 'text-foreground')}
      >
        {children}
      </dd>
    </div>
  );
}
