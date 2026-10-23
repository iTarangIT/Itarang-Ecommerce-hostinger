import type { Metadata } from 'next';
import { buildNavigation } from '@/lib/navigation';
import { listSiteCoupons } from '@/lib/offers/campaign-store';
import {
  bestSellers,
  bySubcategory,
  featuredReviews,
  productTitleMap,
} from '@/lib/catalog/collections';
import { Hero } from '@/components/merch/hero';
import { ProductRail } from '@/components/merch/product-rail';
import { Testimonials } from '@/components/merch/testimonials';
import {
  CategoryTiles,
  LoadGuide,
  OwnerCentre,
  TrustRow,
} from '@/components/merch/blocks';
import { SupportTeaser } from '@/components/support/support-teaser';
import {
  DealerBand,
  HomeFaq,
  ToolsPromo,
  WelcomeOffers,
  WhyTrontek,
} from '@/components/merch/home-sections';
import { FAQ_SECTIONS } from '@/lib/support/faqs';
import { subcategoryPath } from '@/lib/routes';

export const metadata: Metadata = {
  title: 'Lithium Batteries for E-Rickshaws, EVs & Home Inverters',
  description:
    'Trontek LiFePO4 batteries for e-rickshaws, electric scooters, home inverters and energy storage, plus matching chargers. WELCOME coupons and ₹200 off on UPI.',
  alternates: { canonical: '/' },
};

/** The homepage FAQ: the first question of each support section. */
const HOME_FAQS = FAQ_SECTIONS.flatMap((section) => section.entries.slice(0, 2)).slice(0, 6);

export default async function HomePage() {
  const [categories, popular, rickshaw, homeBatteries, reviews, titles, coupons] = await Promise.all([
    buildNavigation(),
    bestSellers(8),
    bySubcategory('ev-3-wheeler', 8),
    bySubcategory('home-inverter', 8),
    featuredReviews(6),
    productTitleMap(),
    listSiteCoupons(),
  ]);

  return (
    <>
      <Hero />
      <TrustRow />

      <CategoryTiles categories={categories} />

      <WelcomeOffers coupons={coupons} />

      {/* `popularityRank` is an editorial ordering — `to-domain.ts` says so in
          as many words — not a count of anything sold, so this rail makes no
          sales claim. */}
      <div className="container section-tight">
        <ProductRail
          products={popular}
          eyebrow="Where to start"
          title="Across the range"
          description="A cross-section of what we stock, from e-rickshaw packs to home storage."
          action={{ label: 'See all products', href: '/products' }}
        />
      </div>

      <ToolsPromo />

      <div className="container section-tight">
        <ProductRail
          products={rickshaw}
          eyebrow="3-wheeler & e-rickshaw"
          title="Energy for a full day of duty"
          description="LiFePO4 traction packs quoted in kWh, with the matching Trontek charger suggested for each."
          action={{
            label: 'All e-rickshaw batteries',
            href: subcategoryPath('batteries', 'ev-3-wheeler'),
          }}
        />
      </div>

      <div className="container section-tight">
        <ProductRail
          products={homeBatteries}
          eyebrow="Home backup"
          title="Lithium storage for the hours the grid is out"
          description="Maintenance-free LiFePO4 packs with a battery management system, sized against your actual load."
          action={{
            label: 'All home inverter batteries',
            href: subcategoryPath('batteries', 'home-inverter'),
          }}
        />
      </div>

      <WhyTrontek />

      <LoadGuide />

      <DealerBand />

      <OwnerCentre />

      <Testimonials reviews={reviews} productTitles={titles} />

      <HomeFaq entries={HOME_FAQS} />

      <SupportTeaser />
    </>
  );
}
