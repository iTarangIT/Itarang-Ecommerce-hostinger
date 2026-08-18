'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AccordionItemProps {
  id: string;
  title: React.ReactNode;
  /** Small count or status shown next to the title. */
  meta?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function Accordion({
  items,
  className,
  /** Allow several panels open at once. */
  multiple = true,
}: {
  items: AccordionItemProps[];
  className?: string;
  multiple?: boolean;
}) {
  const [open, setOpen] = React.useState<string[]>(() =>
    items.filter((i) => i.defaultOpen).map((i) => i.id),
  );

  const toggle = (id: string) => {
    setOpen((current) => {
      const isOpen = current.includes(id);
      if (multiple) return isOpen ? current.filter((x) => x !== id) : [...current, id];
      return isOpen ? [] : [id];
    });
  };

  return (
    <div className={cn('divide-y divide-border rounded-lg border border-border bg-card', className)}>
      {items.map((item) => {
        const isOpen = open.includes(item.id);
        return (
          <div key={item.id}>
            <h3>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                aria-expanded={isOpen}
                aria-controls={`panel-${item.id}`}
                className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-secondary/60 sm:px-5"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="font-display text-[0.95rem] font-semibold text-card-foreground">
                    {item.title}
                  </span>
                  {item.meta ? (
                    <span className="text-xs text-muted-foreground">{item.meta}</span>
                  ) : null}
                </span>
                <ChevronDown
                  className={cn(
                    'h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200',
                    isOpen && 'rotate-180 text-accent-600',
                  )}
                />
              </button>
            </h3>
            <div
              id={`panel-${item.id}`}
              hidden={!isOpen}
              className="animate-fade-in px-4 pb-5 pt-0 sm:px-5"
            >
              {item.children}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Sidebar-style collapsible used by the filter panel. */
export function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  meta,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  meta?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const id = React.useId();

  return (
    <div className="border-b border-border py-4 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
          {title}
        </span>
        <span className="flex items-center gap-2">
          {meta}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </span>
      </button>
      <div id={id} hidden={!open} className="mt-3">
        {children}
      </div>
    </div>
  );
}
