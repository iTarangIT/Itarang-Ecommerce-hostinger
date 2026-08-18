import * as React from 'react';
import { cn } from '@/lib/utils';
import type { BadgeKind } from '@/lib/commerce/types';

type Tone = 'neutral' | 'accent' | 'sale' | 'success' | 'warning' | 'primary' | 'outline';

const TONES: Record<Tone, string> = {
  neutral: 'bg-secondary text-secondary-foreground',
  accent: 'bg-accent text-accent-foreground',
  sale: 'bg-sale text-sale-foreground',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  primary: 'bg-primary text-primary-foreground',
  outline: 'border border-border bg-card text-muted-foreground',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-2xs font-semibold uppercase tracking-wide',
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

const BADGE_META: Record<BadgeKind, { label: string; tone: Tone }> = {
  bestseller: { label: 'Bestseller', tone: 'primary' },
  new: { label: 'New', tone: 'accent' },
  sale: { label: 'Sale', tone: 'sale' },
  'combo-saver': { label: 'Combo saver', tone: 'success' },
  premium: { label: 'Premium', tone: 'outline' },
  'low-stock': { label: 'Few left', tone: 'warning' },
  'sold-out': { label: 'Sold out', tone: 'neutral' },
};

export function ProductBadge({ kind }: { kind: BadgeKind }) {
  const meta = BADGE_META[kind];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function BadgeStack({ badges, max = 2 }: { badges: BadgeKind[]; max?: number }) {
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {badges.slice(0, max).map((b) => (
        <ProductBadge key={b} kind={b} />
      ))}
    </div>
  );
}
