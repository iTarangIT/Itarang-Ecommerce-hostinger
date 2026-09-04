/**
 * Security headers.
 *
 * The site is already live, so these are chosen to be correct *and* incapable
 * of breaking what is running. Two deliberate restraints:
 *
 * 1. **Content-Security-Policy is Report-Only.** Next.js emits inline bootstrap
 *    and hydration scripts, so an enforcing policy needs either
 *    `'unsafe-inline'` — which buys almost nothing — or per-request nonces from
 *    middleware. Turning enforcement on without that would white-screen the
 *    storefront. Report-Only publishes the intended policy and surfaces every
 *    violation without blocking a single request; enforcement is a deliberate
 *    follow-up once the reports are clean.
 *
 * 2. **HSTS carries no `preload`.** Preloading is effectively irreversible —
 *    removal takes months — and it would also bind every subdomain via
 *    `includeSubDomains`. A year of max-age gives the protection; the
 *    irreversible part is opt-in, later, on purpose.
 *
 * `checkout.razorpay.com` and `api.razorpay.com` are allowed in the policy
 * because Razorpay Checkout loads its script and opens an iframe from there.
 * They are listed now, while the policy is only reporting, so the allowances
 * are already right when Razorpay is switched on.
 */

/**
 * The Supabase Storage host, derived rather than hard-coded.
 *
 * Product images live in a bucket on the project named by `SUPABASE_URL`, so
 * exactly one host has to be allowed — both by `images.remotePatterns`, or
 * `next/image` refuses to optimise them, and by the CSP `img-src`, or the
 * browser refuses to load them once the policy is enforced. Getting one and
 * not the other is the failure that would survive review, so both read this.
 *
 * **`SUPABASE_URL` must be set at build time.** It is read here, and
 * `remotePatterns` is baked into the build output; setting it only at runtime
 * would leave every product image broken with no error to explain it.
 */
const storageHost = (() => {
  if (!process.env.SUPABASE_URL) return null;
  try {
    return new URL(process.env.SUPABASE_URL).hostname;
  } catch {
    console.warn('[config] SUPABASE_URL is not a valid URL; product images will be blocked.');
    return null;
  }
})();

const csp = [
  "default-src 'self'",
  // 'unsafe-inline' and 'unsafe-eval' are what a nonce-based policy would
  // remove. Listed explicitly so the gap is visible rather than implied.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://cdn.zyrosite.com https://images.hostinger.com https://*.razorpay.com${
    storageHost ? ` https://${storageHost}` : ''
  }`,
  "font-src 'self' data:",
  "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com",
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "form-action 'self'",
  "base-uri 'self'",
  // Belt and braces with X-Frame-Options below, which older browsers use.
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy-Report-Only', value: csp },
  // Stops a browser guessing a type and, say, treating an uploaded file as a
  // script.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Clickjacking. Nothing here is meant to be embedded.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Send the origin cross-site, the full path same-site: keeps order numbers
  // and reset tokens out of other people's referrer logs.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // None of these are used, so none are granted.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Where the build output goes. `.next` unless told otherwise.
   *
   * A `next dev` and a `next start` in the same checkout otherwise share one
   * output directory and quietly destroy each other's work. Dev rewrites
   * `.next/static` and removes `BUILD_ID`, so a production server that was
   * already running keeps serving HTML referencing
   * `/_next/static/css/<hash>.css` — a file that no longer exists. The page
   * arrives as unstyled raw HTML with a 400 on the stylesheet, and nothing in
   * the application is wrong.
   *
   * Setting `NEXT_DIST_DIR=.next-prod` for the verification build and server
   * gives them separate directories so both can run at once. Unset — which is
   * every deployment — the behaviour is byte-for-byte what it was.
   */
  distDir: process.env.NEXT_DIST_DIR ?? '.next',

  /**
   * The storefront's old URL prefixes, kept alive.
   *
   * Categories moved from `/c/batteries` to `/batteries` and products from
   * `/p/<slug>` to `/products/<slug>`. The slugs themselves did not change —
   * only the prefix — so every old link maps to exactly one new one.
   *
   * `permanent: true` emits a 308, which is what tells a search engine to
   * transfer the old URL's standing to the new one rather than treat it as a
   * temporary detour. A 302 here would leave the old URLs indexed indefinitely.
   *
   * These cannot loop. Redirects are evaluated before routing, and `/c` and
   * `/p` no longer exist as route folders, so a request to the new URL matches
   * no `source` here and is served directly. The reverse direction is never
   * generated: `lib/routes.ts` is the only thing that builds these links and it
   * only ever builds the new shape.
   *
   * The two-segment category rule is listed first. Next matches in order, and
   * `/c/:category` would otherwise never see `/c/batteries/lithium` — a
   * single-segment `:category` does not match two segments, but stating the
   * more specific rule first keeps the intent obvious rather than relying on
   * that.
   */
  async redirects() {
    return [
      { source: '/c/:category/:sub', destination: '/:category/:sub', permanent: true },
      { source: '/c/:category', destination: '/:category', permanent: true },
      { source: '/p/:slug', destination: '/products/:slug', permanent: true },
    ];
  },

  reactStrictMode: true,
  // Version disclosure buys an attacker a CVE list and buys us nothing.
  poweredByHeader: false,
  images: {
    // The first two remain authorised for the Hostinger catalogue, which is
    // still selectable by COMMERCE_PROVIDER. The third is where our own product
    // photography lives; see `storageHost` above.
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.zyrosite.com' },
      { protocol: 'https', hostname: 'images.hostinger.com' },
      ...(storageHost
        ? [{ protocol: 'https', hostname: storageHost, pathname: '/storage/v1/object/public/**' }]
        : []),
    ],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // Three read-only catalogue endpoints, and only these three.
        //
        // They take a query string, read no cookie, no session and no header,
        // and answer with public catalogue data that is identical for every
        // visitor — so there is no customer data for an intermediary to leak.
        // They are also the endpoints the browser hits repeatedly during
        // ordinary use: search suggestions on every debounced keystroke,
        // recently-viewed on every product page, cross-sell on every cart
        // open. Under the blanket rule below, none of that could be reused.
        //
        // The list is exact, anchored with $ in the exclusion below, so a
        // future /api/products/something does NOT inherit this and falls back
        // to no-store. Adding an endpoint here means proving it carries
        // nothing personal first.
        source: '/api/:path(suggest|products|cross-sell)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300',
          },
        ],
      },
      {
        // Everything else under /api stays uncacheable. An intermediary
        // caching an order response would serve one customer's data to
        // another, so this is the default and the exception above is the part
        // that had to be argued for.
        source: '/api/:path((?!(?:suggest|products|cross-sell)$).*)',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ];
  },
};

export default nextConfig;
