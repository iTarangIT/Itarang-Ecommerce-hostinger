import { cn } from '@/lib/utils';
import type { OrderStatus, PaymentStatus } from '@/lib/orders/types';

const ORDER_TONES: Record<OrderStatus, string> = {
  pending_payment: 'bg-warning-soft text-warning',
  confirmed: 'bg-success-soft text-success',
  packed: 'bg-secondary text-secondary-foreground',
  shipped: 'bg-accent-50 text-accent-600',
  delivered: 'bg-success-soft text-success',
  cancelled: 'bg-sale-soft text-sale',
};

const PAYMENT_TONES: Record<PaymentStatus, string> = {
  pending: 'bg-warning-soft text-warning',
  authorized: 'bg-accent-50 text-accent-600',
  paid: 'bg-success-soft text-success',
  failed: 'bg-sale-soft text-sale',
  refunded: 'bg-secondary text-secondary-foreground',
};

export function StatusPill({
  kind,
  value,
  className,
}: {
  kind: 'order' | 'payment';
  value: string;
  className?: string;
}) {
  const tone =
    kind === 'order'
      ? (ORDER_TONES[value as OrderStatus] ?? 'bg-secondary text-secondary-foreground')
      : (PAYMENT_TONES[value as PaymentStatus] ?? 'bg-secondary text-secondary-foreground');

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide',
        tone,
        className,
      )}
    >
      {value.replace(/_/g, ' ')}
    </span>
  );
}
