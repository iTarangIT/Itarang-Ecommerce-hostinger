import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Package, Plus } from 'lucide-react';
import { productRepository } from '@/lib/products/postgres-repository';
import { PRODUCT_STATUSES, type ProductStatus } from '@/lib/products/types';
import type { CategorySlug } from '@/lib/commerce/types';
import { formatPrice } from '@/lib/catalog/pricing';
import { formatDate } from '@/lib/utils';
import { ButtonLink } from '@/components/ui/button';
import { StateBlock } from '@/components/ui/states';
import { ProductStatusPill } from '@/components/admin/product-status-pill';
import { ProductFilters, ProductPagination } from '@/components/admin/product-filters';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Products',
  robots: { index: false, follow: false },
};

/** Rows per page. The same figure the order console uses, for the same reason. */
const PAGE_SIZE = 25;

/** Only values the column's CHECK constraint allows reach the query. */
function asStatus(value: string | undefined): ProductStatus | undefined {
  return PRODUCT_STATUSES.find((status) => status === value);
}

function asCategory(value: string | undefined): CategorySlug | undefined {
  const allowed: CategorySlug[] = ['inverters', 'batteries', 'ups', 'combos'];
  return allowed.find((category) => category === value);
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    category?: string;
    offset?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const search = params.q?.trim() || undefined;
  const status = asStatus(params.status);
  const category = asCategory(params.category);

  // Clamped, not trusted: a hand-edited offset must not become a negative
  // OFFSET or an unbounded scan.
  const parsedOffset = Number.parseInt(params.offset ?? '0', 10);
  const offset = Number.isFinite(parsedOffset) ? Math.max(0, parsedOffset) : 0;

  const { items, total } = await productRepository().listForAdmin({
    search,
    status,
    category,
    limit: PAGE_SIZE,
    offset,
  });

  const filtered = Boolean(search || status || category);

  return (
    <div className="container py-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Orders
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="heading-2">Products</h1>
          <p className="tabular mt-1 text-sm text-muted-foreground">
            {total} product{total === 1 ? '' : 's'}
            {filtered ? ' matching these filters' : ''}
          </p>
        </div>
        <ButtonLink href="/admin/products/new" size="sm">
          <Plus className="h-4 w-4" />
          New product
        </ButtonLink>
      </div>

      {params.error ? (
        <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm font-medium text-destructive">
          {params.error}
        </p>
      ) : null}

      <ProductFilters current={{ q: search, status: params.status, category: params.category }} />

      {items.length === 0 ? (
        <StateBlock
          className="mt-8"
          icon={<Package className="h-6 w-6" />}
          title={filtered ? 'No products match these filters' : 'No products yet'}
          description={
            filtered
              ? 'Try the model number, the title or the slug, or clear the filters.'
              : 'Create the first product and it will appear here as a draft.'
          }
        />
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[54rem] border-collapse text-sm">
            <thead>
              <tr className="bg-surface text-left">
                <th scope="col" className="px-4 py-3 font-display font-semibold">
                  Product
                </th>
                <th scope="col" className="px-4 py-3 font-display font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-display font-semibold">
                  Category
                </th>
                <th scope="col" className="px-4 py-3 text-right font-display font-semibold">
                  Quantity
                </th>
                <th scope="col" className="px-4 py-3 text-right font-display font-semibold">
                  From
                </th>
                <th scope="col" className="px-4 py-3 text-right font-display font-semibold">
                  Images
                </th>
                <th scope="col" className="px-4 py-3 font-display font-semibold">
                  Last edited
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((product) => (
                <tr key={product.id} className="border-t border-border hover:bg-surface/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/products/${product.productKey}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {product.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[product.brand, product.modelName].filter(Boolean).join(' · ') ||
                        product.slug}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <ProductStatusPill status={product.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{product.subcategory}</td>
                  <td className="tabular px-4 py-3 text-right">
                    {/* Units in stock on the primary variant, straight from the
                        database. Three states, and they are not the same thing:
                        a dash means stock is not tracked, 0 means the product is
                        off sale, and a number is a count. Showing 0 for
                        "untracked" is what would send someone hunting for a
                        sold-out product that was never counted. */}
                    {product.primaryStock === null ? (
                      <span className="text-muted-foreground" title="Stock is not tracked">
                        —
                      </span>
                    ) : product.primaryStock === 0 ? (
                      <span className="font-semibold text-destructive">0</span>
                    ) : product.primaryStock <= 5 ? (
                      <span className="font-medium text-warning">{product.primaryStock}</span>
                    ) : (
                      product.primaryStock
                    )}
                    {product.variantCount > 1 ? (
                      <span
                        className="ml-1 text-xs text-muted-foreground"
                        title={`Primary of ${product.variantCount} variants`}
                      >
                        ·{product.variantCount}
                      </span>
                    ) : null}
                  </td>
                  <td className="tabular px-4 py-3 text-right">
                    {/* A dash, not a zero: a product with no price yet has not
                        been priced at nothing. */}
                    {product.fromPrice === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      formatPrice(product.fromPrice)
                    )}
                  </td>
                  <td className="tabular px-4 py-3 text-right">
                    {product.mediaCount === 0 ? (
                      <span className="font-medium text-warning">0</span>
                    ) : (
                      product.mediaCount
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(product.updatedAt)}
                    {product.updatedBy ? <br /> : null}
                    {product.updatedBy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProductPagination
        total={total}
        offset={offset}
        pageSize={PAGE_SIZE}
        current={{ q: search, status: params.status, category: params.category }}
      />
    </div>
  );
}
