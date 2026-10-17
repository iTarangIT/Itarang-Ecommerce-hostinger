import Link from 'next/link';
import { FileText, Headphones, Mail, Phone, RotateCcw, Scale, ShieldCheck } from 'lucide-react';
import { SITE } from '@/lib/site';
import { WARRANTY_CONTACTS, telHref } from '@/lib/support/contacts';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';

/**
 * Owner Centre sidebar links: the after-sales actions, then the policies a
 * customer reads when something has gone wrong.
 */
const OWNER_LINKS = [
  { href: '/support/complaint', label: 'Register a complaint', icon: Headphones },
  { href: '/support/warranty-registration', label: 'Register your warranty', icon: ShieldCheck },
  { href: '/support/grievance', label: 'Grievance officer', icon: Scale },
  { href: '/policies/refund', label: 'Refund & return policy', icon: RotateCcw },
  { href: '/policies/payment-failure', label: 'Payment failure policy', icon: FileText },
];

/**
 * Shared layout for every Owner Centre page: breadcrumbs, page heading, the
 * form or content, and a persistent sidebar of the other actions plus a way to
 * reach a person.
 */
export function SupportShell({
  title,
  intro,
  current,
  children,
}: {
  title: string;
  intro: string;
  current: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className="container py-6 sm:py-8">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Support', href: '/support' },
              { label: title },
            ]}
          />
          <h1 className="heading-1 mt-3 text-balance">{title}</h1>
          <p className="mt-3 max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            {intro}
          </p>
        </div>
      </div>

      <div className="container grid gap-8 py-8 lg:grid-cols-12 lg:gap-10 lg:py-10">
        <div className="lg:col-span-8">{children}</div>

        <aside className="lg:col-span-4">
          <div className="space-y-4 lg:sticky lg:top-24">
            <nav aria-label="Owner centre" className="rounded-lg border border-border bg-card p-2">
              <h2 className="px-3 py-2 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Owner centre
              </h2>
              <ul>
                {OWNER_LINKS.map((link) => {
                  const active = link.href === current;
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors ${
                          active
                            ? 'bg-secondary font-semibold text-foreground'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                        }`}
                      >
                        <link.icon className="h-4.5 w-4.5 shrink-0 text-accent-600" />
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Two numbers, as the business asked: the manufacturer's and ours.
                A line with no details yet is filtered out in `contacts.ts`. */}
            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="font-display text-sm font-semibold text-card-foreground">
                Warranty helpline
              </h2>
              <ul className="mt-3 space-y-3 text-sm">
                {WARRANTY_CONTACTS.map((line) => (
                  <li key={line.label}>
                    <span className="block text-xs font-medium text-muted-foreground">
                      {line.label}
                    </span>
                    {line.phone ? (
                      <a
                        href={telHref(line.phone) ?? undefined}
                        className="flex items-center gap-2 font-semibold text-foreground hover:text-accent-600"
                      >
                        <Phone className="h-4 w-4 shrink-0 text-accent-600" />
                        {line.phone}
                      </a>
                    ) : null}
                    {line.email ? (
                      <a
                        href={`mailto:${line.email}`}
                        className="mt-0.5 flex items-center gap-2 text-foreground hover:text-accent-600"
                      >
                        <Mail className="h-4 w-4 shrink-0 text-accent-600" />
                        {line.email}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="font-display text-sm font-semibold text-card-foreground">
                Rather talk to someone?
              </h2>
              <ul className="mt-3 space-y-2.5 text-sm">
                <li>
                  <a
                    href={SITE.phoneHref}
                    className="flex items-center gap-2.5 text-foreground transition-colors hover:text-accent-600"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-accent-600" />
                    <span>
                      {SITE.phone}
                      <span className="block text-xs text-muted-foreground">
                        {SITE.supportHours}
                      </span>
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${SITE.email}`}
                    className="flex items-center gap-2.5 text-foreground transition-colors hover:text-accent-600"
                  >
                    <Mail className="h-4 w-4 shrink-0 text-accent-600" />
                    {SITE.email}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
