'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { SITE } from '@/lib/site';
import { cn } from '@/lib/utils';

/**
 * Floating "Chat on WhatsApp" button.
 *
 * The message is pre-filled with the page the shopper is on — on a product page
 * that is the product's name, read from the document title at click time — so
 * the first message we receive already says what they are asking about.
 *
 * Hidden where it would get in the way of a task: checkout, the admin console
 * and the sign-in pages. On a product page it sits higher, above the sticky
 * buy bar, and steps aside while the buy box is on screen so it never covers
 * "Buy now" (R-07).
 *
 * Outlined rather than filled (R-09): orange/amber is kept for Buy and Shop
 * now, so the chat bubble does not compete with them.
 */
const HIDDEN_PREFIXES = ['/checkout', '/admin', '/login', '/register', '/staff', '/order/'];

export function WhatsAppButton() {
  const pathname = usePathname() ?? '/';
  const onProductPage = pathname.startsWith('/products/');
  const buyBoxVisible = useBuyBoxVisible(onProductPage, pathname);

  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

  const open = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const subject = document.title.split('|')[0]?.trim();
    const text = onProductPage && subject
      ? `Hi, I have a question about ${subject}.`
      : 'Hi, I need help choosing a battery.';
    event.currentTarget.href = `${SITE.whatsapp}?text=${encodeURIComponent(text)}`;
  };

  return (
    <a
      href={SITE.whatsapp}
      target="_blank"
      rel="noreferrer"
      onClick={open}
      aria-label="Chat with us on WhatsApp"
      aria-hidden={buyBoxVisible || undefined}
      tabIndex={buyBoxVisible ? -1 : undefined}
      className={cn(
        'group fixed right-4 z-40 print:hidden flex items-center gap-2 rounded-full border-2 border-primary bg-background p-3 text-primary shadow-lg transition-[transform,opacity] hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:right-6',
        onProductPage
          ? 'bottom-[calc(var(--bottom-nav-height)+5rem)] lg:bottom-24'
          : 'bottom-[calc(var(--bottom-nav-height)+1rem)] lg:bottom-6',
        buyBoxVisible && 'pointer-events-none translate-y-2 opacity-0',
      )}
    >
      <svg viewBox="0 0 32 32" aria-hidden="true" className="h-6 w-6 fill-current">
        <path d="M16.04 3C8.86 3 3.02 8.83 3.02 16c0 2.3.6 4.53 1.74 6.5L3 29l6.68-1.75A13 13 0 0 0 16.04 29C23.2 29 29 23.17 29 16S23.2 3 16.04 3Zm0 23.8c-2 0-3.95-.54-5.66-1.55l-.4-.24-3.96 1.04 1.06-3.86-.26-.4A10.76 10.76 0 0 1 5.24 16c0-5.95 4.85-10.8 10.8-10.8 5.94 0 10.76 4.85 10.76 10.8 0 5.95-4.82 10.8-10.76 10.8Zm5.92-8.08c-.32-.16-1.92-.95-2.22-1.06-.3-.11-.51-.16-.73.16-.21.32-.84 1.06-1.03 1.27-.19.22-.38.24-.7.08-.33-.16-1.37-.5-2.6-1.6-.96-.86-1.61-1.92-1.8-2.24-.19-.32-.02-.5.14-.66.15-.14.33-.38.49-.57.16-.19.21-.32.32-.54.1-.21.05-.4-.03-.56-.08-.16-.73-1.76-1-2.4-.26-.63-.53-.55-.73-.56h-.62c-.21 0-.56.08-.86.4-.29.32-1.12 1.1-1.12 2.68 0 1.58 1.15 3.1 1.31 3.32.16.21 2.26 3.45 5.47 4.84.77.33 1.36.53 1.83.68.77.24 1.47.21 2.02.13.62-.1 1.92-.79 2.19-1.55.27-.76.27-1.42.19-1.55-.08-.14-.29-.22-.62-.38Z" />
      </svg>
      <span className="hidden pr-1 text-sm font-semibold sm:inline">Chat with us</span>
    </a>
  );
}

/** Whether the product page's buy box (`[data-buy-box]`) is on screen. */
function useBuyBoxVisible(enabled: boolean, pathname: string): boolean {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    setVisible(false);
    if (!enabled || typeof IntersectionObserver === 'undefined') return;
    const target = document.querySelector('[data-buy-box]');
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.05 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled, pathname]);

  return visible;
}
