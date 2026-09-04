import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Calculator, FlaskConical } from 'lucide-react';
import { catalog } from '@/lib/commerce';
import {
  DEMO_PRODUCT,
  DEMO_PRODUCT_SLUG,
  DEMO_REVIEWS,
  isDemoSlug,
} from '@/lib/commerce/demo/demo-product';
import { ProductSections } from '@/components/product/product-sections';
import { CATEGORY_BY_SLUG } from '@/lib/commerce/mock/categories';
import { allProducts, productsByIds } from '@/lib/catalog/collections';
import { toProductSummary, type ProductSummary } from '@/lib/commerce/summary';
import type { Review } from '@/lib/commerce/types';
import { displayPrice, formatPrice, productAvailability } from '@/lib/catalog/pricing';
import { SITE } from '@/lib/site';
import { BreadcrumbJsonLd, Breadcrumbs } from '@/components/ui/breadcrumbs';
import { RatingSummaryInline } from '@/components/ui/rating';
import { ButtonLink } from '@/components/ui/button';
import { Gallery } from '@/components/product/gallery';
import { attributePairs } from '@/components/product/key-attributes';
import { BuyBox } from '@/components/product/buy-box';
import { CollapsibleCard } from '@/components/product/collapsible-card';
import { ProductSpecs } from '@/components/product/product-specs';
import { ProductLoadCalculator } from '@/components/product/product-load-calculator';
import { OfferStack } from '@/components/product/offer-stack';
import { SizeChart } from '@/components/product/size-chart';
import { SellerDetail } from '@/components/product/seller-info';
import { ManufacturerDetail } from '@/components/product/manufacturer-info';
import { BulkOrderBanner } from '@/components/product/bulk-order-banner';
import { Reviews } from '@/components/product/reviews';
import { FrequentlyBought } from '@/components/product/frequently-bought';
import { RecentlyViewed } from '@/components/product/recently-viewed';
import { ProductRail } from '@/components/merch/product-rail';
import { categoryPath, productPath, subcategoryPath } from '@/lib/routes';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Prerender whatever the *active* provider is serving, plus the demo product.
 *
 * The demo slug is appended here rather than inside `allProducts()` on purpose.
 * `allProducts()` feeds `syncInventoryFromHostingerAction`, which mirrors the
 * catalogue into the database and reconciles inventory — so a demo product
 * added there would be written into `catalogue_products` / `catalogue_skus`.
 * Adding it to this route's params list keeps it a purely presentational
 * fixture that the commerce layer never sees.
 */
export async function generateStaticParams() {
  const products = await allProducts();
  return [...products.map((product) => ({ slug: product.slug })), { slug: DEMO_PRODUCT_SLUG }];
}

/** The demo fixture, or the real catalogue. Never both. */
async function loadProduct(slug: string) {
  return isDemoSlug(slug) ? DEMO_PRODUCT : await catalog().getProduct(slug);
}

/**
 * The demo product's relations.
 *
 * Its reviews come from the same fixture file as the rest of it — invented,
 * and fenced behind `isDemoSlug()` so no provider ever serves them. Companions
 * and related products stay empty: those would have to be *real* catalogue
 * products, and the demo must not reach into the live catalogue.
 */
