import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Calculator, Check, ShieldCheck } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { subcategoryPath } from '@/lib/routes';

/**
 * The home hero, as the business specified it: one 3-wheeler battery and one
 * inverter battery side by side, with "Shop now" and "Calculate your home
 * backup need" as the two actions.
 *
 * It used to be a three-slide carousel. A carousel shows one product line at a
 * time and asks a visitor to wait for the one they came for; two cards show
 * both lines at once, and each card is itself a way in.
 *
 * Kept to about half its old height (R-09), so the product rail and its prices
 * are within one scroll on a laptop: tighter padding, a shorter image band, and
 * the copy trimmed to the headline, the three points and the two actions.
 *
 * The photos are the Trontek listing images, cropped to the product. Every
 * figure on a card is printed on that same listing image — capacity, voltage
 * and the warranty wording — so the hero states nothing the documents do not.
 */
const PRODUCTS = [
  {
    eyebrow: '3-wheeler & e-rickshaw',
    title: 'LiEV traction packs',
    detail: '51 V · 105 Ah · 5.36 kWh',
    note: '3 years or 1200 cycles warranty',
    image: '/images/hero/e-rickshaw-battery.jpg',
    width: 840,
    height: 560,
    href: subcategoryPath('batteries', 'ev-3-wheeler'),
  },
  {
    eyebrow: 'Home inverter',
    title: 'Powercube home storage',
    detail: '12.8 V · 105 Ah · 1.34 kWh',
    note: '5 years or 4000 cycles warranty',
    image: '/images/hero/inverter-battery.jpg',
    width: 600,
    height: 810,
    href: subcategoryPath('batteries', 'home-inverter'),
  },
] as const;

const POINTS = ['LiFePO4 chemistry', 'Built-in BMS', 'Made in India by Trontek'];

export function Hero() {
  return (
    <section aria-label="Featured" className="relative overflow-hidden bg-ink-900 text-ink-50">
      {/* Soft brand wash — kept subtle so the products stay the focus. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-32 h-[34rem] w-[34rem] rounded-full bg-primary-400/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-32 h-[26rem] w-[26rem] rounded-full bg-accent/10 blur-3xl"
      />

      <div className="container relative grid items-center gap-6 py-6 sm:py-8 lg:grid-cols-12 lg:gap-10 lg:py-8">
        <div className="animate-fade-up lg:col-span-5">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-2xs font-semibold uppercase tracking-[0.14em] text-primary-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Lithium batteries for vehicles and homes
          </p>
          <h1 className="heading-1 mt-3 text-balance text-ink-50">
            Power that keeps India moving — on the road and at home
          </h1>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {POINTS.map((point) => (
              <li key={point} className="flex items-center gap-1.5 text-sm text-ink-50/85">
                <Check className="h-4 w-4 shrink-0 text-primary-300" />
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/products" variant="accent" size="lg">
              Shop now
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink
              href="/tools/load-calculator"
              size="lg"
              variant="outline"
              className="border-white/25 bg-transparent text-ink-50 hover:border-white/50 hover:bg-white/10"
            >
              <Calculator className="h-4 w-4" />
              Calculate your home backup need
            </ButtonLink>
          </div>
        </div>

        <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:col-span-7">
          {PRODUCTS.map((product, index) => (
            <Link
              key={product.href}
              href={product.href}
              className="group flex flex-col overflow-hidden rounded-xl bg-white text-ink-900 shadow-lg ring-1 ring-white/10 transition-transform duration-200 hover:-translate-y-1"
            >
              <div className="relative aspect-[16/9] w-full">
                <Image
                  src={product.image}
                  alt={`Trontek ${product.title}`}
                  width={product.width}
                  height={product.height}
                  priority={index === 0}
                  sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 340px"
                  className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </div>
              <div className="flex flex-1 flex-col border-t border-ink-100 p-3">
                <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-primary-600">
                  {product.eyebrow}
                </p>
                <p className="mt-1 font-display text-base font-semibold">{product.title}</p>
                <p className="tabular mt-0.5 text-sm text-ink-600">{product.detail}</p>
                <p className="mt-1 text-xs text-ink-500">{product.note}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary-600">
                  Shop {product.eyebrow.toLowerCase()}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
