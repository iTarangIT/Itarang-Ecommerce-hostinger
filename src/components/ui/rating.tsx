import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZES = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' } as const;

/**
 * Star rating. Renders a half-filled star with a clip so 4.6 does not read as 5.
 */
export function Rating({
  value,
  size = 'sm',
  className,
}: {
  value: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className="relative inline-block">
            <Star className={cn(SIZES[size], 'text-primary-200')} strokeWidth={1.5} />
            {fill > 0 && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star className={cn(SIZES[size], 'fill-accent text-accent')} strokeWidth={1.5} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

export function RatingSummaryInline({
  average,
  count,
  size = 'sm',
  className,
  href,
}: {
  average: number;
  count: number;
  size?: keyof typeof SIZES;
  className?: string;
  href?: string;
}) {
  const content = (
    <>
      <Rating value={average} size={size} />
      <span className="tabular text-sm font-semibold text-foreground">{average.toFixed(1)}</span>
      <span className="text-sm text-muted-foreground">({count})</span>
    </>
  );

  const classes = cn('inline-flex items-center gap-1.5', className);

  if (href) {
    return (
      <a href={href} className={cn(classes, 'transition-colors hover:text-accent-600')}>
        <span className="sr-only">
          Rated {average.toFixed(1)} out of 5 from {count} reviews. Jump to reviews.
        </span>
        {content}
      </a>
    );
  }

  return (
    <span className={classes}>
      <span className="sr-only">
        Rated {average.toFixed(1)} out of 5 from {count} reviews
      </span>
      {content}
    </span>
  );
}
