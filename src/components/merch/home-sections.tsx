import Link from 'next/link';
import {
  ArrowRight,
  BatteryCharging,
  Bike,
  Calculator,
  Factory,
  Home,
  MapPin,
  ShieldCheck,
  Smartphone,
  Tag,
  PlugZap,
} from 'lucide-react';
import { Accordion } from '@/components/ui/accordion';
import { formatPrice } from '@/lib/catalog/pricing';
import { COUPONS_ENABLED, UPI_DISCOUNT } from '@/lib/offers/coupons';
import type { SiteCoupon } from '@/lib/offers/campaign-store';
import type { FaqEntry } from '@/lib/support/faqs';

/**
 * Home page sections added after the Livguard review: offers, the two
 * calculators, the dealer finder, the manufacturer's figures and an FAQ.
 *
 * Server components with no data of their own beyond constants the checkout
 * already enforces (`coupons.ts`) and figures printed on Trontek's listing
 * sheets, so nothing here can advertise something the site will not honour.
 */

/* ------------------------------------------------------------------ offers */

/** `coupons`: the campaigns marked "show on site" in /admin/campaigns, live now. */
export function WelcomeOffers({ coupons }: { coupons: SiteCoupon[] }) {
  if (!COUPONS_ENABLED) return null;

  const offers = [
    ...coupons.slice(0, 2).map((coupon) => ({
      key: coupon.code,
      icon: Tag,
      title: coupon.label,
      detail: `Use code ${coupon.code} in your cart.`,
      code: coupon.code as string | null,
    })),
    {
      key: 'upi',
      icon: Smartphone,
      title: `Extra ${formatPrice(UPI_DISCOUNT)} off with UPI`,
      detail: 'Choose UPI at checkout. Works with a coupon.',
      code: null,
    },
  ];

  return (
    <section aria-labelledby="offers-heading" className="container section-tight">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Offers</p>
          <h2 id="offers-heading" className="heading-2 mt-1">
            Save on your first battery
          </h2>
        </div>
        <Link href="/offers" className="text-sm font-semibold text-primary hover:underline">
          Offer terms
        </Link>
      </div>
      <ul className="mt-5 grid gap-3 sm:grid-cols-3">
        {offers.map((offer) => (
          <li
            key={offer.key}
            className="flex items-start gap-3 rounded-xl border border-dashed border-accent/60 bg-accent-50 p-4"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
              <offer.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-base font-semibold text-foreground">
                {offer.title}
              </span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{offer.detail}</span>
              {offer.code ? (
                <span className="tabular mt-2 inline-block rounded-md border border-accent/50 bg-card px-2 py-0.5 text-xs font-bold tracking-wider text-foreground">
                  {offer.code}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------- calculators */

export function ToolsPromo() {
  const tools = [
    {
      href: '/tools/load-calculator',
      icon: Home,
      eyebrow: 'Home backup',
      title: 'Calculate your home backup need',
      body: 'Pick your home size and appliances, set the hours you need, and we work out the battery that covers it.',
      cta: "Let's plan",
    },
    {
      href: '/tools/mobility-calculator',
      icon: Bike,
      eyebrow: '2-wheeler & e-rickshaw',
      title: 'Find the right EV battery',
      body: 'Enter your motor rating, voltage, daily distance and vehicle age to get the capacity you need and the pack that fits.',
      cta: 'Calculate range',
    },
  ];

  return (
    <section aria-labelledby="tools-heading" className="bg-surface">
      <div className="container section">
        <p className="eyebrow">Plan before you buy</p>
        <h2 id="tools-heading" className="heading-2 mt-1">
          Two calculators, one right answer
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group flex flex-col rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-lg"
            >
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <tool.icon className="h-6 w-6" />
              </span>
              <span className="mt-4 text-2xs font-semibold uppercase tracking-[0.12em] text-primary-600">
                {tool.eyebrow}
              </span>
              <span className="mt-1 font-display text-xl font-semibold text-foreground">{tool.title}</span>
              <span className="mt-2 text-sm leading-relaxed text-muted-foreground">{tool.body}</span>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                <Calculator className="h-4 w-4" />
                {tool.cta}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- figures */

/** Each figure is printed on Trontek's own listing sheets. */
const FIGURES = [
  { icon: Factory, value: '1 GWh', label: 'Trontek production capacity, with in-house R&D and testing' },
  { icon: BatteryCharging, value: '2000+', label: 'charge cycles on LiEV traction packs' },
  { icon: ShieldCheck, value: 'Up to 5 yrs', label: 'warranty on Powercube home batteries (or 4000 cycles)' },
  { icon: PlugZap, value: 'IP66', label: 'sealed, die-cast Trontek EV chargers' },
];

export function WhyTrontek() {
  return (
    <section aria-labelledby="why-heading" className="bg-ink-900 text-ink-50">
      <div className="container section">
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-primary-300">Why Trontek</p>
        <h2 id="why-heading" className="heading-2 mt-1 text-ink-50">
          Made in India, built to be relied on
        </h2>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FIGURES.map((figure) => (
            <li key={figure.value} className="rounded-xl bg-white/5 p-5 ring-1 ring-white/10">
              <figure.icon className="h-6 w-6 text-primary-300" />
              <p className="tabular mt-3 font-display text-3xl font-bold text-ink-50">{figure.value}</p>
              <p className="mt-1 text-sm text-ink-50/70">{figure.label}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- dealers */

export function DealerBand() {
  return (
    <section aria-labelledby="dealer-heading" className="container section-tight">
      <div className="grid items-center gap-6 rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-accent/10 p-6 sm:p-8 lg:grid-cols-2">
        <div>
          <p className="eyebrow">Near you</p>
          <h2 id="dealer-heading" className="heading-2 mt-1">
            Delivered across India. Fitted and serviced locally.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Check delivery on any product page, or find a dealer or service centre near you.
          </p>
        </div>
        <form action="/support/dealers" method="get" className="flex gap-2" role="search">
          <label htmlFor="home-dealer-q" className="sr-only">
            Pincode or city
          </label>
          <div className="relative flex-1">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="home-dealer-q"
              name="q"
              placeholder="Pincode or city"
              className="h-12 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm"
            />
          </div>
          <button
            type="submit"
            className="h-12 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-600"
          >
            Find my dealer
          </button>
        </form>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- faq */

export function HomeFaq({ entries }: { entries: FaqEntry[] }) {
  if (entries.length === 0) return null;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };

  return (
    <section aria-labelledby="home-faq-heading" className="container section">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="eyebrow">Questions</p>
          <h2 id="home-faq-heading" className="heading-2 mt-1">
            Asked most often
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Straight answers before you buy.{' '}
            <Link href="/support/faq" className="font-medium text-primary hover:underline">
              All questions
            </Link>
          </p>
        </div>
        <Accordion
          className="lg:col-span-8"
          multiple={false}
          items={entries.map((entry, index) => ({
            id: entry.id,
            title: entry.question,
            defaultOpen: index === 0,
            children: <p className="text-sm leading-relaxed text-muted-foreground">{entry.answer}</p>,
          }))}
        />
      </div>
    </section>
  );
}
