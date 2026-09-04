import Link from 'next/link';
import { Compass } from 'lucide-react';
import { CATEGORIES } from '@/lib/commerce/mock/categories';
import { ButtonLink } from '@/components/ui/button';
import { StateBlock } from '@/components/ui/states';
import { categoryPath } from '@/lib/routes';

export default function NotFound() {
  return (
    <div className="container py-16 lg:py-24">
      <StateBlock
        icon={<Compass className="h-6 w-6" />}
        title="We could not find that page"
        description="The link may be out of date, or the product may have been renamed. Everything in the range is still one click away."
        actions={
          <>
            <ButtonLink href="/" variant="primary">
              Go to the homepage
            </ButtonLink>
            <ButtonLink href="/search" variant="outline">
              Search the range
            </ButtonLink>
          </>
        }
      />

      <nav aria-label="Categories" className="mx-auto mt-8 max-w-3xl">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((category) => (
            <li key={category.slug}>
              <Link
                href={categoryPath(category.slug)}
                className="flex h-full flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent/40"
              >
                <span className="font-display text-sm font-semibold text-foreground">
                  {category.name}
                </span>
                <span className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {category.tagline}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
