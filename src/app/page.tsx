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

export const metadata: Metadata = {
  title: 'Home Inverters, Batteries & UPS Systems',
  description:
    'Pure sine wave home inverters, lithium and tubular batteries, UPS systems and ready-matched combos — with certified installation and documented warranty.',
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

      <div className="container section-tight">
        <ProductRail
          products={popular}
          eyebrow="Most bought"
          title="Best sellers this month"
          description="The systems our customers choose most often, across every category."
          action={{ label: 'See all products', href: '/search?sort=best-selling' }}
        />
      </div>

      <LoadCalculatorPromo />

      <div className="container section-tight">
        <ProductRail
          products={combos}
          eyebrow="Matched systems"
          title="Inverter + battery, sized and ready"
          description="Charger profile pre-matched to the chemistry, one warranty, one installation visit — and priced below the parts bought separately."
          action={{ label: 'All combos', href: '/c/combos' }}
        />
      </div>

      <OffersStrip offers={offers} />

      <LoadGuide />

      <div className="container section-tight">
        <ProductRail
          products={latest}
          eyebrow="Just landed"
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
