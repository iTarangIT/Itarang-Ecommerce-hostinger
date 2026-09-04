import type { Metadata } from 'next';
import { catalog } from '@/lib/commerce';
import { buildNavigation } from '@/lib/navigation';
import {
  bestSellers,
  byCategory,
  featuredReviews,
  newArrivals,
  productTitleMap,
} from '@/lib/catalog/collections';
import { Hero } from '@/components/merch/hero';
import { ProductRail } from '@/components/merch/product-rail';
import { OffersStrip } from '@/components/merch/offers-strip';
import { Testimonials } from '@/components/merch/testimonials';
import {
  CategoryTiles,
  LoadCalculatorPromo,
  LoadGuide,
  OwnerCentre,
  TrustRow,
} from '@/components/merch/blocks';
import { SupportTeaser } from '@/components/support/support-teaser';
import { categoryPath } from '@/lib/routes';

export const metadata: Metadata = {
  title: 'Home Inverters, Batteries & UPS Systems',
  // Says what the catalogue holds. It used to end "with certified installation
  // and documented warranty": `installationIncluded` is false on all eight
  // products and six of the eight state no warranty, so both halves were
  // claims the catalogue contradicts — in the one sentence search engines quote.
  description:
    'Lithium iron phosphate home storage batteries and EV traction packs from Trontek, with the full manufacturer specification on every product page.',
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  const [categories, offers, popular, combos, latest, reviews, titles] = await Promise.all([
    buildNavigation(),
    catalog().listOffers(),
    bestSellers(8),
    byCategory('combos', 8),
    newArrivals(6),
    featuredReviews(6),
    productTitleMap(),
  ]);

  return (
    <>
      <Hero />
      <TrustRow />

      <CategoryTiles categories={categories} />

      {/* `popularityRank` is an editorial ordering — `to-domain.ts` says so in
          as many words — not a count of anything sold. This rail read "Most
          bought", "Best sellers this month" and "the systems our customers
          choose most often": three sales statistics, and there have been no
          sales. */}
      <div className="container section-tight">
        <ProductRail
          products={popular}
          eyebrow="Where to start"
          title="Across the range"
          description="A cross-section of what we stock, from home storage to traction packs."
          action={{ label: 'See all products', href: '/search' }}
        />
      </div>

      <LoadCalculatorPromo />

      <div className="container section-tight">
        <ProductRail
          products={combos}
          eyebrow="Matched systems"
          title="Inverter + battery, sized and ready"
          description="Charger profile pre-matched to the chemistry, one warranty, one installation visit — and priced below the parts bought separately."
          action={{ label: 'All combos', href: categoryPath('combos') }}
        />
      </div>

      <OffersStrip offers={offers} />

      <LoadGuide />

      <div className="container section-tight">
        <ProductRail
          products={latest}
          eyebrow="Recently listed"
          title="New in the range"
          action={{ label: 'See what is new', href: '/search?sort=newest' }}
        />
      </div>

      <OwnerCentre />

      <Testimonials reviews={reviews} productTitles={titles} />

      <SupportTeaser />
    </>
  );
}
