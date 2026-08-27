import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { SITE } from '@/lib/site';
import { buildNavigation } from '@/lib/navigation';
import { Providers } from './providers';
import { SiteChromeBottom, SiteChromeTop } from '@/components/layout/site-chrome';
import { Footer } from '@/components/layout/footer';

/**
 * One family for everything, matching the parent site.
 *
 * itarang.com declares a serif for `--font-display` but never applies it — its
 * own hero renders in Plus Jakarta Sans — so a single sans is what actually
 * makes the two sites look related. Both CSS variables point at the same face;
 * they are kept separate because every heading rule and `.heading-*` class
 * already reads `--font-display`, and collapsing them would touch call sites
 * for no gain.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-body',
  display: 'swap',
});

const jakartaDisplay = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} | Home Inverters, Batteries & UPS Systems`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    'home inverter',
    'pure sine wave inverter',
    'inverter battery',
    'lithium battery',
    'tubular battery',
    'UPS system',
    'inverter battery combo',
  ],
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    title: `${SITE.name} | Home Inverters, Batteries & UPS Systems`,
    description: SITE.description,
    locale: 'en_IN',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  // Kept in step with the ink ramp in `globals.css` — #12181D is --ink-900 and
  // #1A2229 is --ink-800. These used to be navy values that only approximated
  // the tokens they were meant to mirror, so the browser chrome never quite
  // matched the header it sat above.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#12181d' },
    { media: '(prefers-color-scheme: dark)', color: '#12181d' },
  ],
  width: 'device-width',
  initialScale: 1,
};

const ORGANISATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE.name,
  url: SITE.url,
  description: SITE.description,
  email: SITE.email,
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: SITE.phone,
    contactType: 'customer support',
    areaServed: 'IN',
    availableLanguage: ['en', 'hi'],
  },
};

const WEBSITE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE.name,
  url: SITE.url,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE.url}/search?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const categories = await buildNavigation();

  return (
    <html lang="en-IN" className={`${jakarta.variable} ${jakartaDisplay.variable}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANISATION_JSON_LD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSON_LD) }}
        />

        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>

        <Providers>
          <SiteChromeTop categories={categories} />
          <main id="main" className="flex-1 pb-safe-nav lg:pb-0">
            {children}
          </main>
          <Footer />
          <SiteChromeBottom categories={categories} />
        </Providers>
      </body>
    </html>
  );
}
