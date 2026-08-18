import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { productsResponseSchema, settingsResponseSchema, variantsResponseSchema } from '@/lib/commerce/hostinger/schema';
import { inventoryMap, mapProduct } from '@/lib/commerce/hostinger/map';
import { unmappedProductIds } from '@/lib/commerce/hostinger/enrichment';
import { displayPrice, formatPrice } from '@/lib/catalog/pricing';

/**
 * Read-only Hostinger integration diagnostics.
 *
 * Issues the three safe GETs, reports reachability, and shows exactly how the
 * first product maps into our domain types. Works regardless of
 * `COMMERCE_PROVIDER`, so upstream health can be checked without switching the
 * site over.
 *
 * Development only — returns 404 in production so it is never a public probe.
 * Never issues a non-GET request.
 *
 * Note the folder is `diagnostics`, not `_diagnostics`: Next treats
 * underscore-prefixed directories as private and would not route it at all.
 */

export const dynamic = 'force-dynamic';

interface Probe {
  label: string;
  url: string;
  status: number | 'network-error';
  ms: number;
  correlationId?: string;
  error?: string;
}

async function probe(label: string, url: string): Promise<{ probe: Probe; json?: unknown }> {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    const ms = Date.now() - started;
    const correlationId = response.headers.get('x-correlation-id') ?? undefined;

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return {
        probe: {
          label,
          url,
          status: response.status,
          ms,
          correlationId,
          error: body.slice(0, 300),
        },
      };
    }

    return {
      probe: { label, url, status: response.status, ms, correlationId },
      json: await response.json(),
    };
  } catch (cause) {
    return {
      probe: {
        label,
        url,
        status: 'network-error',
        ms: Date.now() - started,
        error: (cause as Error).message,
      },
    };
  }
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 });
  }

  const config = env();

  if (!config.HOSTINGER_SALES_CHANNEL_ID) {
    return NextResponse.json(
      {
        ok: false,
        reason: 'HOSTINGER_SALES_CHANNEL_ID is not set. Copy .env.example to .env.local.',
      },
      { status: 200 },
    );
  }

  const base = `${config.HOSTINGER_ECOMMERCE_API_URL.replace(/\/$/, '')}/store/${config.HOSTINGER_SALES_CHANNEL_ID}`;

  const settings = await probe('settings', `${base}/settings`);
  const products = await probe('products', `${base}/products?limit=100&offset=0`);

  const probes: Probe[] = [settings.probe, products.probe];

  const parsedSettings = settings.json ? settingsResponseSchema.safeParse(settings.json) : null;
  const parsedProducts = products.json ? productsResponseSchema.safeParse(products.json) : null;

  let inventory: Probe | null = null;
  let stockByVariant = new Map<string, number>();

  if (parsedProducts?.success && parsedProducts.data.products.length > 0) {
    const ids = parsedProducts.data.products.map((product) => product.id);
    const params = new URLSearchParams({ fields: 'inventory_quantity' });
    for (const id of ids) params.append('product_ids[]', id);

    const result = await probe('variants', `${base}/variants?${params.toString()}`);
    inventory = result.probe;
    probes.push(result.probe);

    const parsedVariants = result.json ? variantsResponseSchema.safeParse(result.json) : null;
    if (parsedVariants?.success) stockByVariant = inventoryMap(parsedVariants.data.variants);
  }

  const reachable = probes.every((entry) => entry.status === 200);

  // Map the first product so the field-level translation is visible.
  let mapping: Record<string, unknown> | null = null;
  if (parsedProducts?.success && parsedProducts.data.products[0]) {
    const source = parsedProducts.data.products[0];
    const mapped = mapProduct(source, stockByVariant);
    const price = displayPrice(mapped);
    mapping = {
      source: {
        id: source.id,
        title: source.title,
        amount: source.variants[0]?.prices[0]?.amount,
        sale_amount: source.variants[0]?.prices[0]?.sale_amount,
        decimal_digits: source.variants[0]?.prices[0]?.currency.decimal_digits,
        currency: source.variants[0]?.prices[0]?.currency_code,
        images: source.images.length,
        additional_info_blocks: source.additional_info.length,
      },
      mapped: {
        slug: mapped.slug,
        category: `${mapped.category}/${mapped.subcategory}`,
        price: { ...price, formatted: formatPrice(price.selling) },
        variants: mapped.variants.map((variant) => ({
          sku: variant.sku,
          stock: variant.stock,
          availability: variant.availability,
        })),
        images: mapped.images.length,
        specGroups: mapped.specGroups.map((group) => ({
          title: group.title,
          rows: group.specs.length,
        })),
        descriptionParagraphs: mapped.description.length,
      },
    };
  }

  return NextResponse.json({
    ok: reachable,
    checkedAt: new Date().toISOString(),
    config: {
      activeProvider: config.COMMERCE_PROVIDER,
      apiUrl: config.HOSTINGER_ECOMMERCE_API_URL,
      salesChannelId: config.HOSTINGER_SALES_CHANNEL_ID,
      revalidateSeconds: config.HOSTINGER_CATALOG_REVALIDATE,
      authentication: 'none — public sales channel API',
    },
    probes,
    store: parsedSettings?.success
      ? {
          language: parsedSettings.data.store_owner?.language,
          stripeCheckout: parsedSettings.data.stripe_checkout?.is_available,
          productReviews: parsedSettings.data.product_reviews?.is_enabled,
        }
      : null,
    catalogue: parsedProducts?.success
      ? {
          count: parsedProducts.data.count ?? parsedProducts.data.products.length,
          returned: parsedProducts.data.products.length,
          unmappedProducts: unmappedProductIds(parsedProducts.data.products.map((p) => p.id)),
          variantsWithStock: stockByVariant.size,
        }
      : null,
    schemaErrors: {
      settings: parsedSettings && !parsedSettings.success ? parsedSettings.error.issues.slice(0, 5) : null,
      products: parsedProducts && !parsedProducts.success ? parsedProducts.error.issues.slice(0, 5) : null,
    },
    mapping,
    inventoryProbe: inventory,
  });
}
