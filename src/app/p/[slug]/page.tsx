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
import { DemoBatterySections } from '@/components/product/demo-battery-sections';
import { CATEGORY_BY_SLUG } from '@/lib/commerce/mock/categories';
import { offersForCategory } from '@/lib/commerce/mock/offers';
import { allProducts, productsByIds } from '@/lib/catalog/collections';
import { toProductSummary, type ProductSummary } from '@/lib/commerce/summary';
import type { Review } from '@/lib/commerce/types';
import { displayPrice, formatPrice } from '@/lib/catalog/pricing';
import { SITE } from '@/lib/site';
import { BreadcrumbJsonLd, Breadcrumbs } from '@/components/ui/breadcrumbs';
import { RatingSummaryInline } from '@/components/ui/rating';
import { ButtonLink } from '@/components/ui/button';
import { Gallery } from '@/components/product/gallery';
import { attributePairs } from '@/components/product/key-attributes';
import { BuyBox } from '@/components/product/buy-box';
import { CollapsibleCard } from '@/components/product/collapsible-card';
import { ProductSpecs } from '@/components/product/product-specs';
import { OfferStack } from '@/components/product/offer-stack';
import { SizeChart } from '@/components/product/size-chart';
import { SellerDetail } from '@/components/product/seller-info';
import { BulkOrderBanner } from '@/components/product/bulk-order-banner';
import { Reviews } from '@/components/product/reviews';
import { FrequentlyBought } from '@/components/product/frequently-bought';
import { RecentlyViewed } from '@/components/product/recently-viewed';
import { ProductRail } from '@/components/merch/product-rail';

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
    alternates: { canonical: `/p/${product.slug}` },
    openGraph: {
      title: `${product.title} | ${SITE.name}`,
      description: product.subtitle,
      url: `/p/${product.slug}`,
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
  const offers = offersForCategory(product.category);
  const price = displayPrice(product);
  const summary = toProductSummary(product);

  const crumbs = [
    { label: 'Home', href: '/' },
    { label: category?.name ?? 'Products', href: `/c/${product.category}` },
    ...(subcategory
      ? [{ label: subcategory.name, href: `/c/${product.category}/${subcategory.slug}` }]
      : []),
    { label: product.title, href: `/p/${product.slug}` },
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
      availability:
        product.variants.some((v) => v.stock > 0)
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      url: `${SITE.url}/p/${product.slug}`,
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

      <div className="container py-6 lg:py-10">
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
          <div className="min-w-0 space-y-6 lg:col-span-5">
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

            <ProductSpecs product={product} />

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

            {product.sizeChart ? <SizeChart chart={product.sizeChart} /> : null}

            {/* The reference stack. Reviews open by default; the rest are
                reference material a shopper opens only when they want it. */}
            <div className="space-y-3">
              <CollapsibleCard
                title="Ratings & Reviews"
                meta={product.rating ? `${product.rating.average.toFixed(1)} ★` : undefined}
                defaultOpen
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

              <CollapsibleCard title="All Offers" meta={offers.length ? String(offers.length) : undefined}>
                {offers.length > 0 ? (
                  <OfferStack offers={offers} />
                ) : (
                  <p className="text-sm text-muted-foreground">No active offers at the moment.</p>
                )}
              </CollapsibleCard>

              <CollapsibleCard title="Warranty, installation &amp; service">
                <div className="rich-text">
                  <p>
                    {product.installationIncluded
                      ? 'Installation by a certified iTarang technician is included in the price. Your slot is booked after the order is confirmed, and the technician commissions the system, sets the correct charger profile for your battery chemistry and runs a load test before leaving.'
                      : 'Installation is not included in this product’s price. If you would like a certified iTarang technician to install and commission it, our support team can arrange a visit from the network covering your pincode.'}
                  </p>
                  {/* Only stated when the catalogue gives a term. A product with
                      no stated warranty gets no warranty paragraph. */}
                  {warrantyMonths !== undefined ? (
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

              {product.seller ? (
                <CollapsibleCard title="Manufacturer Detail">
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
          </div>
        </div>


        {/* Demo-only battery sections. Real catalogue products never render
            these — nothing is invented for a product we actually sell. */}
        {isDemo ? <DemoBatterySections /> : null}

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
            action={{ label: `All ${category?.name.toLowerCase()}`, href: `/c/${product.category}` }}
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
 * Slugs come from `generateStaticParams`, which reads the active provider, so
 * this list already reflects the live catalogue at build time.
 *
 * `dynamicParams: false` is deliberate. With it set to `true`, an unknown slug
 * renders on demand and `notFound()` is served with HTTP 200 — a soft 404 that
 * search engines index. Routing-level rejection gives a real 404 instead.
 *
 * The cost: a product added upstream appears after the next build. That is
 * consistent with the rest of the architecture — a new SKU needs an entry in
 * `hostinger/enrichment.ts` to be filed into the right category anyway, which
 * is already a code change.
 */
export const dynamicParams = false;
