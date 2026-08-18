import Link from 'next/link';
import { ArrowRight, Mail, MessageCircle, Phone } from 'lucide-react';
import { SITE } from '@/lib/site';
import { FAQ_SECTIONS } from '@/lib/support/faqs';

/**
 * Homepage support band: the three most-asked questions plus the three ways to
 * reach a person. Deliberately placed after the merchandising bands so it
 * catches people who did not find what they needed above.
 */
export function SupportTeaser() {
  const topQuestions = FAQ_SECTIONS.flatMap((section) =>
    section.entries.slice(0, 1).map((entry) => ({ ...entry, section: section.title })),
  ).slice(0, 4);

  return (
    <section className="border-t border-border bg-surface">
      <div className="container grid gap-8 py-12 lg:grid-cols-12 lg:gap-12 lg:py-16">
        <div className="lg:col-span-5">
          <p className="eyebrow">Talk to a real engineer</p>
          <h2 className="heading-2 mt-2 text-balance">
            Warranty, service and honest advice
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            If you are unsure whether a system fits your load, ask before you buy. We would rather
            talk you into the right size than sell you the wrong one.
          </p>

          <ul className="mt-6 space-y-2.5">
            <li>
              <a
                href={SITE.phoneHref}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-accent/40"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-secondary text-primary">
                  <Phone className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{SITE.phone}</span>
                  <span className="block text-xs text-muted-foreground">{SITE.supportHours}</span>
                </span>
              </a>
            </li>
            <li>
              <a
                href={`mailto:${SITE.email}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-accent/40"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-secondary text-primary">
                  <Mail className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{SITE.email}</span>
                  <span className="block text-xs text-muted-foreground">
                    Orders, warranty and service
                  </span>
                </span>
              </a>
            </li>
            <li>
              <a
                href={SITE.whatsapp}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-accent/40"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-secondary text-primary">
                  <MessageCircle className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">WhatsApp</span>
                  <span className="block text-xs text-muted-foreground">
                    Send a photo of your setup for faster help
                  </span>
                </span>
              </a>
            </li>
          </ul>
        </div>

        <div className="lg:col-span-7">
          <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-accent-600">
            Asked most often
          </h3>
          <dl className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
            {topQuestions.map((entry) => (
              <div key={entry.id} className="p-5">
                <dt className="font-display text-[0.95rem] font-semibold text-foreground">
                  {entry.question}
                </dt>
                <dd className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {entry.answer}
                </dd>
              </div>
            ))}
          </dl>
          <Link
            href="/support/faq"
            className="group mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-accent-600"
          >
            Read all frequently asked questions
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
