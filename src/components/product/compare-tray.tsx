'use client';

import { usePathname } from 'next/navigation';
import { GitCompare, X } from 'lucide-react';
import { useCompare } from '@/lib/store/hooks';
import { ButtonLink } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PRODUCT_PREFIX } from '@/lib/routes';

/**
 * Floating compare tray.
 *
 * Appears once anything is selected for comparison and sits above the mobile
 * bottom navigation. Hidden on the compare page itself.
 */
export function CompareTray() {
  const compare = useCompare();
  const pathname = usePathname();

  if (compare.ids.length === 0 || pathname === '/compare') return null;

  // Product pages carry their own sticky buy bar, so the tray sits above it.
  const onProductPage = pathname.startsWith(`${PRODUCT_PREFIX}/`);

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 z-40 px-3',
        onProductPage
          ? 'bottom-[calc(var(--bottom-nav-height)+4.5rem)] lg:bottom-[4.75rem]'
          : 'bottom-[calc(var(--bottom-nav-height)+0.5rem)] lg:bottom-5',
      )}
    >
      <div className="pointer-events-auto mx-auto flex max-w-2xl animate-fade-up items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-overlay">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-secondary text-primary">
          <GitCompare className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-card-foreground">
            {compare.ids.length} of {compare.max} selected
          </p>
          <button
            type="button"
            onClick={compare.clear}
            className="text-xs text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
          >
            Clear selection
          </button>
        </div>
        <ButtonLink href="/compare" variant="accent" size="sm" className="shrink-0">
          Compare
        </ButtonLink>
        <button
          type="button"
          onClick={compare.clear}
          aria-label="Dismiss comparison tray"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
