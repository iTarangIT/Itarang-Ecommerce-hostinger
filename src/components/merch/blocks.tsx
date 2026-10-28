import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Factory,
  Headphones,
  PhoneCall,
  Recycle,
  ShieldCheck,
} from 'lucide-react';
import type { NavCategory } from '@/lib/navigation';
import { TRUST_ITEMS } from '@/lib/site';
import { SectionHeader } from '@/components/ui/section';
import { CategoryIcon } from '@/components/layout/category-icon';
import { cn } from '@/lib/utils';

const TRUST_ICONS = {
  shield: ShieldCheck,
  factory: Factory,
  phone: PhoneCall,
  recycle: Recycle,
};

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

/** "Four families, fifteen types" — counted, never typed. */
function describeTaxonomy(categories: NavCategory[]): string {
  const families = categories.length;
  const types = categories.reduce((sum, category) => sum + category.subcategories.length, 0);
  return `${families} ${families === 1 ? 'family' : 'families'}, ${types} ${types === 1 ? 'type' : 'types'}.`;
}

/**
 * One tile per thing a shopper actually shops for (R-09): "3-wheeler",
 * "2-wheeler", "Home inverter" rather than one "Batteries" card alone in a
 * three-column row. Built from the live navigation, so an empty subcategory
 * never gets a tile and a new one gets one on its own.
 */
export function CategoryTiles({ categories }: { categories: NavCategory[] }) {
  const tiles = categories.flatMap((category) =>
    category.subcategories.map((sub) => ({
      key: sub.href,
      href: sub.href,
      name: sub.name,
      description: sub.description,
      count: sub.count,
      image: sub.image ?? category.featured?.image,
      icon: category.icon,
    })),
  );

  return (
    <section className="container section">
      <SectionHeader
        eyebrow="Shop by category"
        title="Find the battery for your vehicle or home"
        description={`${describeTaxonomy(categories)} Start where you know what you need, or let the load calculator decide for you.`}
        action={{ label: 'Browse everything', href: '/search' }}
      />
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {tiles.map((tile) => (
          <article
            key={tile.key}
            className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-raised"
          >
            <div className="relative aspect-[16/10] overflow-hidden bg-surface">
              {tile.image ? (
                <Image
                  src={tile.image}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-contain p-4 transition-transform duration-300 group-hover:scale-[1.04]"
                />
              ) : null}
              <span className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-md bg-card text-primary shadow-card">
                <CategoryIcon kind={tile.icon} className="h-4.5 w-4.5" />
              </span>
            </div>
            <div className="flex flex-1 flex-col p-4">
              <h3 className="font-display text-base font-bold text-foreground">
                <Link href={tile.href} className="after:absolute after:inset-0">
                  {tile.name}
                </Link>
              </h3>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {tile.description}
              </p>
              <p className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-semibold text-primary-600">
                {tile.count} {tile.count === 1 ? 'product' : 'products'}
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

/**
 * Each row links into the load calculator pre-filled with that appliance mix,
 * rather than at a specific SKU — so the guide keeps working whatever the
 * catalogue currently holds, and the shopper lands on a sized recommendation.
 *
 * It used to carry two more columns, "Recommended system" and "Backup", with
 * values like "900VA inverter + 150Ah battery" and "6 – 8 hours". Both were
 * hardcoded: the products named do not exist in the catalogue, and the backup
 * figures were not produced by the calculator the table sends people to. A
 * guide that recommends a specific system has to get it from the sizing code,
 * so the columns are gone and the link does the work.
 */
const LOAD_GUIDE = [
  {
    home: 'One room or studio',
    load: '2 fans · 4 LED lights · router',
    href: '/tools/load-calculator?load=fan:2,led:4,router:1&hours=4',
  },
  {
    home: 'Two to three bedrooms',
    load: '4 fans · 6 lights · TV · router',
    href: '/tools/load-calculator?load=fan:4,led:6,tv:1,router:1&hours=6',
  },
  {
    home: 'Three bedrooms with a mixer or pump',
    load: 'Above, plus a mixer or small pump',
    href: '/tools/load-calculator?load=fan:4,led:6,tv:1,router:1,mixer:1&hours=7',
  },
  {
    home: 'Four bedrooms with refrigeration',
    load: 'Above, plus a refrigerator',
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
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Home size</th>
              <th scope="col" className="px-4 py-3 font-semibold">Typical load</th>
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

/**
 * Owner Centre actions.
 *
 * Reduced to complaint registration only. Warranty registration, installation
 * booking and technician lookup have been withdrawn from the after-sales
 * navigation — their routes, pages and forms are all still in place and still
 * work when visited directly; they are simply not advertised here.
 */
const OWNER_ACTIONS = [
  {
    icon: Headphones,
    title: 'Register a complaint',
    description: 'Log a fault and get a reference number you can track.',
    href: '/support/complaint',
  },
];

export function OwnerCentre() {
  return (
    <section className="section bg-surface">
      <div className="container">
        <SectionHeader
          eyebrow="Owner centre"
          title="Everything after the sale"
          description="Something not working as it should? Log it here and get a reference number you can follow up on."
          action={{ label: 'Visit the support hub', href: '/support' }}
        />
        <ul className="grid gap-3 sm:max-w-md sm:gap-4">
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
