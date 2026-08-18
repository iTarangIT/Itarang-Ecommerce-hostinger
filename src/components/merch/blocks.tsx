import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  ClipboardCheck,
  Headphones,
  MapPin,
  ShieldCheck,
  Truck,
  Wallet,
  Wrench,
} from 'lucide-react';
import type { NavCategory } from '@/lib/navigation';
import { TRUST_ITEMS } from '@/lib/site';
import { ButtonLink } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section';
import { CategoryIcon } from '@/components/layout/category-icon';
import { cn } from '@/lib/utils';

const TRUST_ICONS = { truck: Truck, shield: ShieldCheck, wallet: Wallet, wrench: Wrench };

/* -------------------------------------------------------------- trust row */

export function TrustRow({ className }: { className?: string }) {
  return (
    <section
      aria-label="Why buy from iTarang"
      className={cn('border-y border-border bg-surface', className)}
    >
      <ul className="container grid grid-cols-2 gap-x-4 gap-y-5 py-6 lg:grid-cols-4 lg:py-7">
        {TRUST_ITEMS.map((item) => {
          const Icon = TRUST_ICONS[item.icon];
          return (
            <li key={item.title} className="flex items-start gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-card text-accent-600 shadow-card">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-snug text-foreground">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {item.detail}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* --------------------------------------------------------- category tiles */

export function CategoryTiles({ categories }: { categories: NavCategory[] }) {
  return (
    <section className="container section">
      <SectionHeader
        eyebrow="Shop by category"
        title="Power systems for your home"
        description="Four families, fourteen types. Start where you know what you need, or let the load calculator decide for you."
        action={{ label: 'Browse everything', href: '/search' }}
      />
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {categories.map((category) => (
          <article
            key={category.slug}
            className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-raised"
          >
            <div className="relative aspect-[16/10] overflow-hidden bg-surface">
              {category.featured ? (
                <Image
                  src={category.featured.image}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-contain p-4 transition-transform duration-300 group-hover:scale-[1.04]"
                />
              ) : null}
              <span className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-md bg-card text-primary shadow-card">
                <CategoryIcon kind={category.icon} className="h-4.5 w-4.5" />
              </span>
            </div>
            <div className="flex flex-1 flex-col p-4">
              <h3 className="font-display text-base font-bold text-foreground">
                <Link href={category.href} className="after:absolute after:inset-0">
                  {category.name}
                </Link>
              </h3>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {category.tagline}
              </p>
              <ul className="relative z-10 mt-3 flex flex-wrap gap-1.5">
                {category.subcategories.slice(0, 3).map((sub) => (
                  <li key={sub.href}>
                    <Link
                      href={sub.href}
                      className="inline-block rounded-sm border border-border px-2 py-1 text-2xs font-medium text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent-600"
                    >
                      {sub.name.replace(/ (Inverters|Batteries|UPS|Combos)$/, '')}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                {category.total} products
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------- load calculator promo */

export function LoadCalculatorPromo() {
  return (
    <section className="container">
      <div className="grid overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-12">
        <div className="flex flex-col justify-center p-6 sm:p-8 lg:col-span-7 lg:p-10">
          <p className="eyebrow">Free sizing tool</p>
          <h2 className="heading-2 mt-2 text-balance">
            Not sure what size inverter your home needs?
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Tick the appliances you want running during a cut and how long you need them for. We
            work out the inverter VA and battery Ah, and show you the iTarang systems that match —
            no guesswork, no sales call required.
          </p>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {[
              'Appliance presets with real wattages',
              'Surge headroom built into the maths',
              'Battery sized to your backup hours',
              'One click to the matching combo',
            ].map((point) => (
              <li key={point} className="flex items-start gap-2 text-sm text-muted-foreground">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                {point}
              </li>
            ))}
          </ul>
          <div className="mt-7">
            <ButtonLink href="/tools/load-calculator" variant="accent" size="lg">
              <Calculator className="h-4 w-4" />
              Open the load calculator
            </ButtonLink>
          </div>
        </div>
        <div className="relative min-h-[13rem] bg-primary lg:col-span-5">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent/20 blur-3xl"
          />
          <Image
            src="/art/inverter-1-detail.svg"
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 40vw"
            className="object-contain p-6"
          />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ load guide */

/**
 * Each row links into the load calculator pre-filled with that appliance mix,
 * rather than at a specific SKU — so the guide keeps working whatever the
 * catalogue currently holds, and the shopper lands on a sized recommendation.
 */
const LOAD_GUIDE = [
  {
    home: 'One room or studio',
    load: '2 fans · 4 LED lights · router',
    system: '700VA inverter + 100Ah battery',
    backup: '3 – 4 hours',
    href: '/tools/load-calculator?load=fan:2,led:4,router:1&hours=4',
  },
  {
    home: 'Two to three bedrooms',
    load: '4 fans · 6 lights · TV · router',
    system: '900VA inverter + 150Ah battery',
    backup: '6 – 8 hours',
    href: '/tools/load-calculator?load=fan:4,led:6,tv:1,router:1&hours=6',
  },
  {
    home: 'Three bedrooms with a mixer or pump',
    load: 'Above, plus a mixer or small pump',
    system: '1100VA inverter + 150Ah lithium',
    backup: '7 – 9 hours',
    href: '/tools/load-calculator?load=fan:4,led:6,tv:1,router:1,mixer:1&hours=7',
  },
  {
    home: 'Four bedrooms with refrigeration',
    load: 'Above, plus a refrigerator',
    system: '1500VA inverter + 220Ah battery',
    backup: '8 – 10 hours',
    href: '/tools/load-calculator?load=fan:4,led:8,tv:1,router:1,fridge:1&hours=8',
  },
];

export function LoadGuide() {
  return (
    <section className="container section">
      <SectionHeader
        eyebrow="Sizing at a glance"
        title="Built for every home load"
        description="A starting point, not a substitute for the calculator — your actual appliances decide the final figure."
        action={{ label: 'Size it precisely', href: '/tools/load-calculator' }}
      />

      {/* Table on desktop, cards on mobile — same data, format that suits the width. */}
      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Home size</th>
              <th scope="col" className="px-4 py-3 font-semibold">Typical load</th>
              <th scope="col" className="px-4 py-3 font-semibold">Recommended system</th>
              <th scope="col" className="px-4 py-3 font-semibold">Backup</th>
              <th scope="col" className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {LOAD_GUIDE.map((row) => (
              <tr key={row.home} className="transition-colors hover:bg-surface">
                <th scope="row" className="px-4 py-3.5 font-semibold text-foreground">
                  {row.home}
                </th>
                <td className="px-4 py-3.5 text-muted-foreground">{row.load}</td>
                <td className="px-4 py-3.5 font-medium text-foreground">{row.system}</td>
                <td className="tabular px-4 py-3.5 text-muted-foreground">{row.backup}</td>
                <td className="px-4 py-3.5 text-right">
                  <Link
                    href={row.href}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-accent-600 underline-offset-4 hover:underline"
                  >
                    Size this
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-3 md:hidden">
        {LOAD_GUIDE.map((row) => (
          <li key={row.home} className="rounded-lg border border-border bg-card p-4">
            <p className="font-display text-sm font-bold text-foreground">{row.home}</p>
            <p className="mt-1 text-xs text-muted-foreground">{row.load}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">System</dt>
                <dd className="font-medium text-foreground">{row.system}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Backup</dt>
                <dd className="tabular font-medium text-foreground">{row.backup}</dd>
              </div>
            </dl>
            <Link
              href={row.href}
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-600"
            >
              Size this system
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------------------------------------------------- owner centre */

const OWNER_ACTIONS = [
  {
    icon: ClipboardCheck,
    title: 'Register your warranty',
    description: 'Record your serial number so a claim never depends on finding the invoice.',
    href: '/support/warranty-registration',
  },
  {
    icon: Wrench,
    title: 'Book an installation',
    description: 'Pick a slot for a certified technician to install and commission your system.',
    href: '/support/installation',
  },
  {
    icon: Headphones,
    title: 'Register a complaint',
    description: 'Log a fault and get a reference number you can track.',
    href: '/support/complaint',
  },
  {
    icon: MapPin,
    title: 'Find a technician',
    description: 'Search our service network by pincode.',
    href: '/support/dealers',
  },
];

export function OwnerCentre() {
  return (
    <section className="section bg-surface">
      <div className="container">
        <SectionHeader
          eyebrow="Owner centre"
          title="Everything after the sale"
          description="Warranty, installation, service and support — in one place, without a phone queue."
          action={{ label: 'Visit the support hub', href: '/support' }}
        />
        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {OWNER_ACTIONS.map((action) => (
            <li key={action.href}>
              <Link
                href={action.href}
                className="group flex h-full flex-col rounded-lg border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-raised"
              >
                <span className="grid h-11 w-11 place-items-center rounded-md bg-secondary text-primary transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                  <action.icon className="h-5 w-5" />
                </span>
                <span className="mt-4 font-display text-base font-semibold text-foreground">
                  {action.title}
                </span>
                <span className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {action.description}
                </span>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent-600">
                  Start
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
