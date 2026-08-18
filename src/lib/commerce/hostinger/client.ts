import type { z } from 'zod';
import { env } from '@/lib/env';
import {
  productsResponseSchema,
  settingsResponseSchema,
  variantsResponseSchema,
  type HostingerProductsResponse,
  type HostingerSettings,
  type HostingerVariantsResponse,
} from './schema';

/**
 * Hostinger Sales Channel API client.
 *
 * READ-ONLY BY CONSTRUCTION. There is exactly one request function and it takes
 * no HTTP verb, so a mutating call — including the one mutating endpoint the
 * public API exposes, `POST /store/{channel}/checkout` — cannot be written
 * through this module. Adding write support must be a deliberate, reviewable
 * change to this file, not an accident at a call site.
 *
 * The API takes no authentication: the sales channel id in the path is the
 * only identifier, and it already ships publicly in the storefront bundle.
 */

const TIMEOUT_MS = 8_000;

export class HostingerApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    /** Hostinger returns this on every response; support will ask for it. */
    readonly correlationId?: string,
    readonly body?: string,
  ) {
    super(message);
    this.name = 'HostingerApiError';
  }
}

function baseUrl(): string {
  const { HOSTINGER_ECOMMERCE_API_URL, HOSTINGER_SALES_CHANNEL_ID } = env();
  if (!HOSTINGER_SALES_CHANNEL_ID) {
    throw new Error('HOSTINGER_SALES_CHANNEL_ID is not configured.');
  }
  return `${HOSTINGER_ECOMMERCE_API_URL.replace(/\/$/, '')}/store/${HOSTINGER_SALES_CHANNEL_ID}`;
}

// The third generic is `unknown` on purpose: schemas using `.default()` have a
// different input type from their output, and we always parse untrusted JSON.
async function get<T>(
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  params?: URLSearchParams,
): Promise<T> {
  const query = params?.toString();
  const url = `${baseUrl()}${path}${query ? `?${query}` : ''}`;

  let response: Response;
  try {
    response = await fetch(url, {
      // No `method` — GET is the only verb this client can issue.
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: env().HOSTINGER_CATALOG_REVALIDATE, tags: ['catalog'] },
    });
  } catch (cause) {
    // Network-level failure only. A 4xx/5xx is a real answer and is never retried.
    throw new HostingerApiError(
      `Could not reach the Hostinger catalogue: ${(cause as Error).message}`,
      0,
      path,
    );
  }

  const correlationId = response.headers.get('x-correlation-id') ?? undefined;

  if (!response.ok) {
    const body = await response.text().catch(() => undefined);
    throw new HostingerApiError(
      `Hostinger catalogue returned ${response.status} for ${path}`,
      response.status,
      path,
      correlationId,
      body?.slice(0, 500),
    );
  }

  const json: unknown = await response.json();
  const parsed = schema.safeParse(json);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new HostingerApiError(
      `Unexpected payload shape from ${path} — ${issues}`,
      response.status,
      path,
      correlationId,
    );
  }

  return parsed.data;
}

/** `GET /store/{channel}/products` — the whole catalogue in one page. */
export function fetchProducts(limit = 100, offset = 0): Promise<HostingerProductsResponse> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return get('/products', productsResponseSchema, params);
}

/** `GET /store/{channel}/variants?fields=inventory_quantity` — live stock. */
export function fetchInventory(productIds: string[]): Promise<HostingerVariantsResponse> {
  if (productIds.length === 0) return Promise.resolve({ variants: [] });
  const params = new URLSearchParams({ fields: 'inventory_quantity' });
  for (const id of productIds) params.append('product_ids[]', id);
  return get('/variants', variantsResponseSchema, params);
}

/** `GET /store/{channel}/settings` — currency and store feature flags. */
export function fetchSettings(): Promise<HostingerSettings> {
  return get('/settings', settingsResponseSchema);
}

/** Endpoint URLs, for the diagnostics route to report on without duplicating logic. */
export function describeEndpoints(): Array<{ label: string; url: string }> {
  const base = baseUrl();
  return [
    { label: 'settings', url: `${base}/settings` },
    { label: 'products', url: `${base}/products?limit=100&offset=0` },
    { label: 'variants', url: `${base}/variants?fields=inventory_quantity` },
  ];
}
