'use client';

import type { NavCategory } from '@/lib/navigation';
import { AnnouncementBar } from './announcement-bar';
import { BottomNav } from './bottom-nav';
import { CartDrawer } from '@/components/cart/cart-drawer';
import { CompareTray } from '@/components/product/compare-tray';
import { Header } from './header';
import { MobileNav } from './mobile-nav';
import { SearchOverlay } from './search-overlay';
import { Toaster } from '@/components/ui/toaster';

/**
 * All interactive chrome in one client boundary, so the page tree below it can
 * stay entirely server-rendered.
 */
export function SiteChromeTop({ categories }: { categories: NavCategory[] }) {
  return (
    <>
      <AnnouncementBar />
      <Header categories={categories} />
    </>
  );
}

export function SiteChromeBottom({ categories }: { categories: NavCategory[] }) {
  return (
    <>
      <MobileNav categories={categories} />
      <SearchOverlay />
      <CartDrawer />
      <CompareTray />
      <BottomNav />
      <Toaster />
    </>
  );
}
