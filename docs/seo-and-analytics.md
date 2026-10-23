# SEO and website analytics — what exists, what is pending

Review done 23 Oct 2026 for action point 7. Nothing new was built here except
one fix (the admin SEO fields now reach the product page); the rest is a map of
what is already in the code and what is not.

## SEO — implemented

| What | Where | Admin-editable? |
|---|---|---|
| Page titles `<name> \| iTarang Products`, site description, keywords, Open Graph and Twitter cards | `src/app/layout.tsx` | No (code) |
| Organisation and site-search structured data (JSON-LD) | `src/app/layout.tsx` | No |
| Clean product URLs `/products/<slug>` | `src/lib/routes.ts` | **Yes** — Admin → product → *SEO & URL* → URL slug |
| Product page title and meta description | `src/app/products/[slug]/page.tsx` (`generateMetadata`) | **Yes** — *SEO title* and *SEO description* on the same tab (**fixed in this change**: they were saved but never used). Left blank, the product title and subtitle + price are used. |
| Product structured data (price, availability, rating) and breadcrumbs | `src/app/products/[slug]/page.tsx` | Comes from the product data |
| Category and subcategory pages `/batteries`, `/batteries/ev-2-wheeler` with their own title, description, SEO text and breadcrumbs | `src/components/catalog/category-view.tsx` | Name and description: **yes**, Admin → Products → *Categories*. Long SEO paragraphs for the built-in categories: code (`src/lib/commerce/mock/categories.ts`). |
| Canonical URLs on product, category and most static pages | per page | No |
| `sitemap.xml` (pages, categories, products, blog, spec sheets) | `src/app/sitemap.ts` | Automatic — new products and categories appear on their own |
| `robots.txt` (blocks `/api/`, cart, account, compare; admin and order pages are `noindex`) | `src/app/robots.ts` | No |
| Blog article, FAQ, calculator and spec-sheet structured data | `src/app/blog/[slug]`, `support/faq`, `tools/mobility-calculator`, `downloads/[slug]` | No |

## SEO — pending (not built)

- No SEO title/description fields for **category** pages (they use the
  category name and description).
- No Google Search Console / Bing verification tag configured.
- No redirect from an old slug when a product's URL is changed (the hint on the
  slug field warns about this).

## Analytics — implemented (first-party, no third-party scripts)

The "visitor / cart tracking" discussed in the meeting is this:

| What | Where |
|---|---|
| Events recorded: site visit, product view, add to cart, buy now, checkout intent, begin checkout | `src/lib/analytics/events.ts`, sent from the browser by `src/lib/analytics/track.ts` to `/api/events` |
| Anonymous visitor and session cookies (180 days / 30 minutes), linked to the account at sign-in and to the order at purchase | `funnel_events`, `visitor_identities`, `order_attribution` tables (migrations 0009, 0011) |
| **Admin → Funnel**: visits → product views → add to cart → checkout → orders, per product, and per-visitor timelines | `/admin/funnel`, `/admin/funnel/products`, `/admin/funnel/visitors` |
| **Admin → Analytics**: revenue, monthly trend, fulfilment counts, geography | `/admin/analytics` |
| **Admin → Customers**: each customer's orders, purchases and activity timeline | `/admin/customers` |

## Analytics — pending (not built)

- **No Google Analytics, Tag Manager, Meta Pixel or Clarity.** Adding one needs
  the business's account ID and a cookie-consent decision.
- **No page-path, referrer or UTM capture** — the funnel knows *that* someone
  visited, not which page or which ad brought them.
- **The cart lives only in the shopper's browser**, so there is no list of
  abandoned carts and no reminder email. The funnel shows add-to-cart events
  without an order, which is the nearest signal today.
- No search-term report (what shoppers typed into search).

Confirm with the business which of the pending items matter before building
any of them.
