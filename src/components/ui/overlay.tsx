'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------- scroll lock */

let lockCount = 0;

function useScrollLock(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    lockCount += 1;
    const { body } = document;
    const previous = body.style.overflow;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        body.style.overflow = previous;
        body.style.paddingRight = '';
      }
    };
  }, [active]);
}

/* ------------------------------------------------------------- focus trap */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useFocusTrap(active: boolean, onClose: () => void) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!active) return;
    const node = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusFirst = () => {
      const target = node?.querySelector<HTMLElement>(FOCUSABLE);
      (target ?? node)?.focus();
    };
    const timer = window.setTimeout(focusFirst, 20);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [active, onClose]);

  return ref;
}

/* ----------------------------------------------------------------- portal */

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

/* ----------------------------------------------------------------- drawer */

type Side = 'right' | 'left' | 'bottom';

const SIDE_CLASSES: Record<Side, string> = {
  right: 'inset-y-0 right-0 h-full w-full max-w-md animate-slide-in-right',
  left: 'inset-y-0 left-0 h-full w-[86%] max-w-sm animate-slide-in-left',
  bottom: 'inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl animate-slide-up',
};

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: Side;
  title: React.ReactNode;
  /** Optional description rendered under the title. */
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Sticky footer, e.g. an apply bar or checkout summary. */
  footer?: React.ReactNode;
  className?: string;
}

export function Drawer({
  open,
  onClose,
  side = 'right',
  title,
  description,
  children,
  footer,
  className,
}: DrawerProps) {
  useScrollLock(open);
  const ref = useFocusTrap(open, onClose);
  const titleId = React.useId();

  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[70]">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute inset-0 animate-fade-in bg-primary-900/55 backdrop-blur-[2px]"
        />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={cn(
            'absolute flex flex-col bg-card shadow-overlay outline-none',
            SIDE_CLASSES[side],
            className,
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
            <div className="min-w-0">
              <h2 id={titleId} className="font-display text-lg font-bold text-card-foreground">
                {title}
              </h2>
              {description ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>

          {footer ? (
            <div className="border-t border-border bg-card px-4 py-4 sm:px-5">{footer}</div>
          ) : null}
        </div>
      </div>
    </Portal>
  );
}

/* ------------------------------------------------------------------ modal */

export function Modal({
  open,
  onClose,
  label,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  useScrollLock(open);
  const ref = useFocusTrap(open, onClose);

  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute inset-0 animate-fade-in bg-primary-900/70 backdrop-blur-sm"
        />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          className={cn(
            'relative z-10 max-h-[92vh] w-full max-w-4xl animate-scale-in overflow-hidden rounded-xl bg-card shadow-overlay outline-none',
            className,
          )}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-md bg-card/90 text-foreground shadow-card transition-colors hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
          {children}
        </div>
      </div>
    </Portal>
  );
}

export { Portal, useScrollLock };
