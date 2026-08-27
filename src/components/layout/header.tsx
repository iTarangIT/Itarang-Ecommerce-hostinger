'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, Menu, Phone, Search, ShoppingCart, User } from 'lucide-react';
import type { NavCategory } from '@/lib/navigation';
import { SECONDARY_NAV, SITE, UTILITY_LINKS } from '@/lib/site';
import { useCart, useWishlist } from '@/lib/store/hooks';
import { useUI } from '@/lib/store/ui-provider';
import { cn } from '@/lib/utils';
import { Logo } from './logo';
import { MegaMenu } from './mega-menu';

/**
 * `hydrated` is what stops the badge flashing.
 *
 * The cart lives in localStorage, so the server render and the first client
 * render both see an empty store; the real count only arrives once
 * `StoreProvider`'s effect has run. Rendering nothing until then means the
 * badge appears once, with the right number, instead of appearing empty and
 * then jumping.
 */
function CountBubble({ count, hydrated }: { count: number; hydrated: boolean }) {
  if (!hydrated || count <= 0) return null;
  return (
    <span className="tabular absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[0.625rem] font-bold text-accent-foreground">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function Header({ categories }: { categories: NavCategory[] }) {
  const pathname = usePathname();
  const { open } = useUI();
  const cart = useCart();
  const wishlist = useWishlist();
  const [condensed, setCondensed] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 72);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      {/* Utility bar — collapses away once the page is scrolled. */}
      <div
        className={cn(
          'hidden overflow-hidden border-b border-border bg-surface transition-[height,opacity] duration-200 lg:block',
          condensed ? 'h-0 opacity-0' : 'h-9 opacity-100',
        )}
      >
        <div className="container flex h-9 items-center justify-between text-xs">
          <p className="text-muted-foreground">
            Pure sine wave power backup · certified installation included
          </p>
          <div className="flex items-center gap-5">
            {UTILITY_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground transition-colors hover:text-primary-600"
              >
                {link.label}
              </Link>
            ))}
            <a
              href={SITE.phoneHref}
              className="inline-flex items-center gap-1.5 font-medium text-foreground transition-colors hover:text-primary-600"
            >
              <Phone className="h-3.5 w-3.5" />
              {SITE.phone}
            </a>
          </div>
        </div>
      </div>

      <div className="container flex h-16 items-center gap-3 lg:h-[4.5rem] lg:gap-6">
        <button
          type="button"
          onClick={() => open('nav')}
          aria-label="Open menu"
          className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-md text-foreground transition-colors hover:bg-secondary lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>

        <Logo className="shrink-0" />

        <nav aria-label="Main" className="hidden min-w-0 flex-1 lg:flex lg:items-center lg:gap-1">
          <MegaMenu categories={categories} />
          <span className="mx-2 h-5 w-px bg-border" aria-hidden="true" />
          {SECONDARY_NAV.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex h-11 items-center rounded-md px-3 text-sm font-medium transition-colors',
                  active ? 'text-primary-600' : 'text-foreground hover:text-primary-600',
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
          {/* Desktop search opens the same overlay as mobile, so there is one search UX. */}
          <button
            type="button"
            onClick={() => open('search')}
            className="hidden h-11 w-56 items-center gap-2 rounded-md border border-input bg-surface px-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:bg-card xl:flex"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate">Search inverters, batteries…</span>
          </button>

          <button
            type="button"
            onClick={() => open('search')}
            aria-label="Search"
            className="grid h-11 w-11 place-items-center rounded-md text-foreground transition-colors hover:bg-secondary xl:hidden"
          >
            <Search className="h-5 w-5" />
          </button>

          <Link
            href="/account?tab=wishlist"
            aria-label={`Wishlist, ${wishlist.ids.length} items`}
            className="relative hidden h-11 w-11 place-items-center rounded-md text-foreground transition-colors hover:bg-secondary sm:grid"
          >
            <Heart className="h-5 w-5" />
            <CountBubble count={wishlist.ids.length} hydrated={wishlist.hydrated} />
          </Link>

          <Link
            href="/account"
            aria-label="Your account"
            className="hidden h-11 w-11 place-items-center rounded-md text-foreground transition-colors hover:bg-secondary sm:grid"
          >
            <User className="h-5 w-5" />
          </Link>

          <button
            type="button"
            onClick={() => open('cart')}
            aria-label={`Cart, ${cart.totals.itemCount} items`}
            className="relative grid h-11 w-11 place-items-center rounded-md text-foreground transition-colors hover:bg-secondary"
          >
            <ShoppingCart className="h-5 w-5" />
            <CountBubble count={cart.totals.itemCount} hydrated={cart.hydrated} />
          </button>
        </div>
      </div>
    </header>
  );
}
