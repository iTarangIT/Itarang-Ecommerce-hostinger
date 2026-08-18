'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Slide {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  image: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
}

const SLIDES: Slide[] = [
  {
    eyebrow: 'Power backup, properly sized',
    title: 'Never let a power cut stop your home',
    body: 'Pure sine wave inverters, long-life batteries and ready-matched combos — delivered, installed and warranted by iTarang.',
    points: ['Silent changeover', 'Wide input 100V–290V', 'Certified installation included'],
    image: '/art/combo-1-angle.svg',
    primary: { label: 'Shop combos', href: '/c/combos' },
    secondary: { label: 'Size my system', href: '/tools/load-calculator' },
  },
  {
    eyebrow: 'Lithium storage',
    title: 'Fit it once, forget the maintenance',
    body: 'LiFePO4 batteries need no water topping and no ventilated trolley, and take daily deep cycling in their stride.',
    points: ['5-year warranty', 'Roughly a third the weight', 'Charges about twice as fast'],
    image: '/art/battery-2-front.svg',
    primary: { label: 'Shop lithium batteries', href: '/c/batteries/lithium' },
    secondary: { label: 'Lithium vs tubular', href: '/c/batteries' },
  },
  {
    eyebrow: 'Solar ready',
    title: 'Buy the inverter now, add panels later',
    body: 'Solar-ready inverters run on grid charging from day one and accept an array whenever you are ready — no replacement needed.',
    points: ['Integrated charge controller', 'Up to 2000Wp on MPPT models', 'Panel sizing at survey'],
    image: '/art/inverter-3-angle.svg',
    primary: { label: 'Shop solar-ready', href: '/c/inverters/solar-ready' },
    secondary: { label: 'See solar combos', href: '/c/combos/solar-combos' },
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
      className="relative overflow-hidden bg-primary text-primary-foreground"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Soft brand wash — kept subtle so product art stays the focus. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-32 h-[34rem] w-[34rem] rounded-full bg-accent/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-32 h-[26rem] w-[26rem] rounded-full bg-white/5 blur-3xl"
      />

      <div className="container relative grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-12 lg:gap-12 lg:py-20">
        <div key={index} className="animate-fade-up lg:col-span-6">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-2xs font-semibold uppercase tracking-[0.14em] text-accent">
            {slide.eyebrow}
          </p>
          <h1 className="heading-1 mt-4 text-balance text-primary-foreground">{slide.title}</h1>
          <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-primary-foreground/75 sm:text-base">
            {slide.body}
          </p>

          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
            {slide.points.map((point) => (
              <li
                key={point}
                className="flex items-center gap-1.5 text-sm text-primary-foreground/85"
              >
                <Check className="h-4 w-4 shrink-0 text-accent" />
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
              className="border-white/25 bg-transparent text-primary-foreground hover:border-white/50 hover:bg-white/10"
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
          className="group hidden items-center gap-1.5 text-sm font-medium text-primary-foreground/70 transition-colors hover:text-accent sm:inline-flex"
        >
          Browse the full range
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