const DEMO_RELATIONS: [Review[], ProductSummary[], ProductSummary[]] = [DEMO_REVIEWS, [], []];

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) return { title: 'Product not found' };

  const price = displayPrice(product);

  const claims = [
    product.warrantyMonths !== undefined
      ? `${Math.round(product.warrantyMonths / 12)}-year warranty`
      : null,
    product.installationIncluded ? 'installation included' : null,
  ].filter(Boolean);

  return {
    title: product.title,
    description: [`${product.subtitle}. ${formatPrice(price.selling)}`, ...claims].join(', ') + '.',
    alternates: { canonical: productPath(product.slug) },
    openGraph: {
      title: `${product.title} | ${SITE.name}`,
      description: product.subtitle,
      url: productPath(product.slug),
      images: [{ url: product.images[0] }],
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const isDemo = isDemoSlug(slug);
  const provider = catalog();
  const product = await loadProduct(slug);
  if (!product) notFound();

  const category = CATEGORY_BY_SLUG.get(product.category);

  // All three depend only on the product, never on one another. The previous
  // shape looked parallel but was not: an array literal evaluates its elements
  // in order, so reviews had to resolve before the companion and related
  // lookups were even started.
  //
  // The demo product skips all three lookups: it is a presentational fixture
  // and must not reach into the live catalogue for reviews or companions.
  const [reviews, companions, related] = isDemo
    ? DEMO_RELATIONS
    : await Promise.all([
        provider.getReviews(product.id),
        productsByIds(product.frequentlyBoughtWith),
        productsByIds(product.relatedProductIds),
      ]);

  const subcategory = category?.subcategories.find((s) => s.slug === product.subcategory);
  // From the active provider, not from the development fixtures.
  // `offersForCategory()` returns illustrative bank, UPI and EMI terms that
  // nobody has signed; printing those beside a real price would be advertising
  // a discount that does not exist. A provider with no offers yields none, and
  // the card below is not rendered at all.
  const offers = (await provider.listOffers()).filter(
    (offer) => !offer.categories?.length || offer.categories.includes(product.category),
  );
  const price = displayPrice(product);
  const summary = toProductSummary(product);

  const crumbs = [
    { label: 'Home', href: '/' },
    { label: category?.name ?? 'Products', href: categoryPath(product.category) },
    ...(subcategory
      ? [{ label: subcategory.name, href: subcategoryPath(product.category, subcategory.slug) }]
      : []),
    { label: product.title, href: productPath(product.slug) },
  ];

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.subtitle,
    sku: product.variants[0]?.sku,
    brand: { '@type': 'Brand', name: 'iTarang' },
    image: product.images.map((image) => `${SITE.url}${image}`),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: (price.selling / 100).toFixed(2),
      // The same rollup the page itself renders, not a second opinion derived
      // from the raw counts. `variants.some(v => v.stock > 0)` was wrong in
      // both directions: an untracked variant reports the sentinel 99, so a
      // product explicitly marked out of stock still published `InStock` to
      // Google while the buy box said "Out of stock" — a structured-data
      // contradiction that outlives the page in search results.
      availability:
        productAvailability(product) === 'out-of-stock'
          ? 'https://schema.org/OutOfStock'
          : 'https://schema.org/InStock',
      url: `${SITE.url}${productPath(product.slug)}`,
    },
    ...(product.rating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.rating.average,
            reviewCount: product.rating.count,
          },
        }
      : {}),
  };

  // Narrowed once here so the conditional blocks below read cleanly.
  const warrantyMonths = product.warrantyMonths;

  // The headline figures for the gallery's overlay tile. Computed here so the
  // gallery — a client component — receives five strings rather than the whole
  // product.
  const highlightPairs = attributePairs(product);

  return (
    <>
      <BreadcrumbJsonLd items={crumbs} baseUrl={SITE.url} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />

      <div className="border-b border-border bg-surface">
        <div className="container py-4">
          <Breadcrumbs items={crumbs} />
        </div>
      </div>

      <div className="container py-6 lg:py-8">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="min-w-0 lg:col-span-7">
            <Gallery
              images={product.images}
              title={product.title}
              badges={product.badges}
              highlights={highlightPairs}
            />
          </div>

          {/* Everything else lives in this column, top to bottom: the product
              is decided on here, so the facts that decide it are here too
              rather than scattered down a page the shopper has to leave the
              buy controls to reach.

              `min-w-0` is load-bearing: a grid item defaults to
              `min-width: auto`, so the size chart's `min-w-[30rem]` would
              otherwise widen this column past the viewport instead of
              scrolling inside its own container. */}
          <div className="min-w-0 space-y-5 lg:col-span-5">
            {/* Demo fixture — see lib/commerce/demo/demo-product.ts. */}
            {isDemo ? (
              <div className="mb-4 rounded-lg border border-warning/40 bg-warning-soft p-3.5">
                <p className="flex items-center gap-2 font-display text-sm font-semibold text-warning">
                  <FlaskConical className="h-4 w-4 shrink-0" />
                  Demonstration product
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">
                  This page exists to demonstrate the product-page design. Every
                  specification, figure and price on it is illustrative sample data — it does
                  not come from the iTarang catalogue and does not describe a product on sale.
                </p>
              </div>
            ) : null}

            <div>
              <p className="eyebrow">
                {category?.name}
                {subcategory ? ` · ${subcategory.name}` : ''}
              </p>
              <h1 className="heading-1 mt-1.5 text-balance">{product.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">{product.subtitle}</p>
              <div className="mt-3">
                {product.rating ? (
                  <RatingSummaryInline
                    average={product.rating.average}
                    count={product.rating.count}
                    size="md"
                    href="#reviews"
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">No reviews yet</span>
                )}
              </div>
            </div>

            {/* Price, selectors, buy controls, delivery and the service row. */}
            <BuyBox product={product} />

            {/* The selling points, as the bullet list a retail page opens its
                description with. The prose sits in the panel below. */}
            {product.highlights.length > 0 ? (
              <section aria-labelledby="about-heading">
                <h2 id="about-heading" className="heading-3">
                  About the product
                </h2>
                <ul className="mt-4 space-y-2">
                  {product.highlights.map((highlight) => (
                    <li
                      key={highlight}
                      className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                      />
                      {highlight}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>

        {/* ------------------------------- the long reference material */}
        {/*
          Specifications, the reference panels and the bulk enquiry, at the
          full width of the page.

          These used to sit in the 5-of-12 column beside the gallery, and
          that is what produced the blank area this section was written to
          remove. The specification table alone is around forty rows; in a
          column roughly 540px wide it ran to some 1,500px, while the
          gallery beside it is a fixed three rows of tiles and stops at
          about 1,150px. Everything past that point had nothing next to it.

          Moving it below the fold-level content fixes the cause rather
          than the symptom: the buy decision keeps the gallery beside it,
          and the reference material gets the whole width — where the same
          rows wrap far less and the section is shorter as well as wider.
          No panel was removed, duplicated or reordered relative to its
          neighbours.
        */}
        <section className="mt-10 space-y-8 lg:mt-12">
          <ProductSpecs product={product} />

          {product.sizeChart ? <SizeChart chart={product.sizeChart} /> : null}

          {/* The reference stack. Reviews open by default; the rest are
              reference material a shopper opens only when they want it.

              Two columns from `lg`, because these are eight independent
              panels that are closed by default — stacked at full width they
              made a long ladder of header bars across a very wide page.
              `items-start` keeps a panel's neighbour from stretching when
              it is opened. */}
          <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6 lg:gap-y-2.5 lg:space-y-0">
            {/* Open only when there is something to read. With no review
                capture yet a real product has `rating: null` and no reviews,
                and an empty panel forced open above the description is a
                worse first impression than a closed one. */}
            <CollapsibleCard
              title="Ratings & Reviews"
              meta={product.rating ? `${product.rating.average.toFixed(1)} ★` : undefined}
              defaultOpen={Boolean(product.rating)}
            >
              <div id="reviews" className="scroll-mt-28">
                <Reviews
                  summary={product.rating}
                  reviews={reviews}
                  productTitle={product.title}
                  layout="column"
                />
              </div>
            </CollapsibleCard>

            <CollapsibleCard title="Product Description">
              <div className="rich-text">
                {product.description.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </CollapsibleCard>

            {product.faqs.length > 0 ? (
              <CollapsibleCard
                title="Frequently asked Questions"
                meta={String(product.faqs.length)}
              >
                <dl className="space-y-4">
                  {product.faqs.map((faq) => (
                    <div key={faq.question}>
                      <dt className="text-sm font-semibold text-foreground">
                        <span className="text-accent-600">Q: </span>
                        {faq.question}
                      </dt>
                      <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        <span className="font-semibold text-accent-600">A: </span>
                        {faq.answer}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CollapsibleCard>
            ) : null}

            {/* Rendered only when there are offers. An empty "All Offers"
                card promising nothing is worse than no card: it invites a
                shopper to open it and tells them the page has an offers
                section that never has anything in it. */}
            {offers.length > 0 ? (
              <CollapsibleCard title="All Offers" meta={String(offers.length)}>
                <OfferStack offers={offers} />
              </CollapsibleCard>
            ) : null}

            <CollapsibleCard title="Warranty, installation &amp; service">
              <div className="rich-text">
                <p>
                  {product.installationIncluded
                    ? 'Installation by a certified iTarang technician is included in the price. Your slot is booked after the order is confirmed, and the technician commissions the system, sets the correct charger profile for your battery chemistry and runs a load test before leaving.'
                    : 'Installation is not included in this product’s price. If you would like a certified iTarang technician to install and commission it, our support team can arrange a visit from the network covering your pincode.'}
                </p>
                {/* Only stated when the catalogue gives a term. A product with
                    no stated warranty gets no warranty paragraph.

                    The verbatim phrase wins over the months figure where both
                    exist: "3 years or 1200 cycles, whichever is earlier" is
                    the promise a customer is actually offered, and stating it
                    as "36 months" quietly drops the half of it that limits
                    the cover. */}
                {product.warrantyText ? (
                  <p>
                    This product carries a warranty of{' '}
                    <strong>{product.warrantyText}</strong> from the date of installation. The
                    written terms ship with the product and are also available from support.
                    Keep your invoice and the serial number on the unit.
                  </p>
                ) : warrantyMonths !== undefined ? (
                  <p>
                    This product carries a{' '}
                    <strong>
                      {warrantyMonths}-month ({Math.round(warrantyMonths / 12)}-year) warranty
                    </strong>{' '}
                    from the date of installation. The written terms ship with the product and
                    are also available from support. Keep your invoice and the serial number on
                    the unit.
                  </p>
                ) : null}
                <p>
                  Service requests are raised in the Owner Centre. You receive a reference
                  number and a technician is assigned from the network covering your pincode.
                </p>
                {/* Installation booking and technician lookup have been
                    withdrawn from the after-sales navigation; complaint
                    registration is the one action offered. */}
                <ul>
                  <li>
                    <Link
                      href="/support/complaint"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Register a complaint
                    </Link>
                  </li>
                </ul>
              </div>

              <div className="mt-4 rounded-lg border border-accent/30 bg-accent-50 p-4">
                <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                  <Calculator className="h-4.5 w-4.5 text-accent-600" />
                  Not sure this fits your load?
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Tell the calculator which appliances you need running and it will confirm
                  whether this system is the right size — or point you at the one that is.
                </p>
                <ButtonLink
                  href="/tools/load-calculator"
                  variant="accent"
                  size="sm"
                  className="mt-3"
                >
                  Size my system
                  <ArrowRight className="h-3.5 w-3.5" />
                </ButtonLink>
              </div>
            </CollapsibleCard>

            {/* Two cards, because these are two companies.
                This was one card titled "Manufacturer Detail" that rendered
                `product.seller` — which was accurate only while every product
                was made and sold by the same business. Legal Metrology wants
                the manufacturer and the marketer stated separately, and a
                catalogue of third-party products makes the difference real.
                Each is omitted entirely when the catalogue states none. */}
            {product.manufacturer ? (
              <CollapsibleCard title="Manufacturer">
                <ManufacturerDetail manufacturer={product.manufacturer} />
              </CollapsibleCard>
            ) : null}

            {product.seller ? (
              <CollapsibleCard title="Seller &amp; marketer">
                <SellerDetail seller={product.seller} />
              </CollapsibleCard>
            ) : null}

            {product.returnWindowDays !== undefined ? (
              <CollapsibleCard title={`Free Returns Within ${product.returnWindowDays} Days`}>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  The return window is open for {product.returnWindowDays} days after delivery.
                  Products must be unused, in their original packing and with all tags, and
                  installed products are covered by the warranty instead of the return policy.{' '}
                  <Link
                    href="/support/faq#returns"
                    className="font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    Read the returns policy
                  </Link>
                  .
                </p>
              </CollapsibleCard>
            ) : null}
          </div>

          <BulkOrderBanner productTitle={product.title} />
        </section>

        {/* Applications, charging, discharge, run times, compatibility, care.
            Once demo-only, because nothing else had anywhere to keep them.
            Now every product renders whichever of these its own catalogue
            entry states — and a product that states none renders nothing. */}
        {product.sections?.length ? <ProductSections sections={product.sections} /> : null}

        {/* The load calculator, on every product page.
            Reuses `components/tools/load-calculator.tsx` and the same
            `/api/sizing` endpoint the standalone tool uses — see
            `product-load-calculator.tsx` for why it is mounted with
            `syncUrl={false}`. Placed after the technical sections and before
            the cross-sell rails: by this point the shopper has the
            specification and the open question is whether it fits their load. */}
        <ProductLoadCalculator product={product} />

        {/* Frequently bought together */}
        {companions.length > 0 ? (
          <section className="mt-10 lg:mt-14">
            <FrequentlyBought anchor={summary} companions={companions} />
          </section>
        ) : null}

      </div>

      {related.length > 0 ? (
        <div className="container section-tight">
          <ProductRail
            products={related}
            eyebrow="Compare alternatives"
            title="Others also considered"
            action={{ label: `All ${category?.name.toLowerCase()}`, href: categoryPath(product.category) }}
          />
        </div>
      ) : null}

      <RecentlyViewed excludeSlug={product.slug} />

      {/* Padding so the sticky buy bar never covers the footer's first row. */}
      <div className="h-16 lg:h-14" aria-hidden="true" />
    </>
  );
}

/**
 * Slugs come from `generateStaticParams`, so the live catalogue is still
 * prerendered at build time. `dynamicParams: true` decides what happens to a
 * slug that is *not* in that list.
 *
 * It used to be `false`, on the argument that routing-level rejection gives a
 * real 404 where `notFound()` might be served as a soft one. That argument was
 * written when the catalogue came from Hostinger and a new SKU needed a code
 * change to `enrichment.ts` anyway, so "appears after the next build" cost
 * nothing. Both halves of it have since stopped being true, and it broke two
 * things:
 *
 *   1. **A published product 404s on its own page.** An administrator can now
 *      create and publish a product entirely through the admin console. Its
 *      slug was never in the build-time list, so the listing renders a card
 *      linking to a hard 404 until somebody runs `next build`.
 *
 *   2. **Worse — every product page 404s after any admin save.** Catalogue
 *      reads are tagged, and a save calls `revalidateTag`. With `false`, a
 *      purged entry cannot be regenerated: Next raises `NoFallbackError` and
 *      serves 404 for a product that exists, is published, and whose HTML is
 *      still sitting on disk. That is strictly worse than the stale page the
 *      tag was added to fix.
 *
 * With `true`, a purged or newly published slug is rendered on demand and
 * cached, and a genuinely unknown one still reaches `notFound()` below.
 */
export const dynamicParams = true;

/**
 * Cached until something says otherwise — never on a timer.
 *
 * This was the implicit default and it is now stated, because the implicit
 * version was indistinguishable from an oversight and behaved like one: the
 * page was built once and never rebuilt, so an edited price reached the
 * category grid within seconds and this page never at all.
 *
 * A time-based `revalidate` is deliberately not used. Product pages change when
 * an administrator changes them, which is rare and known exactly — so they are
 * purged by `revalidateTag(CATALOG_TAG)` from the admin write path rather than
 * re-rendered on a schedule that would be wrong in both directions.
 */
export const revalidate = false;
