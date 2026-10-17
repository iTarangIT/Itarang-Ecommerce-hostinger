import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The admin "Service" area: after-sales and storefront data that is not a
 * product or an order. One header link into it, tabs within it.
 */
const TABS = [
  { href: '/admin/support', label: 'Support requests' },
  { href: '/admin/reviews', label: 'Reviews' },
  { href: '/admin/coverage', label: 'Delivery coverage' },
  { href: '/admin/dealers', label: 'Dealers' },
] as const;

export function ServiceNav({
  current,
  title,
  description,
  children,
}: {
  current: (typeof TABS)[number]['href'];
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Orders
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="heading-2">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
      <nav aria-label="Service" className="mt-5 flex flex-wrap gap-1.5 border-b border-border pb-3">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.href === current ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-2 text-sm transition-colors',
              tab.href === current
                ? 'bg-primary font-medium text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

/** A message passed back on the query string after a form post. */
export function Notice({ text, tone = 'info' }: { text?: string; tone?: 'info' | 'error' }) {
  if (!text) return null;
  return (
    <p
      className={cn(
        'mt-4 rounded-lg border p-3 text-sm font-medium',
        tone === 'error'
          ? 'border-destructive/40 bg-destructive/5 text-destructive'
          : 'border-success/40 bg-success-soft text-success',
      )}
    >
      {text}
    </p>
  );
}
