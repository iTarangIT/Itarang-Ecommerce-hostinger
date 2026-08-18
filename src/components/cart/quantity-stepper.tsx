'use client';

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export function QuantityStepper({
  value,
  onChange,
  max,
  min = 1,
  size = 'md',
  label = 'Quantity',
}: {
  value: number;
  onChange: (next: number) => void;
  max: number;
  min?: number;
  size?: 'sm' | 'md';
  label?: string;
}) {
  const atMax = value >= max;
  const btn = cn(
    'grid shrink-0 place-items-center text-foreground transition-colors disabled:opacity-35',
    size === 'sm' ? 'h-9 w-9' : 'h-11 w-11',
    'hover:bg-secondary disabled:hover:bg-transparent',
  );

  return (
    <div className="inline-flex items-center rounded-md border border-input bg-card">
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={`Decrease ${label.toLowerCase()}`}
      >
        <Minus className="h-4 w-4" />
      </button>
      <span
        aria-live="polite"
        className={cn(
          'tabular w-9 text-center text-sm font-semibold text-foreground',
          size === 'sm' && 'w-8',
        )}
      >
        {value}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value + 1)}
        disabled={atMax}
        aria-label={`Increase ${label.toLowerCase()}`}
        title={atMax ? `Only ${max} available` : undefined}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
