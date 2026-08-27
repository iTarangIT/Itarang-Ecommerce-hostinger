'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import type { NavCategory } from '@/lib/navigation';
import { formatPrice } from '@/lib/catalog/pricing';
import { CategoryIcon } from './category-icon';
import { cn } from '@/lib/utils';

/**
 * Desktop mega menu.
 *
 * Opens on hover and on keyboard activation, closes on Escape, on blur out of
 * the panel and on route change. Each panel carries the subcategory list, the
 * category's selling points and one featured product.
 */
export function MegaMenu({ categories }: { categories: NavCategory[] }) {
  const [openSlug, setOpenSlug] = React.useState<string | null>(null);
  const closeTimer = React.useRef<number | undefined>(undefined);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpenSlug(null), 140);
  };

  React.useEffect(() => () => cancelClose(), []);

  React.useEffect(() => {
    if (!openSlug) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenSlug(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openSlug]);

  return (
    <div
      ref={containerRef}
      className="hidden lg:flex lg:items-center lg:gap-1"
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node)) setOpenSlug(null);
      }}
    >
      {categories.map((category) => {
        const isOpen = openSlug === category.slug;
        return (
          <div
            key={category.slug}
            className="static"
            onMouseEnter={() => {
              cancelClose();
              setOpenSlug(category.slug);
            }}
            onMouseLeave={scheduleClose}
          >
            <Link
              href={category.href}
              aria-expanded={isOpen}
              aria-haspopup="true"
              onFocus={() => setOpenSlug(category.slug)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setOpenSlug(category.slug);
                }
              }}
              className={cn(
                'relative flex h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
                isOpen ? 'text-primary-600' : 'text-foreground hover:text-primary-600',
              )}
            >
              {category.shortName}
              <span
                className={cn(
                  'absolute inset-x-3 -bottom-px h-0.5 origin-left rounded-full bg-accent transition-transform duration-200',
                  isOpen ? 'scale-x-100' : 'scale-x-0',
                )}
              />
            </Link>

            {isOpen ? (
              <div
                className="absolute inset-x-0 top-full z-50 animate-fade-in border-t border-border bg-card shadow-overlay"
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
              >
                <div className="container grid grid-cols-12 gap-8 py-7">
                  <div className="col-span-3">
                    <div className="flex items-center gap-2 text-primary">
                      <CategoryIcon kind={category.icon} />
                      <h3 className="font-display text-base font-bold">{category.name}</h3>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {category.tagline}
                    </p>
                    <ul className="mt-4 space-y-2">
                      {category.highlights.map((highlight) => (
                        <li
                          key={highlight}
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                        >
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                          {highlight}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={category.href}
                      className="group mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary-600"
                    >
                      View all {category.total} products
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>

                  <div className="col-span-6">
                    <p className="eyebrow">Shop by type</p>
                    <ul className="mt-3 grid grid-cols-2 gap-1">
                      {category.subcategories.map((sub) => (
                        <li key={sub.href}>
                          <Link
                            href={sub.href}
                            className="group flex flex-col gap-0.5 rounded-md p-3 transition-colors hover:bg-secondary"
                          >
                            <span className="flex items-center gap-2 text-sm font-semibold text-foreground group-hover:text-primary-600">
                              {sub.name}
                              <span className="tabular text-xs font-normal text-muted-foreground">
                                {sub.count}
                              </span>
                            </span>
                            <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                              {sub.description}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {category.featured ? (
                    <div className="col-span-3">
                      <p className="eyebrow">Most popular</p>
                      <Link
                        href={category.featured.href}
                        className="group mt-3 block overflow-hidden rounded-lg border border-border transition-shadow hover:shadow-raised"
                      >
                        <div className="relative aspect-[4/3] bg-secondary">
                          <Image
                            src={category.featured.image}
                            alt=""
                            fill
                            sizes="240px"
                            className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        </div>
                        <div className="p-3">
                          <p className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-primary-600">
                            {category.featured.title}
                          </p>
                          <p className="mt-1.5 flex items-baseline gap-2">
                            <span className="tabular font-display text-base font-bold text-foreground">
                              {formatPrice(category.featured.price)}
                            </span>
                            {category.featured.mrp > category.featured.price ? (
                              <span className="tabular text-xs text-muted-foreground line-through">
                                {formatPrice(category.featured.mrp)}
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
      })}
    </div>
  );
}
