import * as React from 'react';
import { cn } from '@/lib/utils';
import { ButtonLink } from './button';

/**
 * Shared empty / error presentation.
 *
 * Every empty state on the site explains what is missing and offers a concrete
 * next action — never a bare "nothing here".
 */
export function StateBlock({
  icon,
  title,
  description,
  actions,
  className,
  tone = 'neutral',
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  tone?: 'neutral' | 'error';
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center sm:py-16',
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            'mb-4 grid h-14 w-14 place-items-center rounded-full',
            tone === 'error' ? 'bg-sale-soft text-sale' : 'bg-secondary text-primary',
          )}
        >
          {icon}
        </div>
      ) : null}
      <h2 className="font-display text-lg font-bold text-card-foreground sm:text-xl">{title}</h2>
      {description ? (
        <div className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </div>
      ) : null}
      {actions ? <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function SupportNudge({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border border-border bg-secondary/60 p-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div>
        <p className="font-display text-sm font-semibold text-foreground">
          Not sure what you need?
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Size a system from your actual appliances, or talk to one of our engineers.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <ButtonLink href="/tools/load-calculator" size="sm" variant="accent">
          Load calculator
        </ButtonLink>
        <ButtonLink href="/support" size="sm" variant="outline">
          Contact support
        </ButtonLink>
      </div>
    </div>
  );
}
