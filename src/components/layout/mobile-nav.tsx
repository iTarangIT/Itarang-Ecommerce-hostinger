'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronDown,
  ChevronRight,
  Headphones,
  Heart,
  LayoutGrid,
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
  { label: 'All products', href: '/products', icon: LayoutGrid },
  { label: 'Offers', href: '/offers', icon: Sparkles },
  { label: 'Load calculator', href: '/tools/load-calculator', icon: Package },
  { label: 'Track order', href: '/track', icon: MapPin },
  { label: 'Support', href: '/support', icon: Headphones },
];

const ACCOUNT_LINKS = [
  { label: 'Your account', href: '/account', icon: User },
  { label: 'Saved products', href: '/account?tab=wishlist', icon: Heart },
];

/** One row style for every link in the drawer, so the sections read as one list. */
const ROW =
  'flex min-h-[3rem] items-center gap-3 rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-4 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function LinkRow({
  href,
  label,
  icon: Icon,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onNavigate: () => void;
}) {
  return (
    <li>
      <Link href={href} onClick={onNavigate} className={ROW}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-secondary text-primary-600">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

/**
 * Mobile navigation drawer.
 *
 * Three labelled sections — Shop, Explore, Account — sharing one row style,
 * with the support line pinned in the drawer footer so it is always in reach.
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
      description="Lithium batteries, made in India by Trontek"
      footer={
        <a
          href={SITE.phoneHref}
          className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3 transition-colors hover:bg-secondary"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <Phone className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">Need help? Call us</span>
            <span className="block text-sm font-semibold text-foreground">{SITE.phone}</span>
            <span className="block text-xs text-muted-foreground">{SITE.supportHours}</span>
          </span>
        </a>
      }
    >
      <nav aria-label="Mobile" className="flex flex-col px-2 pb-4">
        <SectionLabel>Shop</SectionLabel>
        <ul>
          {categories.map((category) => {
            const isOpen = expanded === category.slug;
            return (
              <li key={category.slug}>
                <div className="flex items-center gap-1">
                  <Link href={category.href} onClick={close} className={cn(ROW, 'flex-1')}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-secondary text-primary-600">
                      <CategoryIcon kind={category.icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
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
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary"
                  >
                    <ChevronDown
                      className={cn('h-5 w-5 transition-transform duration-200', isOpen && 'rotate-180')}
                    />
                  </button>
                </div>
                {isOpen ? (
                  <ul className="animate-fade-in ml-[1.6rem] border-l border-border py-1 pl-3">
                    {category.subcategories.map((sub) => (
                      <li key={sub.href}>
                        <Link
                          href={sub.href}
                          onClick={close}
                          className="flex min-h-[2.5rem] items-center justify-between gap-2 rounded-md px-3 text-sm text-foreground transition-colors hover:bg-secondary"
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

        <SectionLabel>Explore</SectionLabel>
        <ul>
          {QUICK_LINKS.map((link) => (
            <LinkRow key={link.href} {...link} onNavigate={close} />
          ))}
        </ul>

        <SectionLabel>Account</SectionLabel>
        <ul>
          {ACCOUNT_LINKS.map((link) => (
            <LinkRow key={link.href} {...link} onNavigate={close} />
          ))}
        </ul>
      </nav>
    </Drawer>
  );
}
