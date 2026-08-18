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
  showEmi = false,
  showTaxNote = false,
  className,
}: {
  price: Paise;
  mrp: Paise;
  discount: number;
  size?: 'sm' | 'md' | 'lg';
  showEmi?: boolean;
  showTaxNote?: boolean;
  className?: string;
}) {
  const priceClass = {
    sm: 'text-base',
    md: 'text-lg sm:text-xl',
    lg: 'text-2xl sm:text-3xl',
  }[size];

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={cn('tabular font-display font-bold text-foreground', priceClass)}>
          {formatPrice(price)}
        </span>
        {mrp > price ? (
          <>
            <span className="tabular text-sm text-muted-foreground line-through">
              {formatPrice(mrp)}
            </span>
            {discount > 0 ? (
              <span className="tabular rounded-sm bg-sale-soft px-1.5 py-0.5 text-xs font-bold text-sale">
                {discount}% off
              </span>
            ) : null}
          </>
        ) : null}
      </div>
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
