import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { allProducts } from '@/lib/catalog/collections';
import { DOWNLOADS_PATH, groupBySubcategory, specSheetPath } from '@/lib/downloads/spec-sheets';
import { productPath } from '@/lib/routes';
import { SITE } from '@/lib/site';
import { attributePairs } from '@/components/product/key-attributes';
import { BreadcrumbJsonLd, Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';

const TITLE = 'Product brochures & spec sheets';
const DESCRIPTION =
  'Printable specification sheets for every iTarang battery and charger — full technical data, warranty and manufacturer details, ready to save as PDF.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: DOWNLOADS_PATH },
  openGraph: { title: `${TITLE} | ${SITE.name}`, description: DESCRIPTION, url: DOWNLOADS_PATH },
};

const CRUMBS = [
  { label: 'Home', href: '/' },
  { label: 'Brochures & spec sheets', href: DOWNLOADS_PATH },
];

/**
 * Every published product's spec sheet, grouped by subcategory.
 *
 * Built from whatever the catalogue serves, like `/products`: publishing a
 * product adds its sheet here and archiving one removes it.
 */
export default async function DownloadsPage() {
  const groups = groupBySubcategory(await allProducts());

  return (
    <>
      <BreadcrumbJsonLd items={CRUMBS} baseUrl={SITE.url} />

      <div className="border-b border-border bg-surface">
        <div className="container py-6 sm:py-8">
          <Breadcrumbs items={CRUMBS} />
          <h1 className="heading-1 mt-3 text-balance">{TITLE}</h1>
          <p className="mt-3 max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            A printable specification sheet for every product we sell. Open a sheet to read it,
            print it, or save it as a PDF to share with a dealer, fleet manager or installer.
          </p>
          {groups.length > 0 ? (
            <nav aria-label="Jump to a range" className="mt-5 flex flex-wrap gap-2">
              {groups.map((group) => (
                <a
                  key={group.subcategory}
                  href={`#${group.subcategory}`}
                  className="inline-flex h-8 items-center rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground sm:text-sm"
                >
                  {group.name}
                </a>
              ))}
            </nav>
          ) : null}
        </div>
      </div>

      <div className="container section-tight space-y-10">
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No spec sheets are available right now. Please check back soon.
          </p>
        ) : null}

        {groups.map((group) => (
          <section
            key={group.subcategory}
            id={group.subcategory}
            aria-labelledby={`${group.subcategory}-heading`}
            className="scroll-mt-28"
          >
            <h2 id={`${group.subcategory}-heading`} className="heading-3">
              {group.name}
              <span className="tabular ml-2 text-sm font-normal text-muted-foreground">
                {group.products.length}
              </span>
            </h2>

            <ul className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {group.products.map((product) => {
                const figures = attributePairs(product).slice(0, 3);
                return (
                  <li
                    key={product.id}
                    className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-surface">
                        {product.images[0] ? (
                          <Image
                            src={product.images[0]}
                            alt=""
                            fill
                            sizes="64px"
                            className="object-contain p-1.5"
                          />
                        ) : (
                          <FileText
                            className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={productPath(product.slug)}
                          className="font-display text-sm font-semibold text-foreground hover:text-primary-600 sm:text-base"
                        >
                          {product.title}
                        </Link>
                        {product.model ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Model {product.model}
                          </p>
                        ) : null}
                        {figures.length > 0 ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {figures.map((pair) => `${pair.label}: ${pair.value}`).join(' · ')}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <ButtonLink
                      href={specSheetPath(product.slug)}
                      variant="outline"
                      size="sm"
                      className="shrink-0 self-start sm:self-auto"
                      aria-label={`View spec sheet for ${product.title}`}
                    >
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      View spec sheet
                    </ButtonLink>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
