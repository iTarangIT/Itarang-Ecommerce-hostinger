import * as React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * One collapsible panel in the product page's lower stack.
 *
 * Built on `<details>` rather than the shared `Accordion` for two reasons.
 * Visually, `Accordion` is one bordered stack with hairline dividers, and this
 * stack is a column of separate cards. Practically, `<details>` opens and
 * closes with no JavaScript at all — no state, no hydration, and the content
 * stays in the document for search engines and for find-in-page.
 *
 * The `<summary>` marker is suppressed and replaced with a +/− pair swapped by
 * `group-open:`, matching how a retail page signals a closed section.
 */
export function CollapsibleCard({
  title,
  meta,
  defaultOpen = false,
  children,
  className,
}: {
  title: React.ReactNode;
  /** Small count or status set beside the title. */
  meta?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn('group overflow-hidden rounded-lg border border-border bg-card', className)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 transition-colors marker:hidden hover:bg-secondary/60 [&::-webkit-details-marker]:hidden">
        <span className="font-display text-sm font-semibold text-card-foreground">{title}</span>
        <span className="flex shrink-0 items-center gap-2">
          {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
          <Plus className="h-4 w-4 text-muted-foreground group-open:hidden" />
          <Minus className="hidden h-4 w-4 text-primary group-open:block" />
        </span>
      </summary>
      <div className="border-t border-border px-4 py-4">{children}</div>
    </details>
  );
}
