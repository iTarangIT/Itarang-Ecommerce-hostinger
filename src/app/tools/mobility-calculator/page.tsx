import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BatteryCharging } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Skeleton } from '@/components/ui/skeleton';
import { MobilityCalculator } from '@/components/tools/mobility-calculator';
import { SupportTeaser } from '@/components/support/support-teaser';

export const metadata: Metadata = {
  title: 'EV battery calculator for 2-wheelers and e-rickshaws',
  description:
    'Enter your motor power, voltage, daily distance and vehicle age to estimate the LiFePO4 battery capacity your electric scooter or e-rickshaw needs, and see matching Trontek packs and chargers.',
  alternates: { canonical: '/tools/mobility-calculator' },
};

const FAQS = [
  {
    q: 'How accurate is the range estimate?',
    a: 'It is an estimate built from typical consumption for Indian 2-wheelers and e-rickshaws. Payload, gradients, traffic, tyre pressure and riding style can change real-world range by 20% or more either way, which is why the calculator sizes with a 10% reserve on top of the distance you enter.',
  },
  {
    q: 'Can I use a battery of a different voltage in my vehicle?',
    a: 'No. The pack must match the voltage your motor and controller are built for. A higher-voltage pack can damage the controller and a lower-voltage pack will not run the vehicle properly, so the calculator only ever suggests packs at your vehicle’s voltage.',
  },
  {
    q: 'Why does the age of my vehicle change the battery size?',
    a: 'Worn bearings and tyres, brake drag and an ageing controller all increase the energy a vehicle uses per kilometre. The calculator adds 2% for each year of age, up to a maximum of 20%, so an older vehicle is not sized as if it were new.',
  },
  {
    q: 'Which charger should I use with my pack?',
    a: 'A lithium pack must be charged to its exact charge voltage. Next to each recommended pack we show only the chargers whose output matches that pack, and none for packs where we cannot confirm a match.',
  },
];

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((faq) => ({
    '@type': 'Question',
    name: faq.q,
    acceptedAnswer: { '@type': 'Answer', text: faq.a },
  })),
};

export default function MobilityCalculatorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <div className="border-b border-border bg-surface">
        <div className="container py-6 sm:py-8">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Tools', href: '/tools/load-calculator' },
              { label: 'EV battery calculator' },
            ]}
          />
          <div className="mt-4 flex items-start gap-4">
            <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground sm:grid">
              <BatteryCharging className="h-6 w-6" />
            </span>
            <div>
              <p className="eyebrow">Free sizing tool for electric vehicles</p>
              <h1 className="heading-1 mt-1 text-balance">
                Find the right battery for your scooter or e-rickshaw
              </h1>
              <p className="mt-3 max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                Tell us the motor power, voltage, how far you need to go on one charge and how old
                the vehicle is. We estimate the LiFePO4 capacity it needs, show the working, and
                point you at Trontek packs — with a matching charger — at your vehicle&rsquo;s
                exact voltage. Nothing here needs an email address.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 lg:py-10">
        <Suspense
          fallback={
            <div className="grid gap-8 lg:grid-cols-12">
              <Skeleton className="h-[32rem] w-full lg:col-span-7" />
              <Skeleton className="h-[26rem] w-full lg:col-span-5" />
            </div>
          }
        >
          <MobilityCalculator />
        </Suspense>
      </div>

      <div className="container pb-10 lg:pb-14">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          <section aria-labelledby="mobility-how" className="lg:col-span-6">
            <h2 id="mobility-how" className="heading-3">
              How this is calculated
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                <strong className="text-foreground">Energy per km.</strong> We start from typical
                consumption — about 30 Wh/km for a 2-wheeler with a 1000 W motor, and about 70
                Wh/km for an e-rickshaw with a 1200 W motor — and scale it by the square root of
                your motor power, within 20–40 Wh/km for 2-wheelers and 55–90 Wh/km for
                e-rickshaws.
              </p>
              <p>
                <strong className="text-foreground">Vehicle age.</strong> Add 2% for each year, up
                to 20%.
              </p>
              <p>
                <strong className="text-foreground">Battery energy</strong> = distance × energy per
                km × age allowance ÷ 90% usable depth of discharge, plus a 10% reserve.
              </p>
              <p>
                <strong className="text-foreground">Capacity (Ah)</strong> = battery energy ÷ the
                pack&rsquo;s nominal voltage (for example 51.2 V for a 48 V vehicle, 60.8 V for
                60 V, 73.6 V for 72 V). It is never smaller than the size needed to keep the
                motor&rsquo;s current at or below 1C for a 2-wheeler or 0.5C for an e-rickshaw.
              </p>
              <p>
                <strong className="text-foreground">Range</strong> for a pack = its capacity ×
                voltage × 90% ÷ energy per km.
              </p>
            </div>
          </section>

          <section aria-labelledby="mobility-faq" className="lg:col-span-6">
            <h2 id="mobility-faq" className="heading-3">
              Questions
            </h2>
            <dl className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
              {FAQS.map((faq) => (
                <div key={faq.q} className="p-4 sm:p-5">
                  <dt className="font-display text-[0.95rem] font-semibold text-card-foreground">
                    {faq.q}
                  </dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{faq.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>

      <SupportTeaser />
    </>
  );
}
