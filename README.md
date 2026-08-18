# iTarang Storefront

An original Next.js storefront for iTarang Products — home inverters, batteries, UPS systems and
inverter + battery combos.

The storefront runs against either a development catalogue or the **live Hostinger Sales Channel
catalogue**, selected by one environment variable. Catalogue reads only — there is no checkout,
no payments and no write path of any kind.

```bash
npm install
cp .env.example .env.local
npm run dev          # http://localhost:3000
npm run verify       # typecheck + lint + build + tests
npm run test         # unit and safety tests, no external service needed
npm run gen:images   # regenerate the SVG product illustrations
```

## Local database (checkout)

Checkout stores orders, payments and stock reservations in a **local** PostgreSQL
database called `itarang_dev`. Nothing is written anywhere else.

```bash
createdb -U postgres itarang_dev        # or use pgAdmin / docker compose up -d
# put the connection string in .env.local:
#   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/itarang_dev

npm run db:status    # verify the guard passes and show what is there
npm run db:migrate   # apply db/migrations
npm run db:seed      # demo orders for the admin console
npm run db:reset     # drop, migrate, seed
npm run db:sweep     # mark expired reservations (tidiness only)
```

No Postgres installed? `docker compose up -d` starts one on port **5433** so it
cannot collide with a local install:
`DATABASE_URL=postgresql://itarang:itarang@127.0.0.1:5433/itarang_dev`

**The guard.** `src/lib/db/guard.ts` refuses to open a connection unless the host
is local *and* the database is exactly `itarang_dev`. `tarang_dev` — another
application's database, one character away — is named in an explicit denylist.
Every `db:*` script runs the guard before issuing a statement, so a mistyped URL
aborts before connecting.

## Checkout

```
Cart → /checkout → contact → address + serviceability → payment → /order/[number]
```

- **Cash on delivery** works end to end and involves no payment provider at all.
- **Test payment** simulates success, failure and abandonment so retries,
  idempotency and reservation release are all exercisable. It makes no network
  call of any kind.
- Prices are **always recomputed server-side** from the catalogue by
  `/api/checkout/quote`. The cart's own prices are display-only.
- Stock is reserved when payment starts and released if payment never completes.
  Expiry is evaluated on read, so nothing depends on a scheduler.
- `/admin` is a local order console — `npm run admin:hash -- "your password"`
  prints the two values it needs in `.env.local`.

Every order placed in this build carries `is_test = true` in the database and is
labelled **TEST** in the UI. No money moves.

### Razorpay

Not configured, and no credentials are invented. `RazorpayTestProvider` is
written against the documented contract but is **never constructed** while
`PAYMENT_PROVIDER=mock`. When real `rzp_test_` credentials exist, set the three
`RAZORPAY_*` variables and switch `PAYMENT_PROVIDER=razorpay-test`. An
`rzp_live_` key is refused at startup — this environment cannot move real money.

Webhook testing needs a public URL, so a tunnel (`cloudflared` or `ngrok`) is
required. Without one the callback path masks webhook problems, so webhook
behaviour should be tested against the tunnel deliberately.

## Choosing a catalogue

```bash
COMMERCE_PROVIDER=mock        # 31 development products, works offline (default)
COMMERCE_PROVIDER=hostinger   # live Hostinger catalogue, read-only
```

With `hostinger` selected, every surface — homepage rails, mega-menu counts, facets, search,
sitemap and prerendered product pages — is driven by the live catalogue. Nothing falls back to
development data silently.

Check upstream health and the field-level mapping at any time (development only):

```bash
curl -s localhost:3000/api/diagnostics/hostinger | jq
```

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript strict |
| Styling | Tailwind CSS 3.4 with an HSL token layer in `src/app/globals.css` |
| Components | Hand-built primitives in `src/components/ui` (no component-library dependency) |
| Icons | `lucide-react` |
| State | React context + `useReducer`, persisted to `localStorage` |

First-load JS is ~103 kB shared, 128–137 kB on the heaviest routes. 72 routes prerender at build
time.

## Commerce abstraction

The UI never imports catalogue data directly. It calls `catalog()`, which returns a
`CatalogProvider`. Query behaviour lives in one shared `CatalogEngine`, so both providers answer a
shopper's query identically — they differ only in where their `Product[]` comes from.

```
src/lib/commerce/
  types.ts            domain types + the CatalogProvider interface
  summary.ts          ProductSummary — the flat, serialisable card projection
  index.ts            catalog() — the single resolution point
  mock/
    categories.ts     4 families, 14 subcategories, editorial copy
    products.ts       31 products (one mirrors the live Hostinger SKU)
    reviews.ts        review fixtures (city + verified state only, no names)
    offers.ts         bank / UPI / EMI / coupon / shipping / bundle offers
    mock-provider.ts  development catalogue
  hostinger/
    client.ts         GET-only API client — no verb parameter exists
    schema.ts         zod schemas for the live payloads
    map.ts            Hostinger payload → domain types
    map.test.ts       19 tests against a captured live response
    enrichment.ts     taxonomy + merchandising the API cannot supply
    hostinger-provider.ts
```

