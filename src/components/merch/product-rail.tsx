'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ProductSummary } from '@/lib/commerce/summary';
import { ProductCard } from '@/components/product/product-card';
import { SectionHeader } from '@/components/ui/section';
import { cn } from '@/lib/utils';

/**
 * Horizontal product rail.
 *
 * Scroll-snapped and edge-to-edge on mobile; arrow controls appear on pointer
 * devices once there is something to scroll to.
 */
export function ProductRail({
  products,
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  products: ProductSummary[];
  eyebrow?: string;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const updateArrows = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  React.useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [updateArrows, products.length]);

  const scrollBy = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(280, el.clientWidth * 0.8), behavior: 'smooth' });
  };

  if (products.length === 0) return null;

  return (
    <section className={cn('relative', className)}>
      <div className="flex items-end justify-between gap-4">
        <SectionHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          action={action}
          className="mb-4 flex-1 sm:mb-5"
        />
        <div className="mb-4 hidden shrink-0 gap-2 sm:mb-5 lg:flex">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            disabled={!canScrollLeft}
            aria-label="Scroll left"
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-primary/30 hover:bg-secondary disabled:opacity-35"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            disabled={!canScrollRight}
            aria-label="Scroll right"
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-primary/30 hover:bg-secondary disabled:opacity-35"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div ref={scrollerRef} className="rail">
        {products.map((product) => (
          <div
            key={product.id}
            className="w-[62vw] shrink-0 xs:w-[44vw] sm:w-[17rem] lg:w-[18.5rem]"
          >
            <ProductCard product={product} layout="rail" />
          </div>
        ))}
      </div>
    </section>
  );
}
