import { cn } from '@/lib/utils';
import type { ProductStatus } from '@/lib/products/types';

/**
 * Publishing state, as a pill.
 *
 * A sibling of `StatusPill` rather than a third `kind` on it: that component's
 * two vocabularies are order and payment status, both fulfilment concepts read
 * from the same tables. Publishing is a different domain, and widening the
 * union there would put product states into a component every order screen
 * imports.
 *
 * Draft is warning-toned on purpose. It is the state a product is stuck in when
 * something is missing, and the list should make that obvious at a glance.
 */
const TONES: Record<ProductStatus, string> = {
  draft: 'bg-warning-soft text-warning',
  published: 'bg-success-soft text-success',
  archived: 'bg-secondary text-secondary-foreground',
};

export function ProductStatusPill({
  status,
  className,
}: {
  status: ProductStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide',
        TONES[status],
        className,
      )}
    >
      {status}
    </span>
  );
}