### The Hostinger Sales Channel API

`https://api-ecommerce.hostinger.com/store/{sales_channel_id}` — **no authentication**. The
channel id in the path is the only identifier and already ships publicly in the previous
storefront's JavaScript, so it is configuration rather than a credential.

Four reads are used: `/products`, `/products/{id}`, `/variants?fields=inventory_quantity`
(the only source of stock) and `/settings`. The one mutating endpoint the API exposes,
`POST /checkout`, is deliberately unreachable from this codebase — `client.ts` has a single
`get()` function with no HTTP-verb argument.

`HOSTINGER_API_TOKEN` is **not** used anywhere. That token belongs to the separate account API at
`developers.hostinger.com`, which can create and delete stores and products; the catalogue
integration never needs it.

### What the API cannot supply

The store returns no collections and reports `product_reviews.is_enabled: false`. Category,
subcategory, facet values, badges, highlights, FAQs and related products therefore live in
`hostinger/enrichment.ts`, keyed by Hostinger product id. A product with no entry still appears —
it is filed by title matching and listed as unmapped by the diagnostics route.

Supporting logic sits in `src/lib/catalog/`: `facets.ts` (facet definitions),
`query.ts` (URL ⇄ `ProductQuery`), `sort.ts`, `pricing.ts` (all money is integer paise),
`collections.ts` (editorial selections).

## Routes

```
/                                   homepage
/c/[category]                       4 category pages
/c/[category]/[sub]                 14 subcategory pages
/p/[slug]                           one page per product in the active catalogue
/search                             faceted search
/compare                            side-by-side, up to 4
/cart                               full cart page (drawer is the default surface)
/offers                             coupons, payment offers, full terms
/tools/load-calculator              appliance → VA + Ah → shoppable result
/support  /faq /warranty-registration /installation /complaint /dealers
/account                            saved products (real), other panels gated on accounts
/track                              guest order lookup
/api/suggest /products /cross-sell /compare /sizing
/api/diagnostics/hostinger          upstream health + mapping report (dev only)
```

Category and product routes both set `dynamicParams: false`, so an unknown slug is a real HTTP
404 rather than a not-found page served with 200. The category listing is fetched inside its own
Suspense boundary so route validation completes before anything streams — with a segment-level
`loading.tsx` the status was already sent by the time `notFound()` ran.

## Design system

Tokens carried over from the existing iTarang storefront and expanded:

- Navy `hsl(219 62% 18%)` with a 10-step ramp; amber `hsl(36 96% 52%)` with a 6-step ramp
- Semantic `success` / `warning` / `sale` / `destructive`; full dark-theme token set
- `Sora` (display) + `Inter` (body), self-hosted via `next/font`
- Radius `0.9rem`; `card` / `raised` / `overlay` elevation; breakpoints 480/640/768/1024/1280/1440

## Product imagery

There is no product photography, and stock imagery would misrepresent the catalogue. Instead
`scripts/generate-product-art.mjs` generates 60 on-brand schematic SVGs
(`public/art/{kind}-{variant}-{view}.svg`). Replace `artSet()` in `src/lib/commerce/mock/art.ts`
with real URLs when photography exists.

## Honesty rules observed

Anything that cannot work without a backend says so on screen rather than simulating it:

- Cart checkout button explains that payment arrives in the next phase; nothing is charged
- Owner Centre forms validate fully, then state that the request was **not** transmitted, and give
  the real email and phone
- Order tracking validates input, then explains lookup is not connected
- Account panels for orders/addresses/warranties say the data does not exist yet
- Technician coverage says the result comes from development logic, not the live network

Values marked `PLACEHOLDER` in `src/lib/site.ts` — phone number, registered address, support hours
— must be confirmed before launch. Offer values in `mock/offers.ts` and `lib/offers/coupons.ts`
are illustrative and need signed commercial terms.

## What remains

1. Razorpay + Cash on Delivery checkout, and an order record we own. The public Sales Channel API
   exposes `POST /checkout` (a redirect to Hostinger's hosted checkout); an on-site checkout needs
   its own order store.
2. Accounts (mobile OTP), order history, GST invoices, addresses.
3. Real serviceability data or a courier API to replace `lib/support/serviceability.ts`.
4. Verified-buyer review capture — the store has reviews disabled, so `getReviews()` returns `[]`
   under the live provider and no rating is ever fabricated.
5. A service-desk endpoint for the Owner Centre forms.
6. Enrichment entries for each new SKU. Watch the `unmappedProducts` list in the diagnostics
   response; anything there is being filed by title matching rather than deliberately.
