'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { categoryPath, subcategoryPath } from '@/lib/routes';

interface Slide {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  image: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
}

/**
 * Three slides, one per product line the business actually sells.
 *
 * Two of the three used to advertise combos and solar-ready inverters, and the
 * third linked "Lithium vs tubular" — none of which exists in the catalogue or,
 * since the taxonomy was reduced, has a page to land on. A hero that opens the
 * site on a 404 is worse than a hero with fewer slides, so the copy now matches
 * the catalogue: home lithium storage, two-wheeler packs, three-wheeler packs.
 *
 * Every claim below is one the product documents support (see
 * `docs/p1-b-2-catalogue-audit.md`); nothing here states a warranty, a range or
 * a compatibility the source sheets do not.
 */
const SLIDES: Slide[] = [
  {
    eyebrow: 'Home backup',
    title: 'Keep the house running through the cut',
    body: 'LiFePO4 home storage that pairs with a lithium-ready inverter — no water topping, no ventilated trolley, and sized against the appliances you actually run.',
    points: ['No maintenance', 'Deep cycling without the penalty', 'Sized against your real load'],
    image: '/art/battery-2-front.svg',
    primary: { label: 'Shop lithium batteries', href: subcategoryPath('batteries', 'lithium') },
    secondary: { label: 'Size my system', href: '/tools/load-calculator' },
  },
  {
    eyebrow: '2-wheeler EV',
    title: 'Traction packs matched to your drivetrain',
    body: 'LiFePO4 packs for electric scooters and motorcycles, listed with the nominal voltage, charge voltage and discharge cut-off your controller has to accept.',
    points: ['48V, 60V and 72V systems', 'BMS on every pack', 'Connector stated on the listing'],
    image: '/art/battery-1-angle.svg',
    primary: {
      label: 'Shop 2-wheeler batteries',
      href: subcategoryPath('batteries', 'ev-2-wheeler'),
    },
    secondary: { label: 'All batteries', href: categoryPath('batteries') },
  },
  {
    eyebrow: '3-wheeler & e-rickshaw',
    title: 'Energy enough for a full day of duty',
    body: 'High-capacity packs for e-rickshaws and e-loaders, quoted in kilowatt-hours because that — not ampere-hours alone — is what decides a working day.',
    points: ['Quoted in kWh', 'A third the weight of lead acid', 'No acid, no terminal corrosion'],
    image: '/art/battery-3-front.svg',
    primary: {
      label: 'Shop e-rickshaw batteries',
      href: subcategoryPath('batteries', 'ev-3-wheeler'),
    },
    secondary: { label: 'All batteries', href: categoryPath('batteries') },
  },
];

const INTERVAL = 7000;

export function Hero() {
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), INTERVAL);
    return () => window.clearInterval(timer);
  }, [paused]);

  const slide = SLIDES[index];

  return (
    <section
      aria-label="Featured"
      className="relative overflow-hidden bg-ink-900 text-ink-50"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Soft brand wash — kept subtle so product art stays the focus. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-32 h-[34rem] w-[34rem] rounded-full bg-primary-400/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-32 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl"
      />

      <div className="container relative grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-12 lg:gap-12 lg:py-20">
        <div key={index} className="animate-fade-up lg:col-span-6">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-2xs font-semibold uppercase tracking-[0.14em] text-primary-300">
            {slide.eyebrow}
          </p>
          <h1 className="heading-1 mt-4 text-balance text-ink-50">{slide.title}</h1>
          <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-ink-50/75 sm:text-base">
            {slide.body}
          </p>

          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
            {slide.points.map((point) => (
              <li
                key={point}
                className="flex items-center gap-1.5 text-sm text-ink-50/85"
              >
                <Check className="h-4 w-4 shrink-0 text-primary-300" />
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={slide.primary.href} variant="accent" size="lg">
              {slide.primary.label}
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink
              href={slide.secondary.href}
              size="lg"
              variant="outline"
              className="border-white/25 bg-transparent text-ink-50 hover:border-white/50 hover:bg-white/10"
            >
              {slide.secondary.label}
            </ButtonLink>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="relative mx-auto aspect-[4/3] w-full max-w-lg">
            <Image
              key={slide.image}
              src={slide.image}
              alt=""
              fill
              priority={index === 0}
              sizes="(max-width: 1024px) 90vw, 520px"
              className="animate-fade-in rounded-xl object-contain"
            />
          </div>
        </div>
      </div>

      <div className="container relative flex items-center justify-between gap-4 pb-6 lg:pb-8">
        <div className="flex gap-2">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show slide ${i + 1}: ${s.title}`}
              aria-current={i === index}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === index ? 'w-8 bg-accent' : 'w-4 bg-white/25 hover:bg-white/45',
              )}
            />
          ))}
        </div>
        <Link
          href="/search"
          className="group hidden items-center gap-1.5 text-sm font-medium text-ink-50/70 transition-colors hover:text-primary-300 sm:inline-flex"
        >
          Browse the full range
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
