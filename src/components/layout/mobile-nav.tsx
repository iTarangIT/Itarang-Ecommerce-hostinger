'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronDown,
  Headphones,
  Heart,
  MapPin,
  Package,
  Phone,
  Sparkles,
  User,
} from 'lucide-react';
import type { NavCategory } from '@/lib/navigation';
import { SITE } from '@/lib/site';
import { useUI } from '@/lib/store/ui-provider';
import { Drawer } from '@/components/ui/overlay';
import { CategoryIcon } from './category-icon';
import { cn } from '@/lib/utils';

const QUICK_LINKS = [
  { label: 'Offers', href: '/offers', icon: Sparkles },
  { label: 'Load calculator', href: '/tools/load-calculator', icon: Package },
  { label: 'Track order', href: '/track', icon: MapPin },
  { label: 'Support', href: '/support', icon: Headphones },
];

/**
 * Mobile navigation drawer.
 *
 * Categories are accordions rather than a drill-down stack: on a four-family
 * catalogue an accordion shows the whole structure without hiding the parent.
 */
export function MobileNav({ categories }: { categories: NavCategory[] }) {
  const { overlay, close } = useUI();
  const pathname = usePathname();
  const [expanded, setExpanded] = React.useState<string | null>(null);

  React.useEffect(() => {
    close();
    // Route change should always dismiss the drawer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <Drawer
      open={overlay === 'nav'}
      onClose={close}
      side="left"
      title="Browse iTarang"
      description="Inverters, batteries, UPS and combos"
    >
      <nav aria-label="Mobile" className="flex flex-col">
        <ul className="border-b border-border">
          {categories.map((category) => {
            const isOpen = expanded === category.slug;
            return (
              <li key={category.slug} className="border-b border-border last:border-b-0">
                <div className="flex items-stretch">
                  <Link
                    href={category.href}
                    onClick={close}
                    className="flex min-h-[3.25rem] flex-1 items-center gap-3 px-4 text-[0.95rem] font-semibold text-foreground"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-secondary text-primary">
                      <CategoryIcon kind={category.icon} className="h-4.5 w-4.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate">{category.name}</span>
                      <span className="block truncate text-xs font-normal text-muted-foreground">
                        {category.total} products
                      </span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : category.slug)}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${category.name}`}
                    className="grid w-12 shrink-0 place-items-center border-l border-border text-muted-foreground transition-colors hover:bg-secondary"
                  >
                    <ChevronDown
                      className={cn('h-5 w-5 transition-transform duration-200', isOpen && 'rotate-180')}
                    />
                  </button>
                </div>
                {isOpen ? (
                  <ul className="animate-fade-in bg-surface pb-2">
                    {category.subcategories.map((sub) => (
                      <li key={sub.href}>
                        <Link
                          href={sub.href}
                          onClick={close}
                          className="flex min-h-[2.75rem] items-center justify-between gap-2 py-2 pl-16 pr-4 text-sm text-foreground"
                        >
                          <span>{sub.name}</span>
                          <span className="tabular text-xs text-muted-foreground">{sub.count}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>

        <ul className="grid grid-cols-2 gap-px border-b border-border bg-border">
          {QUICK_LINKS.map((link) => (
            <li key={link.href} className="bg-card">
              <Link
                href={link.href}
                onClick={close}
                className="flex min-h-[3.5rem] items-center gap-2.5 px-4 text-sm font-medium text-foreground"
              >
                <link.icon className="h-4.5 w-4.5 shrink-0 text-accent-600" />
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <ul className="border-b border-border">
          <li>
            <Link
              href="/account"
              onClick={close}
              className="flex min-h-[3rem] items-center gap-3 px-4 text-sm font-medium text-foreground"
            >
              <User className="h-4.5 w-4.5 text-muted-foreground" />
              Your account
            </Link>
          </li>
          <li>
            <Link
              href="/account?tab=wishlist"
              onClick={close}
              className="flex min-h-[3rem] items-center gap-3 px-4 text-sm font-medium text-foreground"
            >
              <Heart className="h-4.5 w-4.5 text-muted-foreground" />
              Saved products
            </Link>
          </li>
        </ul>

        <a
          href={SITE.phoneHref}
          className="flex min-h-[3.5rem] items-center gap-3 px-4 text-sm font-semibold text-primary"
        >
          <Phone className="h-4.5 w-4.5 text-accent-600" />
          <span>
            {SITE.phone}
            <span className="block text-xs font-normal text-muted-foreground">
              {SITE.supportHours}
            </span>
          </span>
        </a>
      </nav>
    </Drawer>
  );
}
