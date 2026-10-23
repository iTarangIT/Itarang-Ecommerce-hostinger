'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, ChevronDown } from 'lucide-react';
import type { NavCategory } from '@/lib/navigation';
import { formatPrice } from '@/lib/catalog/pricing';
import { CategoryIcon } from './category-icon';
import { cn } from '@/lib/utils';

/**
 * Desktop "All products" menu.
 *
 * One trigger in the header instead of one per category: the categories come
 * from the admin panel (`catalog_categories`), so the header must not grow a
 * new item, or need a redesign, every time a section is added. The panel lists
 * every category with its subcategories in columns, then a featured product.
 *
 * Opens on hover and on keyboard activation, closes on Escape, on blur out of
 * the panel and on route change.
 */
export function MegaMenu({ categories }: { categories: NavCategory[] }) {
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<number | undefined>(undefined);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  };

  React.useEffect(() => () => cancelClose(), []);
  React.useEffect(() => setOpen(false), [pathname]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const total = categories.reduce((sum, category) => sum + category.total, 0);
  const featured = categories.find((category) => category.featured)?.featured ?? null;
  const active = pathname.startsWith('/products') || categories.some((c) => pathname.startsWith(c.href));

  return (
    <div
      ref={containerRef}
      className="hidden lg:flex lg:items-center"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node)) setOpen(false);
      }}
    >
      <Link
        href="/products"
        aria-expanded={open}
        aria-haspopup="true"
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          'relative flex h-11 items-center gap-1 rounded-md px-3 text-sm font-medium transition-colors',
          open || active ? 'text-primary-600' : 'text-foreground hover:text-primary-600',
        )}
      >
        All products
        <ChevronDown
          className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-180')}
          aria-hidden="true"
        />
        <span
          className={cn(
            'absolute inset-x-3 -bottom-px h-0.5 origin-left rounded-full bg-accent transition-transform duration-200',
            open ? 'scale-x-100' : 'scale-x-0',
          )}
        />
      </Link>

      {open ? (
        <div
          className="absolute inset-x-0 top-full z-50 animate-fade-in border-t border-border bg-card shadow-overlay"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="container grid grid-cols-12 gap-8 py-7">
            <div className={cn('grid gap-6', featured ? 'col-span-9' : 'col-span-12', 'grid-cols-3')}>
              {categories.map((category) => (
                <div key={category.slug} className="min-w-0">
                  <Link
                    href={category.href}
                    className="group flex items-center gap-2 text-primary hover:text-primary-600"
                  >
                    <CategoryIcon kind={category.icon} />
                    <span className="font-display text-base font-bold">{category.name}</span>
                    <span className="tabular text-xs font-normal text-muted-foreground">
                      {category.total}
                    </span>
                  </Link>
                  <ul className="mt-2 space-y-0.5">
                    {category.subcategories.map((sub) => (
                      <li key={sub.href}>
                        <Link
                          href={sub.href}
                          className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary hover:text-primary-600"
                        >
                          <span className="min-w-0 truncate">{sub.name}</span>
                          <span className="tabular text-xs text-muted-foreground">{sub.count}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="col-span-3 border-t border-border pt-4">
                <Link
                  href="/products"
                  className="group inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary-600"
                >
                  View all {total} products
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>

            {featured ? (
              <div className="col-span-3">
                <p className="eyebrow">Most popular</p>
                <Link
                  href={featured.href}
                  className="group mt-3 block overflow-hidden rounded-lg border border-border transition-shadow hover:shadow-raised"
                >
                  <div className="relative aspect-[4/3] bg-secondary">
                    <Image
                      src={featured.image}
                      alt=""
                      fill
                      sizes="240px"
                      className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-primary-600">
                      {featured.title}
                    </p>
                    <p className="mt-1.5 flex items-baseline gap-2">
                      <span className="tabular font-display text-base font-bold text-foreground">
                        {formatPrice(featured.price)}
                      </span>
                      {featured.mrp > featured.price ? (
                        <span className="tabular text-xs text-muted-foreground line-through">
                          {formatPrice(featured.mrp)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
