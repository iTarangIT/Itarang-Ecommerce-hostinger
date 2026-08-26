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

const csp = [
  "default-src 'self'",
  // 'unsafe-inline' and 'unsafe-eval' are what a nonce-based policy would
  // remove. Listed explicitly so the gap is visible rather than implied.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://cdn.zyrosite.com https://images.hostinger.com https://*.razorpay.com",
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
  reactStrictMode: true,
  // Version disclosure buys an attacker a CVE list and buys us nothing.
  poweredByHeader: false,
  images: {
    // Product art in this phase is local SVG. These remote patterns are pre-authorised
    // so the Hostinger catalog can be plugged in later without a config change.
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.zyrosite.com' },
      { protocol: 'https', hostname: 'images.hostinger.com' },
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
