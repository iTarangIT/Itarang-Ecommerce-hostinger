import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { catalog } from '@/lib/commerce';
import { allProducts } from '@/lib/catalog/collections';
import { subcategoryName } from '@/lib/catalog/category-names';
import {
  DOWNLOADS_PATH,
  specSheetPath,
  warrantyLine,
} from '@/lib/downloads/spec-sheets';
import { productPath } from '@/lib/routes';
import { SITE } from '@/lib/site';
import { attributePairs } from '@/components/product/key-attributes';
import { ManufacturerDetail } from '@/components/product/manufacturer-info';
import { SellerDetail } from '@/components/product/seller-info';
import { BreadcrumbJsonLd, Breadcrumbs } from '@/components/ui/breadcrumbs';
import { PrintButton } from './print-button';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const products = await allProducts();
  return products.map((product) => ({ slug: product.slug }));
}

/**
 * Same reasoning as the product page: a product published after the build is
 * rendered on demand, and an unknown or unpublished slug reaches `notFound()`
 * because the catalogue serves only published products.
 */
export const dynamicParams = true;

/** Purged by `revalidateTag(CATALOG_TAG)` on admin writes, never on a timer. */
export const revalidate = false;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const product = await catalog().getProduct((await params).slug);
  if (!product) return { title: 'Spec sheet not found' };
  const title = `${product.title} — spec sheet`;
  const description = `Printable specification sheet for ${product.title}: ${product.subtitle}.`;
  return {
    title,
    description,
    alternates: { canonical: specSheetPath(product.slug) },
    openGraph: {
      title: `${title} | ${SITE.name}`,
      description,
      url: specSheetPath(product.slug),
      ...(product.images[0] ? { images: [{ url: product.images[0] }] } : {}),
    },
  };
}

