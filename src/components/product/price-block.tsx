import type { Paise } from '@/lib/commerce/types';
import { emiPerMonth, formatPrice } from '@/lib/catalog/pricing';
import { cn } from '@/lib/utils';

/**
 * Price presentation.
 *
 * Selling price leads, MRP is struck through beside it, and the discount is
 * stated as a percentage — the three facts an Indian D2C shopper scans for.
 */
export function PriceBlock({
  price,
  mrp,
  discount,
  size = 'md',
  from = false,
  discountPlacement = 'inline',
  showEmi = false,
  showTaxNote = false,
  className,
}: {
  price: Paise;
  mrp: Paise;
  discount: number;
  size?: 'sm' | 'md' | 'lg';
  /**
   * Prefix the price with "From". Set when the product's variants are not all
   * the same price, so a single figure would overstate what is on offer.
   */
  from?: boolean;
  /**
   * Where the discount pill sits. Cards give it its own line, where it is the
   * last thing read before the buy button; the buy box keeps it inline with
   * the price it applies to.
   */
  discountPlacement?: 'inline' | 'below';
  showEmi?: boolean;
  showTaxNote?: boolean;
  className?: string;
}) {
  const priceClass = {
    sm: 'text-base',
    md: 'text-lg sm:text-xl',
    lg: 'text-2xl sm:text-3xl',
  }[size];

  const showDiscount = mrp > price && discount > 0;

  // Green, not the crimson `sale` tokens: on a card the pill is read as the
  // saving rather than as an alarm, and it sits directly under the price it
  // reduces.
  const pill = (
    <span className="tabular inline-flex rounded-sm bg-success-soft px-1.5 py-0.5 text-xs font-bold text-success">
      {discount}% OFF
    </span>
  );

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {from ? (
          <span className="text-sm font-medium text-muted-foreground">From</span>
        ) : null}
        <span className={cn('tabular font-display font-bold text-foreground', priceClass)}>
          {formatPrice(price)}
        </span>
        {mrp > price ? (
          <span className="tabular text-sm text-muted-foreground line-through">
            {formatPrice(mrp)}
          </span>
        ) : null}
        {showDiscount && discountPlacement === 'inline' ? pill : null}
      </div>
      {showDiscount && discountPlacement === 'below' ? <div className="mt-1.5">{pill}</div> : null}
      {showTaxNote ? (
        <p className="mt-1 text-xs text-muted-foreground">Inclusive of all taxes</p>
      ) : null}
      {showEmi && price >= 500000 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Or <span className="tabular font-semibold text-foreground">{formatPrice(emiPerMonth(price, 6))}</span>
          /month on 6-month no-cost EMI
        </p>
      ) : null}
    </div>
  );
}
