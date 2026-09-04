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

## Database (checkout)

**Our** PostgreSQL owns the product catalogue — content, pricing and publishing
— along with orders, order items, payment records, stock reservations, order
events and admin tracking. See [Products](#products).

The Hostinger Sales Channel catalogue remains available and read-only behind
`COMMERCE_PROVIDER=hostinger`; the only thing ever written upstream is variant
stock, and only when `HOSTINGER_INVENTORY_PUSH=true`.

The database is either a local `itarang_dev` or one approved managed database
(Supabase). Set `DATABASE_URL` **once** in `.env.local` — three loaders read that
file (Node's `--env-file` for `db:*`, Next.js, and `vitest.setup.ts`) and they
disagree about which duplicate wins.

```bash
npm run db:status    # verify the guard passes and show what is there
npm run db:migrate   # apply db/migrations
npm run db:seed      # demo orders for the admin console   (local only)
npm run db:reset     # drop, migrate, seed                 (local only)
npm run db:sweep     # mark expired reservations (tidiness only)
```

### Local

```bash
createdb -U postgres itarang_dev        # or use pgAdmin / docker compose up -d
#   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/itarang_dev
npm run db:create && npm run db:migrate
```

No Postgres installed? `docker compose up -d` starts one on port **5433** so it
cannot collide with a local install:
`DATABASE_URL=postgresql://itarang:itarang@127.0.0.1:5433/itarang_dev`

### Remote (Supabase)

Use the **Session pooler** connection string, port 5432 — the direct connection
is IPv6-only unless the IPv4 add-on is enabled. All three variables are required
together:

```bash
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require
DB_ALLOW_REMOTE=true
DB_REMOTE_HOST=aws-0-REGION.pooler.supabase.com
DB_SSL_CA_FILE=db/prod-ca-2021.crt

npm run db:migrate   # db:create is local-only; Supabase provisions for you
```

Supabase signs pooler certificates with its own private root (`Supabase Root
2021 CA`), which is not in Node's default trust store — without the CA file the
connection fails with `SELF_SIGNED_CERT_IN_CHAIN`. Download it from the
dashboard: **Project Settings → Database → SSL Configuration → Download
certificate**, and save it as `db/prod-ca-2021.crt`. It is a public certificate,
not a secret, and is safe to commit.

**On a host, make `DB_SSL_CA_FILE` an absolute path.** A relative path is
resolved against the process's working directory — the package root when npm
starts the process, and whatever the host's process manager chose otherwise. Two
things have to be true at runtime and neither is automatic: the certificate must
be in the deployment (nothing in the build copies `db/` — it is not under
`public/` and is never `import`ed, so it exists on the server only if the deploy
ships the repo tree), and the path must point at it. Getting either wrong now
fails with an error naming the configured path, the resolved path and the
working directory, rather than a bare `ENOENT`.

```bash
DB_SSL_CA_FILE=/home/USER/APP_ROOT/db/prod-ca-2021.crt
```

A certificate kept outside the deploy target survives every redeploy regardless
of what the artifact contains, which is the sturdier arrangement.

`sslmode=require` stays in the URL as the operator's statement of intent and for
`psql`, but `src/lib/db/connection.ts` strips it before handing the string to
`pg` — otherwise `pg` merges the parsed URL *over* the explicit `ssl` config and
our TLS policy would be silently discarded.

`db:create` refuses to run remotely. `db:seed` and `db:reset` refuse too unless
`DB_ALLOW_DESTRUCTIVE=true` — `db:reset` drops the entire `public` schema, which
on a managed provider takes its own objects with it.

**The guard.** `src/lib/db/guard.ts` refuses to open a connection unless the URL
names one of exactly two approved targets: local + `itarang_dev`, or the host in
`DB_REMOTE_HOST` with TLS required. `tarang_dev` — another application's
database, one character away — is named in an explicit denylist and refused on
every host. Every `db:*` script and the connection pool run the guard before
issuing a statement, so a mistyped URL aborts before connecting.

**Lockdown.** `db/migrations/0002_lockdown.sql` enables row-level security with
no policies on every table and revokes the `anon`/`authenticated` grants, so the
provider's auto-generated REST API cannot reach customer data with a public key.
It is a no-op on a local PostgreSQL.

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
- `/admin` is the order console, open to accounts with `role = 'admin'`.

## Accounts

Customers register at `/register` and sign in at `/login`. Passwords are scrypt
hashed; sessions are opaque tokens whose SHA-256 digest is what the `sessions`
table stores, so signing out — or changing a password — revokes access
immediately rather than at the next expiry.

Verification and password-reset mail needs the `SMTP_*` values in `.env.local`.
Leave them unset in development and `sendMail` logs the recipient and subject to
the console instead of sending anything.

### Creating the first admin

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a long passphrase' npm run admin:create
```

The password is read from the environment, never from an argument, so it stays
out of shell history and the process list. The account is flagged
`must_change_password`, and `/admin` refuses to open until a new password has
been set. Re-running the command rotates the password and revokes existing
sessions, which is also the way back in after a lockout.

A demo environment that needs a specific weak password can pass `--allow-weak`.
It prints a warning and still forces the change at first sign-in.

Every order placed in this build carries `is_test = true` in the database and is
labelled **TEST** in the UI. No money moves.

### Razorpay

Razorpay runs in **TEST mode**, both locally and on the deployed host. It is a
real gateway with real signatures and real webhooks; no card is ever charged and
no real money moves. Every order still carries `is_test = true`.

Four server-side variables, and no `NEXT_PUBLIC_` variant of any of them — the
key id reaches the browser only inside the payment intent the server issues, so
`RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` never leave the server. A
tripwire in `src/lib/security.test.ts` greps the built client bundle to keep it
that way.

```bash
PAYMENT_PROVIDER=razorpay-test
RAZORPAY_KEY_ID=rzp_test_...      # an rzp_live_ key is refused at startup
RAZORPAY_KEY_SECRET=...           # signs and verifies the browser callback
RAZORPAY_WEBHOOK_SECRET=...       # verifies webhooks, deliberately a separate secret
```

Set them in `.env.local` locally and in the host's environment in production.
Never in source, never in a commit — `.env*` is gitignored, which is also why
this section exists rather than living in `.env.production.example`.

`env.ts` refuses to boot on a key that does not start with `rzp_test_`, whichever
provider is selected, and `PAYMENT_PROVIDER=razorpay-test` requires all three
credentials to be present. `RazorpayTestProvider` re-checks both in its
constructor. Going live would mean removing those gates consciously.

**Webhook.** Register `POST /api/webhooks/payment` in the Razorpay **Test Mode**
dashboard for `payment.captured`, `payment.authorized`, `payment.failed`,
`order.paid` and `refund.processed`.

Razorpay gives each endpoint its own secret, so a local tunnel endpoint and the
production endpoint have **different** `RAZORPAY_WEBHOOK_SECRET` values. That is
correct, not a mistake. Rotating a secret is an environment edit and a dashboard
edit — nothing in the repository references it.

Local webhook testing needs a public URL, so a tunnel (`cloudflared` or `ngrok`)
is required. Without one the callback path masks webhook problems, so webhook
behaviour should be tested against the tunnel deliberately. Worth confirming all
four behaviours: a valid delivery stamps `webhook_events.processed_at`; a
redelivery of the same event id returns 200 and changes nothing; a tampered body
is rejected with 400; and `npm run db:sweep` reports no claimed-but-unapplied
events.

The live-API test suite is opt-in and needs the credentials plus network:

```bash
RAZORPAY_LIVE_TEST=true npm run test -- razorpay.integration
```

It is excluded from `npm run verify` on purpose, so CI never needs a secret.

## Choosing a catalogue

```bash
COMMERCE_PROVIDER=mock        # 31 development products, works offline (default)
COMMERCE_PROVIDER=hostinger   # live Hostinger catalogue, read-only
COMMERCE_PROVIDER=db          # the catalogue we own
```

With `hostinger` selected, every surface — homepage rails, mega-menu counts, facets, search,
sitemap and prerendered product pages — is driven by the live catalogue. Nothing falls back to
development data silently.

Check upstream health and the field-level mapping at any time (development only):

```bash
curl -s localhost:3000/api/diagnostics/hostinger | jq
```

## Products

**We own our product content.** Title, description, specifications, highlights,
warranty, FAQs, manufacturer, seller, compatibility and images all live in our
own PostgreSQL and are edited at `/admin/products`. Publishing a change needs no
developer and no deploy.

That is a deliberate reversal. It used to work the other way: Hostinger returned
a title, a price and some images, and everything else — category, subcategory,
highlights, box contents, FAQs, warranty, badges, facets, cross-sell — was a
hand-edited TypeScript file keyed by Hostinger's product id. That id is not
stable. Recreating a product in hPanel mints a new one and silently detaches its
entry, which had already happened twice, the second time to all six products at
once.

**Hostinger is untouched.** The provider, the client, the mapper, the enrichment
file and the inventory push loop are all exactly as they were and still selected
by `COMMERCE_PROVIDER=hostinger`. `products.hostinger_product_id` is kept as a
nullable reference so a future commerce or inventory integration can bind one of
our products to an upstream one without a schema change. It is never read for
content.

```
manufacturers ─┐
sellers ───────┼─→ products ─┬─→ product_variants   sku, price, stock
               │             ├─→ product_media      Supabase Storage key + order
               │             ├─→ product_spec_groups ─→ product_specs
               │             ├─→ product_faqs
               │             └─→ product_sections   applications · charging ·
               │                                    discharge · runtime ·
               │                                    compatibility · care
        (shared rows — one manufacturer, one seller, pointed at by every product)
```

There is deliberately no wide product table. A 51V traction pack and a
wall-mounted home battery share almost no technical vocabulary — one has a
discharge cut-off and a connector pin map, the other an IP rating and an
inverter charging profile — so technical figures are **rows** in
`product_spec_groups` / `product_specs`, which is the `SpecGroup` shape the
product page already rendered. Adding a category needs no migration.

### Publishing

`draft → published → draft`, and `archived` from either. **There is no delete**:
`order_items` snapshots product and variant ids, and `funnel_events` records
what a visitor looked at. Archiving is the withdrawal, and it is reversible via
draft — never straight back to the storefront.

A product cannot be published until it states a title, a slug, a description, at
least one image and at least one variant with both an MRP and a selling price.
The gate is enforced server-side in `setStatus`, not by hiding a button.

**A warranty is deliberately not required.** Five of the eight source documents
state none, and the whole catalogue is built on the rule that an unknown value
renders as *nothing* rather than as a plausible default. Requiring one here
would force somebody to invent it.

### Importing the supplied catalogue

The eight Trontek products are transcribed into `db/seed/`, not parsed from the
`.docx` files at import time — the data has to be reviewable in a diff, and a
re-run has to be deterministic.

```bash
npm run products:import -- --dry-run   # validate the seed data, write nothing
npm run products:import                # upsert by product_key, idempotent
npm run products:media -- --dry-run    # check all 32 images resolve
npm run products:media                 # upload to Supabase Storage, record rows
```

Both are idempotent and neither changes a product's `status` after it is
created: a re-import must not republish something an administrator withdrew.
`products:media` reads the archive in `docs/` directly, so there is no manual
extraction step.

### Product images

Supabase Storage holds the binaries; `product_media.storage_path` holds the
object key and nothing else. The public URL is derived on read from
`SUPABASE_URL` — storing a full URL would bake the project host into every row.

`SUPABASE_URL` **must be set at build time**: `next.config.mjs` reads it to
authorise the host in both `images.remotePatterns` and the CSP, and both are
baked into the build output. `SUPABASE_SERVICE_ROLE_KEY` is needed only to
*write* an image, bypasses row-level security on every table in the project, and
is covered by the client-bundle grep in `src/lib/security.test.ts`.

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
`CatalogProvider`. Query behaviour lives in one shared `CatalogEngine`, so all three providers
answer a shopper's query identically — they differ only in where their `Product[]` comes from.

```
src/lib/commerce/
  types.ts            domain types + the CatalogProvider interface
  summary.ts          ProductSummary — the flat, serialisable card projection
  index.ts            catalog() — the single resolution point
  db/
    db-provider.ts    the catalogue we own — reads published rows, no reviews,
                      no offers until real ones exist
  mock/
    categories.ts     4 families, 16 subcategories, editorial copy
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
/c/[category]/[sub]                 16 subcategory pages
/p/[slug]                           one page per product in the active catalogue
/search                             faceted search
/compare                            side-by-side, up to 4
/cart                               full cart page (drawer is the default surface)
/offers                             coupons, payment offers, full terms
/tools/load-calculator              appliance → VA + Ah → shoppable result
/support  /faq /warranty-registration /installation /complaint /dealers
/account                            saved products (real), other panels gated on accounts
/track                              guest order lookup
/admin/products                     product list, filters, publish state
/admin/products/new                 create a draft
/admin/products/[productKey]        edit — information, pricing, media, content,
                                    specifications, sections, warranty, parties,
                                    FAQ, SEO
/api/suggest /products /cross-sell /compare /sizing
/api/diagnostics/hostinger          upstream health + mapping report (dev only)
```

Category and product routes set `dynamicParams: true`, so a slug that was not prerendered — a
product published since the last build, or one whose cache entry an admin save has purged — is
rendered on demand instead of 404ing. `generateStaticParams` still prerenders the whole catalogue
at build time.

Neither route has a segment-level `loading.tsx`, and that is load-bearing rather than an
omission: a segment loading file starts streaming immediately, which commits HTTP 200 before the
page can call `notFound()`, turning every unknown slug into a soft 404 that search engines index.
Both routes validate first and stream their listing from an inner Suspense boundary instead.

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
are illustrative and need signed commercial terms; under `COMMERCE_PROVIDER=db` the product page
renders no offers card at all rather than borrowing them.

Two claims still reach a product page from configuration rather than from the product, and both
need a decision before launch:

- `PriceBlock` prints "Or ₹x/month on 6-month no-cost EMI" for anything over ₹5,000, which is
  every product in the current catalogue. No EMI terms have been agreed.
- `DeliveryCheck` and `ServiceStrip` state delivery and installation from
  `lib/support/serviceability.ts`, which is development logic.

## What remains

1. Razorpay + Cash on Delivery checkout, and an order record we own. The public Sales Channel API
   exposes `POST /checkout` (a redirect to Hostinger's hosted checkout); an on-site checkout needs
   its own order store.
2. Accounts (mobile OTP), order history, GST invoices, addresses.
3. Real serviceability data or a courier API to replace `lib/support/serviceability.ts`.
4. Verified-buyer review capture — the store has reviews disabled, so `getReviews()` returns `[]`
   under the live provider and no rating is ever fabricated.
5. A service-desk endpoint for the Owner Centre forms.
6. Enrichment entries for each new SKU **under the Hostinger provider only**. Watch the
   `unmappedProducts` list in the diagnostics response; anything there is being filed by title
   matching rather than deliberately. Products under `COMMERCE_PROVIDER=db` carry their own
   taxonomy and need no entry.
7. Confirmed business data for the imported catalogue: the warranty terms for the five products
   whose documents state none, a price for Powercube 2.7, the manufacturer's legal name and
   registered address, a customer-care email, and confirmation of the minted `TRN-` SKUs.
