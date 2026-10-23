'use client';

import type { NavCategory } from '@/lib/navigation';
import { AnnouncementBar } from './announcement-bar';
import { WhatsAppButton } from './whatsapp-button';
import { CookieNotice } from './cookie-notice';
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
export function SiteChromeTop({
  categories,
  announcements,
}: {
  categories: NavCategory[];
  /** One line per live campaign marked "show on site". */
  announcements: string[];
}) {
  return (
    <>
      <AnnouncementBar coupons={announcements} />
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
      <WhatsAppButton />
      <CookieNotice />
      <Toaster />
    </>
  );
}
