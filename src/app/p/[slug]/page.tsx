import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Calculator, PackageOpen, ShieldCheck, Wrench } from 'lucide-react';
import { catalog } from '@/lib/commerce';
import { CATEGORY_BY_SLUG } from '@/lib/commerce/mock/categories';
import { offersForCategory } from '@/lib/commerce/mock/offers';
import { allProducts, productsByIds } from '@/lib/catalog/collections';
import { toProductSummary } from '@/lib/commerce/summary';
import { displayPrice, formatPrice } from '@/lib/catalog/pricing';
import { SITE } from '@/lib/site';
import { BreadcrumbJsonLd, Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Accordion } from '@/components/ui/accordion';
import { RatingSummaryInline } from '@/components/ui/rating';
import { ButtonLink } from '@/components/ui/button';
import { Gallery } from '@/components/product/gallery';
import { BuyBox } from '@/components/product/buy-box';
import { OfferStack } from '@/components/product/offer-stack';
import { SpecTable } from '@/components/product/spec-table';
import { Reviews } from '@/components/product/reviews';
import { FrequentlyBought } from '@/components/product/frequently-bought';
import { RecentlyViewed } from '@/components/product/recently-viewed';
import { ProductRail } from '@/components/merch/product-rail';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** Prerender whatever the *active* provider is serving. */
export async function generateStaticParams() {
  const products = await allProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await catalog().getProduct(slug);
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
  const provider = catalog();
  const product = await provider.getProduct(slug);
  if (!product) notFound();

  const category = CATEGORY_BY_SLUG.get(product.category);

  // All three depend only on the product, never on one another. The previous
  // shape looked parallel but was not: an array literal evaluates its elements
  // in order, so reviews had to resolve before the companion and related
  // lookups were even started.
  const [reviews, companions, related] = await Promise.all([
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

  const accordionItems = [
    {
      id: 'description',
      title: 'Description',
      defaultOpen: true,
      children: (
        <div className="rich-text max-w-3xl">
          {product.description.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      ),
    },
    {
      id: 'specifications',
      title: 'Specifications',
      children: <SpecTable groups={product.specGroups} />,
    },
    {
      id: 'box',
      title: 'What is in the box',
      children: (
        <ul className="space-y-2">
          {product.boxContents.map((entry) => (
            <li key={entry} className="flex items-start gap-2 text-sm text-muted-foreground">
              <PackageOpen className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" />
              {entry}
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: 'installation',
      title: 'Installation & service',
      children: (
        <div className="rich-text max-w-3xl">
          <p>
            {product.installationIncluded
              ? 'Installation by a certified iTarang technician is included in the price. Your slot is booked after the order is confirmed, and the technician commissions the system, sets the correct charger profile for your battery chemistry and runs a load test before leaving.'
              : 'Installation is not included in this product’s price. If you would like a certified iTarang technician to install and commission it, our support team can arrange a visit from the network covering your pincode.'}
          </p>
          <p>
            Service requests are raised in the Owner Centre. You receive a reference number and a
            technician is assigned from the network covering your pincode.
          </p>
          <ul>
            <li>
              <Link href="/support/installation" className="font-medium text-primary underline-offset-4 hover:underline">
                Book an installation slot
              </Link>
            </li>
            <li>
              <Link href="/support/dealers" className="font-medium text-primary underline-offset-4 hover:underline">
                Find a technician near you
              </Link>
            </li>
          </ul>
        </div>
      ),
    },
    // Only shown when the catalogue states a warranty. A product with no
    // stated term gets no warranty panel rather than an invented one.
    ...(warrantyMonths !== undefined
      ? [
          {
            id: 'warranty',
            title: 'Warranty',
            meta: `${Math.round(warrantyMonths / 12)} years`,
            children: (
              <div className="rich-text max-w-3xl">
                <p>
                  This product carries a{' '}
                  <strong>
                    {warrantyMonths}-month ({Math.round(warrantyMonths / 12)}-year) warranty
                  </strong>{' '}
                  from the date of installation. The written terms ship with the product and are
                  also available from support.
                </p>
                <p>
                  Registering your serial number in the Owner Centre means a future claim never
                  depends on locating the original invoice.
                </p>
                <ul>
                  <li>
                    <Link
                      href="/support/warranty-registration"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Register this product&rsquo;s warranty
                    </Link>
                  </li>
                </ul>
              </div>
            ),
          },
        ]
      : []),
    ...(product.faqs.length > 0
      ? [
          {
            id: 'faqs',
            title: 'Questions about this product',
            meta: `${product.faqs.length}`,
            children: (
              <dl className="space-y-4">
                {product.faqs.map((faq) => (
                  <div key={faq.question}>
                    <dt className="text-sm font-semibold text-foreground">{faq.question}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {faq.answer}
                    </dd>
                  </div>
                ))}
              </dl>
            ),
          },
        ]
      : []),
  ];

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
          <div className="lg:col-span-7">
            <Gallery images={product.images} title={product.title} badges={product.badges} />
          </div>

          <div className="lg:col-span-5">
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

            <div className="mt-6">
              <BuyBox product={product} />
            </div>

            <div className="mt-6">
              <OfferStack offers={offers} />
            </div>
          </div>
        </div>

        {/* Highlights */}
        {product.highlights.length > 0 ? (
          <section aria-labelledby="highlights-heading" className="mt-10 lg:mt-14">
            <h2 id="highlights-heading" className="heading-3">
              Why this one
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {product.highlights.map((highlight) => (
                <li
                  key={highlight}
                  className="rounded-lg border border-border bg-card p-4 text-sm leading-relaxed text-foreground"
                >
                  {highlight}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Details */}
        <section aria-labelledby="details-heading" className="mt-10 lg:mt-14">
          <h2 id="details-heading" className="heading-3">
            Full details
          </h2>
          <div className="mt-4 grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <Accordion items={accordionItems} />
            </div>

            <aside className="lg:col-span-4">
              <div className="space-y-3">
                {warrantyMonths !== undefined ? (
                  <div className="rounded-lg border border-border bg-card p-4">
                    <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                      <ShieldCheck className="h-4.5 w-4.5 text-success" />
                      Warranty
                    </h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {Math.round(warrantyMonths / 12)} years, documented in writing and honoured
                      through our service network.
                    </p>
                  </div>
                ) : null}
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                    <Wrench className="h-4.5 w-4.5 text-success" />
                    Installation
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {product.installationIncluded
                      ? 'Included. A certified technician commissions the system and runs a load test.'
                      : 'Not included in the price. Our team can arrange a certified technician for your pincode.'}
                  </p>
                </div>

                <div className="rounded-lg border border-accent/30 bg-accent-50 p-4">
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
              </div>
            </aside>
          </div>
        </section>

        {/* Frequently bought together */}
        {companions.length > 0 ? (
          <section className="mt-10 lg:mt-14">
            <FrequentlyBought anchor={summary} companions={companions} />
          </section>
        ) : null}

        {/* Reviews */}
        <section id="reviews" aria-labelledby="reviews-heading" className="mt-10 scroll-mt-28 lg:mt-14">
          <h2 id="reviews-heading" className="heading-2">
            Customer reviews
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Published from verified orders only — including the critical ones.
          </p>
          <div className="mt-6">
            <Reviews summary={product.rating} reviews={reviews} productTitle={product.title} />
          </div>
        </section>
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
