import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { productRepository } from '@/lib/products/postgres-repository';
import { publishBlockers } from '@/lib/products/state-machine';
import { setProductStatusAction } from '@/lib/admin/product-actions';
import { Button } from '@/components/ui/button';
import { ProductStatusPill } from '@/components/admin/product-status-pill';
import { ProductMediaPanel } from '@/components/admin/product-media-panel';
import {
  ContentPanel,
  FacetsPanel,
  FaqPanel,
  InformationPanel,
  PartiesPanel,
  PricingPanel,
  SeoPanel,
  SectionsPanel,
  SpecsPanel,
  WarrantyPanel,
} from '@/components/admin/product-panels';
import { productPath } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Edit product',
  robots: { index: false, follow: false },
};

/**
 * The product editor.
 *
 * One page, one panel at a time, selected by `?tab=`. Server-rendered links
 * rather than client-side tabs: each panel is its own `<form>` posting its own
 * Server Action, so a tab change is a navigation and a save is a POST, and
 * neither needs a line of client JavaScript.
 *
 * That also means each panel saves independently. A patch carries only the
 * fields its own form submitted (`UpdateProductInput` treats `undefined` as
 * "leave alone"), so editing the warranty cannot silently revert somebody
 * else's edit to the specifications.
 */

const TABS = [
  { id: 'information', label: 'Information' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'media', label: 'Media' },
  { id: 'content', label: 'Highlights & description' },
  { id: 'specs', label: 'Specifications' },
  { id: 'sections', label: 'Page sections' },
  { id: 'facets', label: 'Comparison values' },
  { id: 'warranty', label: 'Warranty & returns' },
  { id: 'parties', label: 'Manufacturer & seller' },
  { id: 'faq', label: 'FAQ' },
  { id: 'seo', label: 'SEO & URL' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function asTab(value: string | undefined): TabId {
  return TABS.find((tab) => tab.id === value)?.id ?? 'information';
}

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ productKey: string }>;
  searchParams: Promise<{ tab?: string; error?: string; saved?: string }>;
}) {
  const { productKey } = await params;
  const search = await searchParams;
  const tab = asTab(search.tab);

  const repository = productRepository();
  const product = await repository.findByKey(decodeURIComponent(productKey));
  if (!product) notFound();

  // Only the parties panel needs these, and only to fill two dropdowns.
  const [manufacturers, sellers] =
    tab === 'parties'
      ? await Promise.all([repository.listManufacturers(), repository.listSellers()])
      : [[], []];

  const blockers = publishBlockers(product);

  return (
    <div className="container py-8">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Products
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="heading-2">{product.title}</h1>
            <ProductStatusPill status={product.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[product.brand, product.modelName, product.productKey].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {product.status === 'published' ? (
            <Link
              href={productPath(product.slug)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <ExternalLink className="h-4 w-4" />
              View page
            </Link>
          ) : null}

          {/* One form per action rather than a select: each is a distinct
              decision, and a dropdown plus Apply hides which one is about to
              happen behind an extra click. */}
          {product.status !== 'published' ? (
            <form action={setProductStatusAction}>
              <input type="hidden" name="productKey" value={product.productKey} />
              <input type="hidden" name="status" value="published" />
              <Button type="submit" size="sm" disabled={blockers.length > 0}>
                Publish
              </Button>
            </form>
          ) : (
            <form action={setProductStatusAction}>
              <input type="hidden" name="productKey" value={product.productKey} />
              <input type="hidden" name="status" value="draft" />
              <Button type="submit" size="sm" variant="outline">
                Unpublish
              </Button>
            </form>
          )}

          {product.status !== 'archived' ? (
            <form action={setProductStatusAction}>
              <input type="hidden" name="productKey" value={product.productKey} />
              <input type="hidden" name="status" value="archived" />
              <Button type="submit" size="sm" variant="ghost">
                Archive
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      {search.error ? (
        <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm font-medium text-destructive">
          {search.error}
        </p>
      ) : null}

      {search.saved ? (
        <p className="mt-4 rounded-lg border border-success/40 bg-success-soft p-3 text-sm font-medium text-success">
          Saved.
        </p>
      ) : null}

      {/* Stated whether or not Publish was pressed: an editor should know what
          is left before they go looking for the button. */}
      {blockers.length > 0 && product.status !== 'published' ? (
        <p className="mt-4 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-foreground">
          <span className="font-semibold text-warning">Not ready to publish.</span> Still missing:{' '}
          {blockers.join(', ')}.
        </p>
      ) : null}

      <nav aria-label="Product sections" className="mt-6 flex flex-wrap gap-1.5">
        {TABS.map((entry) => (
          <Link
            key={entry.id}
            href={`/admin/products/${encodeURIComponent(product.productKey)}?tab=${entry.id}`}
            aria-current={entry.id === tab ? 'page' : undefined}
            className={
              entry.id === tab
                ? 'rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground'
                : 'rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground'
            }
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6 rounded-lg border border-border bg-card p-5 lg:p-6">
        {tab === 'information' ? <InformationPanel product={product} /> : null}
        {tab === 'pricing' ? <PricingPanel product={product} /> : null}
        {tab === 'media' ? <ProductMediaPanel product={product} /> : null}
        {tab === 'content' ? <ContentPanel product={product} /> : null}
        {tab === 'specs' ? <SpecsPanel product={product} /> : null}
        {tab === 'sections' ? <SectionsPanel product={product} /> : null}
        {tab === 'facets' ? <FacetsPanel product={product} /> : null}
        {tab === 'warranty' ? <WarrantyPanel product={product} /> : null}
        {tab === 'parties' ? (
          <PartiesPanel product={product} manufacturers={manufacturers} sellers={sellers} />
        ) : null}
        {tab === 'faq' ? <FaqPanel product={product} /> : null}
        {tab === 'seo' ? <SeoPanel product={product} /> : null}
      </div>
    </div>
  );
}
