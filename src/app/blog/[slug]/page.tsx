import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Calculator, Clock, ShoppingBag } from 'lucide-react';
import {
  ALL_POSTS,
  BLOG_PATH,
  categoryParam,
  categoryPathLabel,
  formatPostDate,
  getPost,
  postPath,
  relatedPosts,
  tableOfContents,
  wordCount,
} from '@/lib/blog';
import { SITE } from '@/lib/site';
import { BreadcrumbJsonLd, Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { ArticleBody } from '@/components/blog/article-body';
import { PostCard } from '@/components/blog/post-card';
import { TableOfContents } from '@/components/blog/table-of-contents';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return ALL_POSTS.map((post) => ({ slug: post.slug }));
}

/** Posts are compiled into the bundle, so an unknown slug is always a 404. */
export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return { title: 'Article not found' };
  const url = postPath(post.slug);
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: `${post.title} | ${SITE.name}`,
      description: post.description,
      url,
      publishedTime: post.date,
      modifiedTime: post.updated ?? post.date,
      authors: [post.author],
      section: post.category,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const post = getPost((await params).slug);
  if (!post) notFound();

  const url = postPath(post.slug);
  const toc = tableOfContents(post.body);
  const related = relatedPosts(post);
  // The load calculator sizes household backup only, so it is offered on
  // articles that touch home storage and not on the EV-only guides.
  const offersCalculator = post.relatedCategoryPaths.some(
    (path) => path.endsWith('/home-inverter') || path.endsWith('/ess'),
  );

  const crumbs = [
    { label: 'Home', href: '/' },
    { label: 'Guides & articles', href: BLOG_PATH },
    { label: post.category, href: `${BLOG_PATH}?category=${categoryParam(post.category)}` },
    { label: post.title, href: url },
  ];

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    author: { '@type': 'Organization', name: post.author, url: SITE.url },
    publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE.url}${url}` },
    articleSection: post.category,
    wordCount: wordCount(post),
    inLanguage: 'en-IN',
  };

  return (
    <>
      <BreadcrumbJsonLd items={crumbs} baseUrl={SITE.url} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <div className="border-b border-border bg-surface">
        <div className="container py-6 sm:py-8">
          <Breadcrumbs items={crumbs} />
          <p className="eyebrow mt-4">{post.category}</p>
          <h1 className="heading-1 mt-1.5 max-w-4xl text-balance">{post.title}</h1>
          <p className="mt-3 max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            {post.description}
          </p>
          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground sm:text-sm">
            <span className="font-medium text-foreground">{post.author}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={post.date}>{formatPostDate(post.date)}</time>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {post.readingMinutes} min read
            </span>
          </p>
        </div>
      </div>

      <div className="container grid gap-8 py-8 lg:grid-cols-12 lg:gap-10 lg:py-10">
        <article className="min-w-0 lg:col-span-8">
          {/* Contents above the text on small screens; in the sidebar from lg. */}
          <TableOfContents entries={toc} className="mb-8 lg:hidden" />
          <ArticleBody body={post.body} />

          <section
            aria-labelledby="shop-heading"
            className="mt-12 rounded-lg border border-border bg-card p-5 sm:p-6"
          >
            <h2 id="shop-heading" className="heading-3 flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-accent-600" aria-hidden="true" />
              Ready to choose?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Every product page lists the full specification, so you can check the numbers in
              this guide against the battery before you buy.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {post.relatedCategoryPaths.map((path) => (
                <ButtonLink key={path} href={path} variant="outline" size="sm">
                  {categoryPathLabel(path)}
                  <ArrowRight className="h-3.5 w-3.5" />
                </ButtonLink>
              ))}
              <ButtonLink href="/products" variant="ghost" size="sm">
                All products
              </ButtonLink>
            </div>
          </section>
        </article>

        <aside className="lg:col-span-4">
          <div className="space-y-4 lg:sticky lg:top-24">
            <TableOfContents entries={toc} className="hidden lg:block" />

            {offersCalculator ? (
            <div className="rounded-lg border border-accent/30 bg-accent-50 p-5">
              <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                <Calculator className="h-4.5 w-4.5 text-accent-600" aria-hidden="true" />
                Size it with the calculator
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Choose your appliances and backup hours; the load calculator suggests a battery
                size for your home.
              </p>
              <ButtonLink
                href="/tools/load-calculator"
                variant="accent"
                size="sm"
                className="mt-3"
              >
                Open the load calculator
                <ArrowRight className="h-3.5 w-3.5" />
              </ButtonLink>
            </div>
            ) : null}

            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="font-display text-sm font-semibold text-card-foreground">
                Still unsure?
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Tell us your vehicle or load and we will help you pick.{' '}
                <a href={SITE.phoneHref} className="font-medium text-primary hover:underline">
                  {SITE.phone}
                </a>{' '}
                ·{' '}
                <Link href="/support" className="font-medium text-primary hover:underline">
                  Support
                </Link>
              </p>
            </div>
          </div>
        </aside>
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="related-heading" className="border-t border-border bg-surface">
          <div className="container section-tight">
            <div className="flex items-end justify-between gap-4">
              <h2 id="related-heading" className="heading-2">
                Keep reading
              </h2>
              <Link
                href={BLOG_PATH}
                className="shrink-0 text-sm font-medium text-primary hover:underline"
              >
                All articles
              </Link>
            </div>
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <li key={item.slug}>
                  <PostCard post={item} headingLevel="h3" />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}
