import type { Metadata } from 'next';
import Link from 'next/link';
import { Calculator } from 'lucide-react';
import {
  ALL_POSTS,
  BLOG_CATEGORIES,
  BLOG_PATH,
  categoryFromParam,
  categoryParam,
  postsInCategory,
} from '@/lib/blog';
import { SITE } from '@/lib/site';
import { BreadcrumbJsonLd, Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { PostCard } from '@/components/blog/post-card';
import { cn } from '@/lib/utils';

interface PageProps {
  searchParams: Promise<{ category?: string | string[] }>;
}

const DESCRIPTION =
  'Practical guides to lithium batteries for Indian homes and EVs — choosing an e-rickshaw or scooter battery, sizing inverter backup, charging safely and understanding the BMS.';

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const raw = (await searchParams).category;
  const category = categoryFromParam(Array.isArray(raw) ? raw[0] : raw);
  return {
    title: category ? `${category} articles` : 'Guides & articles',
    description: DESCRIPTION,
    // Filtered views are the same content re-ordered, so they all point at the index.
    alternates: { canonical: BLOG_PATH },
    openGraph: {
      title: `Guides & articles | ${SITE.name}`,
      description: DESCRIPTION,
      url: BLOG_PATH,
      type: 'website',
    },
  };
}

const CRUMBS = [{ label: 'Home', href: '/' }, { label: 'Guides & articles', href: BLOG_PATH }];

export default async function BlogIndexPage({ searchParams }: PageProps) {
  const raw = (await searchParams).category;
  const active = categoryFromParam(Array.isArray(raw) ? raw[0] : raw);
  const posts = postsInCategory(active);

  const filters = [
    { label: 'All', href: BLOG_PATH, isActive: !active, count: ALL_POSTS.length },
    ...BLOG_CATEGORIES.map((category) => ({
      label: category,
      href: `${BLOG_PATH}?category=${categoryParam(category)}`,
      isActive: active === category,
      count: postsInCategory(category).length,
    })),
  ].filter((filter) => filter.count > 0);

  return (
    <>
      <BreadcrumbJsonLd items={CRUMBS} baseUrl={SITE.url} />

      <div className="border-b border-border bg-surface">
        <div className="container py-6 sm:py-8">
          <Breadcrumbs items={CRUMBS} />
          <p className="eyebrow mt-4">The iTarang blog</p>
          <h1 className="heading-1 mt-1.5 text-balance">Guides &amp; articles</h1>
          <p className="mt-3 max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            Straightforward help with lithium batteries for e-rickshaws, electric 2-wheelers and
            home backup — what the numbers on the label mean, how to size a system, and how to
            look after it.
          </p>
        </div>
      </div>

      <div className="container section-tight">
        <nav aria-label="Filter articles by category" className="-mx-1 overflow-x-auto no-scrollbar">
          <ul className="flex gap-2 px-1">
            {filters.map((filter) => (
              <li key={filter.label} className="shrink-0">
                <Link
                  href={filter.href}
                  aria-current={filter.isActive ? 'page' : undefined}
                  scroll={false}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors',
                    filter.isActive
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
                  )}
                >
                  {filter.label}
                  <span className="tabular text-xs opacity-75">{filter.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {posts.length > 0 ? (
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <li key={post.slug}>
                <PostCard post={post} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            No articles in this category yet.{' '}
            <Link href={BLOG_PATH} className="font-medium text-primary hover:underline">
              See all articles
            </Link>
            .
          </p>
        )}

        <div className="mt-10 flex flex-col gap-4 rounded-lg border border-accent/30 bg-accent-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
              <Calculator className="h-5 w-5 text-accent-600" aria-hidden="true" />
              Sizing home backup?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick your appliances and backup hours, and the load calculator suggests a battery
              size.
            </p>
          </div>
          <ButtonLink href="/tools/load-calculator" variant="accent" size="sm" className="shrink-0">
            Open the load calculator
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
