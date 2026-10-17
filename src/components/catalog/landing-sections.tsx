import Link from 'next/link';
import {
  ArrowRight,
  BatteryCharging,
  Calculator,
  Cpu,
  Droplets,
  Factory,
  FileText,
  Gauge,
  PlugZap,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Accordion } from '@/components/ui/accordion';
import type { FeatureIcon, LandingContent } from '@/lib/catalog/landing-content';

const ICONS: Record<FeatureIcon, typeof Zap> = {
  shield: ShieldCheck,
  bolt: Zap,
  cycle: BatteryCharging,
  chip: Cpu,
  drop: Droplets,
  factory: Factory,
  plug: PlugZap,
  gauge: Gauge,
};

/** The "superior features" row under a category heading. */
export function FeatureRow({ features }: { features: LandingContent['features'] }) {
  if (features.length === 0) return null;
  return (
    <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {features.map((feature) => {
        const Icon = ICONS[feature.icon];
        return (
          <li key={feature.title} className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{feature.title}</span>
              <span className="block text-xs leading-snug text-muted-foreground">{feature.detail}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** "Choose the right battery": the matching calculator and the spec sheets. */
export function ChooseBand({ tool }: { tool: LandingContent['tool'] }) {
  return (
    <section aria-label="Choose the right product" className="container section-tight">
      <div className="grid gap-4 md:grid-cols-3">
        {tool ? (
          <Link
            href={tool.href}
            className="group flex flex-col rounded-xl border border-primary/30 bg-primary/5 p-6 transition-shadow hover:shadow-lg md:col-span-2"
          >
            <span className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-[0.12em] text-primary-600">
              <Calculator className="h-4 w-4" />
              Choose the right battery
            </span>
            <span className="mt-2 font-display text-xl font-semibold text-foreground">{tool.title}</span>
            <span className="mt-1.5 text-sm text-muted-foreground">{tool.body}</span>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              {tool.cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ) : null}
        <Link
          href="/downloads"
          className="group flex flex-col rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-lg"
        >
          <span className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <FileText className="h-4 w-4" />
            Brochures
          </span>
          <span className="mt-2 font-display text-xl font-semibold text-foreground">Spec sheets to download</span>
          <span className="mt-1.5 text-sm text-muted-foreground">
            Every product’s full specification, ready to print or share.
          </span>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
            View spec sheets
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>
    </section>
  );
}

/** Questions for this section, with FAQPage structured data. */
export function LandingFaq({ faqs, heading }: { faqs: LandingContent['faqs']; heading: string }) {
  if (faqs.length === 0) return null;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
  return (
    <section aria-labelledby="landing-faq" className="container section-tight">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h2 id="landing-faq" className="heading-3">
        Questions about {heading.toLowerCase()}
      </h2>
      <Accordion
        className="mt-4"
        multiple={false}
        items={faqs.map((faq, index) => ({
          id: faq.id,
          title: faq.question,
          defaultOpen: index === 0,
          children: <p className="text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>,
        }))}
      />
    </section>
  );
}
