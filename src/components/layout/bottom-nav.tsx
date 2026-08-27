'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Grid2x2, Home, Search, ShoppingCart, User } from 'lucide-react';
import { useCart } from '@/lib/store/hooks';
import { useUI } from '@/lib/store/ui-provider';
import { cn } from '@/lib/utils';

/**
 * Mobile bottom navigation.
 *
 * Thumb-reachable access to the five destinations that carry almost all mobile
 * traffic. Hidden from `lg` up, where the header carries the same actions.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { open } = useUI();
  const cart = useCart();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const itemClass = (active: boolean) =>
    cn(
      'flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium transition-colors',
      active ? 'text-primary-600' : 'text-muted-foreground',
    );

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      style={{ height: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex h-[var(--bottom-nav-height)] items-stretch">
        <Link href="/" className={itemClass(isActive('/'))}>
          <Home className="h-5 w-5" />
          Home
        </Link>
        <button type="button" onClick={() => open('nav')} className={itemClass(false)}>
          <Grid2x2 className="h-5 w-5" />
          Categories
        </button>
        <button type="button" onClick={() => open('search')} className={itemClass(false)}>
          <Search className="h-5 w-5" />
          Search
        </button>
        <button
          type="button"
          onClick={() => open('cart')}
          className={itemClass(isActive('/cart'))}
          aria-label={`Cart, ${cart.totals.itemCount} items`}
        >
          <span className="relative">
            <ShoppingCart className="h-5 w-5" />
            {cart.hydrated && cart.totals.itemCount > 0 ? (
              <span className="tabular absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[0.5625rem] font-bold text-accent-foreground">
                {cart.totals.itemCount}
              </span>
            ) : null}
          </span>
          Cart
        </button>
        <Link href="/account" className={itemClass(isActive('/account'))}>
          <User className="h-5 w-5" />
          Account
        </Link>
      </div>
    </nav>
  );
}
