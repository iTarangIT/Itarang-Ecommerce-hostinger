'use client';

import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useUI } from '@/lib/store/ui-provider';
import { cn } from '@/lib/utils';

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const TONES = {
  success: 'border-success/30 text-success',
  error: 'border-destructive/30 text-destructive',
  info: 'border-accent/40 text-accent-600',
};

export function Toaster() {
  const { toasts, dismiss } = useUI();

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      /* Sits clear of the bottom nav and any sticky product bar beneath it. */
      className="pointer-events-none fixed inset-x-3 bottom-[calc(var(--bottom-nav-height)+4.75rem)] z-[90] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:items-end lg:bottom-[5rem] lg:right-6"
    >
      {toasts.map((toast) => {
        const Icon = ICONS[toast.tone];
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-lg border border-border bg-card p-3.5 shadow-overlay"
          >
            <span className={cn('mt-0.5 shrink-0', TONES[toast.tone])}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-card-foreground">{toast.title}</p>
              {toast.description ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{toast.description}</p>
              ) : null}
              {toast.action ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    dismiss(toast.id);
                  }}
                  className="mt-2 text-sm font-semibold text-accent-600 underline-offset-4 hover:underline"
                >
                  {toast.action.label}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
              className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
