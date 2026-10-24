import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, ExternalLink } from 'lucide-react';
import { productRepository } from '@/lib/products/postgres-repository';
import { loadCategoryOptions } from '@/lib/catalog/category-store';
import type { ProductRecord } from '@/lib/products/types';
import { cn } from '@/lib/utils';
import { publishBlockers } from '@/lib/products/state-machine';
import { setProductStatusAction } from '@/lib/admin/product-actions';
import { Button } from '@/components/ui/button';
import { ProductStatusPill } from '@/components/admin/product-status-pill';
import { ProductMediaPanel } from '@/components/admin/product-media-panel';
import { InterestedCustomers } from '@/components/admin/interested-customers';
import { stockNotificationSettingsOf } from '@/lib/stock/settings';
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

/**
 * Numbered in the order a listing is normally filled in — the same sequence
 * marketplace seller consoles use: identity, offer, images, description,
 * details, then the optional extras. The first four are what publishing needs.
 */
const TABS = [
  { id: 'information', label: 'Basic info', required: true },
  { id: 'pricing', label: 'Price & stock', required: true },
  { id: 'media', label: 'Images', required: true },
  { id: 'content', label: 'Description', required: true },
  { id: 'specs', label: 'Specifications', required: false },
  { id: 'facets', label: 'Filters & badges', required: false },
  { id: 'warranty', label: 'Warranty & returns', required: false },
  { id: 'parties', label: 'Manufacturer & seller', required: false },
  { id: 'faq', label: 'FAQ', required: false },
  { id: 'sections', label: 'More page sections', required: false },
  { id: 'seo', label: 'SEO & URL', required: false },
] as const;

type TabId = (typeof TABS)[number]['id'];

function asTab(value: string | undefined): TabId {
  return TABS.find((tab) => tab.id === value)?.id ?? 'information';
}

/**
 * Whether a step has been filled in, for the tick on its tab.
 *
 * A guide, not a gate — `publishBlockers` is still the only thing that decides
 * whether Publish is allowed. These ask a little more than the blockers do
 * (a subtitle, an HSN code) because a listing without them is publishable but
 * visibly unfinished.
 */
function isStepComplete(id: TabId, product: ProductRecord): boolean {
  switch (id) {
    case 'information':
      return Boolean(product.title.trim() && product.subtitle.trim() && product.brand);
    case 'pricing':
      return (
        product.variants.length > 0 &&
        product.variants.every((variant) => variant.mrp !== null && variant.selling !== null) &&
        Boolean(product.hsnCode) &&
        product.taxRate !== null
      );
    case 'media':
      return product.media.length > 0;
    case 'content':
      return product.description.length > 0 && product.highlights.length > 0;
    case 'specs':
      return product.specGroups.length > 0;
    case 'facets':
      return Object.values(product.facets).some((value) => value !== undefined && value !== '');
    case 'warranty':
      return Boolean(product.warrantyText);
    case 'parties':
      return Boolean(product.manufacturer && product.seller);
    case 'faq':
      return product.faqs.length > 0;
    case 'sections':
      return product.sections.length > 0;
    case 'seo':
      return Boolean(product.seoTitle || product.seoDescription);
  }
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

  const categories = tab === 'information' ? await loadCategoryOptions() : [];

  // Only the parties panel needs these, and only to fill two dropdowns.
  const [manufacturers, sellers] =
    tab === 'parties'
      ? await Promise.all([repository.listManufacturers(), repository.listSellers()])
      : [[], []];

  // Only the pricing panel shows the notification controls, so the setting is
  // read only when that tab is open.
  const stockNotificationsEnabled =
    tab === 'pricing' ? (await stockNotificationSettingsOf()).enabled : false;

  const blockers = publishBlockers(product);

  const tabHref = (id: TabId) =>
    `/admin/products/${encodeURIComponent(product.productKey)}?tab=${id}`;
  const tabIndex = TABS.findIndex((entry) => entry.id === tab);
  const previousTab = TABS[tabIndex - 1];
  const nextTab = TABS[tabIndex + 1];

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

      <p className="mt-6 text-xs text-muted-foreground">
        Work through the steps in order. Steps 1–4 are required to publish; the rest make the
        page more complete. A <Check className="inline h-3 w-3 text-success" /> means the step is
        filled in.
      </p>

      <nav aria-label="Product sections" className="mt-2 flex flex-wrap gap-1.5">
        {TABS.map((entry, index) => {
          const active = entry.id === tab;
          const complete = isStepComplete(entry.id, product);
          return (
            <Link
              key={entry.id}
              href={tabHref(entry.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-primary font-medium text-primary-foreground'
                  : 'border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                  complete
                    ? 'bg-success text-white'
                    : active
                      ? 'bg-primary-foreground/20'
                      : 'bg-secondary text-foreground',
                )}
              >
                {complete ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              {entry.label}
              {entry.required && !complete ? (
                <span
                  className={cn('text-xs', active ? 'text-primary-foreground' : 'text-destructive')}
                  aria-label="required"
                >
                  *
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 rounded-lg border border-border bg-card p-5 lg:p-6">
        {tab === 'information' ? <InformationPanel product={product} categories={categories} /> : null}
        {tab === 'pricing' ? (
          <>
            <PricingPanel product={product} />

            {/* Who is waiting for this product, on the tab that holds the
                stock field — so an administrator putting units back sees the
                list in the same place, rather than having to remember the
                out-of-stock page exists. Available for every product, not only
                sold-out ones: interest is recorded whenever somebody asks. */}
            <div className="mt-6 border-t border-border pt-5">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
                Stock notifications
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Customers who asked to be told when this product returns, plus those who saved it
                or added it to a cart. Sending is always manual.
              </p>
              <InterestedCustomers
                productKey={product.productKey}
                notificationsEnabled={stockNotificationsEnabled}
              />
            </div>
          </>
        ) : null}
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

      {/* Save first, then move on — a step's own Save button is what stores it,
          so these are plain links and never submit anything. */}
      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        {previousTab ? (
          <Link
            href={tabHref(previousTab.id)}
            className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {previousTab.label}
          </Link>
        ) : (
          <span />
        )}
        {nextTab ? (
          <Link
            href={tabHref(nextTab.id)}
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            Next: {nextTab.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