/** A two-column label/value table that prints without splitting rows. */
function SpecTable({ title, rows }: { title: string; rows: Array<{ label: string; value: string }> }) {
  if (rows.length === 0) return null;
  return (
    <section className="break-inside-avoid">
      <h2 className="border-b-2 border-accent pb-1.5 font-display text-xs font-bold uppercase tracking-wide text-accent-600 print:border-black print:text-black">
        {title}
      </h2>
      <table className="w-full border-collapse text-sm print:text-[10pt]">
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.label}-${index}`} className="break-inside-avoid border-b border-border">
              <th
                scope="row"
                className="w-2/5 py-2 pr-4 text-left align-top font-medium text-muted-foreground print:py-1 print:text-black/70"
              >
                {row.label}
              </th>
              <td className="py-2 align-top text-foreground print:py-1 print:text-black">
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default async function SpecSheetPage({ params }: PageProps) {
  const product = await catalog().getProduct((await params).slug);
  if (!product) notFound();

  const keyFigures = attributePairs(product);
  const warranty = warrantyLine(product);
  const productUrl = `${SITE.url}${productPath(product.slug)}`;

  const identity = [
    product.brand ? { label: 'Brand', value: product.brand } : null,
    product.model ? { label: 'Model', value: product.model } : null,
    product.genericName ? { label: 'Generic name', value: product.genericName } : null,
    product.productType ? { label: 'Product type', value: product.productType } : null,
    product.netQuantity ? { label: 'Net quantity', value: product.netQuantity } : null,
    product.hsnCode ? { label: 'HSN code', value: product.hsnCode } : null,
    product.manufacturer?.countryOfOrigin
      ? { label: 'Country of origin', value: product.manufacturer.countryOfOrigin }
      : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  const crumbs = [
    { label: 'Home', href: '/' },
    { label: 'Brochures & spec sheets', href: DOWNLOADS_PATH },
    { label: product.title, href: specSheetPath(product.slug) },
  ];

  return (
    <>
      <BreadcrumbJsonLd items={crumbs} baseUrl={SITE.url} />
      {/* Page box for the printed sheet. Scoped to this route because it is
          only rendered here. */}
      <style>{'@page { size: A4; margin: 12mm; }'}</style>

      <div className="border-b border-border bg-surface print:hidden">
        <div className="container flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Breadcrumbs items={crumbs} />
            <Link
              href={DOWNLOADS_PATH}
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              All spec sheets
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={productPath(product.slug)}
              className="text-sm font-medium text-primary hover:underline"
            >
              View product
            </Link>
            <PrintButton />
          </div>
        </div>
      </div>

      <div className="container py-6 sm:py-8 print:max-w-none print:p-0">
        <article className="mx-auto max-w-4xl rounded-lg border border-border bg-card p-5 shadow-card sm:p-8 print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0 print:text-black print:shadow-none">
          {/* ---------------------------------------------------- header */}
          <header className="flex items-start justify-between gap-4 border-b border-border pb-4 print:border-black/30">
            <div className="min-w-0">
              <p className="eyebrow print:text-black">
                {subcategoryName(product.subcategory)} · Specification sheet
              </p>
              <h1 className="mt-1.5 font-display text-2xl font-extrabold leading-tight text-foreground sm:text-3xl print:text-[18pt] print:text-black">
                {product.title}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground print:text-black/75">
                {product.subtitle}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-sm font-bold text-foreground print:text-black">
                {SITE.name}
              </p>
              <p className="text-xs text-muted-foreground print:text-black/70">
                {SITE.url.replace(/^https?:\/\//, '')}
              </p>
            </div>
          </header>

          {/* ---------------------------------------- image and summary */}
          <div className="mt-6 grid gap-6 sm:grid-cols-5 print:grid-cols-5 print:gap-5">
            {product.images[0] ? (
              <div className="relative aspect-square overflow-hidden rounded-md border border-border bg-white sm:col-span-2 print:col-span-2 print:border-black/20">
                <Image
                  src={product.images[0]}
                  alt={product.title}
                  fill
                  priority
                  sizes="(max-width: 640px) 100vw, 320px"
                  className="object-contain p-4"
                />
              </div>
            ) : null}

            <div
              className={
                product.images[0]
                  ? 'space-y-5 sm:col-span-3 print:col-span-3'
                  : 'space-y-5 sm:col-span-5 print:col-span-5'
              }
            >
              {keyFigures.length > 0 ? (
                <dl className="grid grid-cols-2 gap-2">
                  {keyFigures.map((pair) => (
                    <div
                      key={pair.label}
                      className="rounded-md border border-border bg-surface px-3 py-2 print:border-black/20 print:bg-white"
                    >
                      <dt className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground print:text-black/70">
                        {pair.label}
                      </dt>
                      <dd className="mt-0.5 text-sm font-semibold text-foreground print:text-black">
                        {pair.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {product.highlights.length > 0 ? (
                <section>
                  <h2 className="font-display text-xs font-bold uppercase tracking-wide text-accent-600 print:text-black">
                    Highlights
                  </h2>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/85 marker:text-accent-600 print:text-[10pt] print:text-black print:marker:text-black">
                    {product.highlights.map((highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          </div>

          {/* ------------------------------------------- specifications */}
          <div className="mt-8 grid gap-6 print:mt-6 print:gap-4">
            <SpecTable title="Product identity" rows={identity} />
            {product.specGroups.map((group) => (
              <SpecTable key={group.title} title={group.title} rows={group.specs} />
            ))}
            {product.boxContents.length > 0 ? (
              <SpecTable
                title="In the box"
                rows={product.boxContents.map((item, index) => ({
                  label: `Item ${index + 1}`,
                  value: item,
                }))}
              />
            ) : null}
            {product.careInstructions?.length ? (
              <section className="break-inside-avoid">
                <h2 className="border-b-2 border-accent pb-1.5 font-display text-xs font-bold uppercase tracking-wide text-accent-600 print:border-black print:text-black">
                  Care instructions
                </h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/85 print:text-[10pt] print:text-black">
                  {product.careInstructions.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          {/* ------------------------------------------------- warranty */}
          {warranty ? (
            <section className="mt-8 break-inside-avoid rounded-md border border-accent/30 bg-accent-50 p-4 print:mt-6 print:border-black/30 print:bg-white">
              <h2 className="font-display text-xs font-bold uppercase tracking-wide text-accent-600 print:text-black">
                Warranty
              </h2>
              <p className="mt-1 text-sm text-foreground print:text-[10pt] print:text-black">
                {warranty}. Keep your invoice and the serial number on the unit; the written terms
                ship with the product.
              </p>
            </section>
          ) : null}

          {/* ------------------------------------ manufacturer and seller */}
          {product.manufacturer || product.seller ? (
            <div className="mt-8 grid gap-6 break-inside-avoid sm:grid-cols-2 print:mt-6 print:grid-cols-2 print:text-black">
              {product.manufacturer ? (
                <section>
                  <h2 className="border-b-2 border-accent pb-1.5 font-display text-xs font-bold uppercase tracking-wide text-accent-600 print:border-black print:text-black">
                    Manufacturer
                  </h2>
                  <div className="mt-3">
                    <ManufacturerDetail manufacturer={product.manufacturer} />
                  </div>
                </section>
              ) : null}
              {product.seller ? (
                <section>
                  <h2 className="border-b-2 border-accent pb-1.5 font-display text-xs font-bold uppercase tracking-wide text-accent-600 print:border-black print:text-black">
                    Seller &amp; marketer
                  </h2>
                  <div className="mt-3">
                    <SellerDetail seller={product.seller} />
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          {/* --------------------------------------------------- footer */}
          <footer className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground print:mt-6 print:border-black/30 print:text-black/70">
            <p>
              Specifications are as listed in the {SITE.name} catalogue and may be revised. For
              current details and pricing see{' '}
              <a href={productUrl} className="font-medium text-primary hover:underline print:text-black">
                {productUrl.replace(/^https?:\/\//, '')}
              </a>
              .
            </p>
            <p className="mt-1">
              {SITE.email} · {SITE.phone}
            </p>
          </footer>
        </article>
      </div>
    </>
  );
}
