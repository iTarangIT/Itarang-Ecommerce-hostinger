import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            // A long trail wraps to a second line on a phone. Only the current
            // page shrinks (and truncates); the links keep their width so they
            // cannot be squeezed on top of each other.
            <li
              key={`${item.label}-${index}`}
              className={cn('flex items-center gap-1', isLast ? 'min-w-0' : 'shrink-0')}
            >
              {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="shrink-0 transition-colors hover:text-primary-600 hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn('truncate', isLast && 'font-medium text-foreground')}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** BreadcrumbList JSON-LD so the trail is eligible for search result display. */
export function BreadcrumbJsonLd({ items, baseUrl }: { items: Crumb[]; baseUrl: string }) {
  const json = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: `${baseUrl}${item.href}` } : {}),
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
