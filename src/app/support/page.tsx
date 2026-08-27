import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Calculator,
  ClipboardCheck,
  Clock,
  Headphones,
  HelpCircle,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Wrench,
} from 'lucide-react';
import { SITE } from '@/lib/site';
import { FAQ_SECTIONS } from '@/lib/support/faqs';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { SectionHeader } from '@/components/ui/section';

export const metadata: Metadata = {
  title: 'Support & Owner Centre',
  description:
    'Register a warranty, book an installation, log a service request, check technician coverage or read the FAQ — everything after the sale, in one place.',
  alternates: { canonical: '/support' },
};

const SELF_SERVICE = [
  {
    icon: ClipboardCheck,
    title: 'Register your warranty',
    description:
      'Record your serial number so a future claim never depends on finding the original invoice.',
    href: '/support/warranty-registration',
  },
  {
    icon: Wrench,
    title: 'Book an installation',
    description:
      'Choose a slot for a certified technician to install and commission your system.',
    href: '/support/installation',
  },
  {
    icon: Headphones,
    title: 'Register a complaint',
    description: 'Log a fault and have a technician assigned for your pincode.',
    href: '/support/complaint',
  },
  {
    icon: MapPin,
    title: 'Find a technician',
    description: 'Check whether our service network covers your pincode.',
    href: '/support/dealers',
  },
  {
    icon: Package,
    title: 'Track your order',
    description: 'Follow your order from confirmation through to delivery.',
    href: '/track',
  },
  {
    icon: Calculator,
    title: 'Size a system',
    description: 'Work out the inverter VA and battery Ah your home needs.',
    href: '/tools/load-calculator',
  },
];

export default function SupportPage() {
  return (
    <>
      <div className="border-b border-border bg-ink-900 text-ink-50">
        <div className="container py-8 sm:py-12">
          <Breadcrumbs
            items={[{ label: 'Home', href: '/' }, { label: 'Support' }]}
            className="[&_a]:text-ink-50/70 [&_span]:text-ink-50/90"
          />
          <h1 className="heading-1 mt-3 text-balance text-ink-50">
            Support &amp; Owner Centre
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-ink-50/75 sm:text-base">
            Everything after the sale — warranty, installation, service and honest advice. Most
            things here you can do yourself in under a minute; if you would rather talk to an
            engineer, the number is below.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <a
              href={SITE.phoneHref}
              className="flex items-start gap-3 rounded-lg border border-white/15 bg-white/5 p-4 transition-colors hover:border-accent/50 hover:bg-white/10"
            >
              <Phone className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <span>
                <span className="block text-sm font-semibold">{SITE.phone}</span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-50/60">
                  <Clock className="h-3 w-3" />
                  {SITE.supportHours}
                </span>
              </span>
            </a>
            <a
              href={`mailto:${SITE.email}`}
              className="flex items-start gap-3 rounded-lg border border-white/15 bg-white/5 p-4 transition-colors hover:border-accent/50 hover:bg-white/10"
            >
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <span>
                <span className="block text-sm font-semibold">{SITE.email}</span>
                <span className="mt-0.5 block text-xs text-ink-50/60">
                  Orders, warranty and service
                </span>
              </span>
            </a>
            <a
              href={SITE.whatsapp}
              className="flex items-start gap-3 rounded-lg border border-white/15 bg-white/5 p-4 transition-colors hover:border-accent/50 hover:bg-white/10"
            >
              <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <span>
                <span className="block text-sm font-semibold">WhatsApp</span>
                <span className="mt-0.5 block text-xs text-ink-50/60">
                  Send a photo of your setup
                </span>
              </span>
            </a>
          </div>
        </div>
      </div>

      <div className="container section">
        <SectionHeader
          eyebrow="Self service"
          title="Do it yourself, right now"
          description="No phone queue and no account required — each of these takes about a minute."
        />
        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {SELF_SERVICE.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group flex h-full flex-col rounded-lg border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-raised"
              >
                <span className="grid h-11 w-11 place-items-center rounded-md bg-secondary text-primary transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                  <item.icon className="h-5 w-5" />
                </span>
                <span className="mt-4 font-display text-base font-semibold text-foreground">
                  {item.title}
                </span>
                <span className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </span>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent-600">
                  Open
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-border bg-surface">
        <div className="container section">
          <SectionHeader
            eyebrow="Answers"
            title="Browse the FAQ by topic"
            action={{ label: 'Open the full FAQ', href: '/support/faq' }}
          />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FAQ_SECTIONS.map((section) => (
              <li key={section.id}>
                <Link
                  href={`/support/faq#${section.id}`}
                  className="group flex h-full flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:border-accent/40"
                >
                  <HelpCircle className="h-5 w-5 text-accent-600" />
                  <span className="mt-3 font-display text-sm font-semibold text-foreground">
                    {section.title}
                  </span>
                  <span className="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground">
                    {section.description}
                  </span>
                  <span className="tabular mt-3 text-xs font-semibold text-muted-foreground">
                    {section.entries.length} questions
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
