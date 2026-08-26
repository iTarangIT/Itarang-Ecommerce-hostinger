import { env } from '@/lib/env';

/**
 * The authenticated Hostinger account API — the only module that can write.
 *
 * This is a **different service** from `client.ts`. That one talks to the
 * public sales-channel catalogue (`api-ecommerce.hostinger.com`), needs no
 * credential, and is read-only by construction. This one talks to
 * `developers.hostinger.com`, carries a bearer token, and can mutate the
 * merchant's catalogue.
 *
 * Keeping them apart is the point. `client.ts` has a single `get()` with no
 * verb parameter, so no storefront path can ever be made to write, no matter
 * what a future change does here.
 *
 * **The write is deliberately narrow.** `setVariantInventory` sends exactly
 * `variant_id` and `inventory_quantity` and nothing else. The batch endpoint
 * documents that "prices replace the variant's existing prices in full", so a
 * request that included a `prices` field — even copied faithfully from a read
 * moments earlier — would overwrite the merchant's pricing with whatever we
 * happened to have. There is no code path here that can put a price in a body.
 */

const TIMEOUT_MS = 15_000;

export class HostingerAdminError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly path: string,
    /** True when the outcome is genuinely unknown — a timeout or socket error. */
    readonly indeterminate: boolean,
  ) {
    super(message);
    this.name = 'HostingerAdminError';
  }
}

export interface VariantInventory {
  variantId: string;
  quantity: number;
  managed: boolean;
}

function config(): { base: string; token: string; storeId: string } {
  const { HOSTINGER_ACCOUNT_API_URL, HOSTINGER_API_TOKEN, HOSTINGER_STORE_ID } = env();

  if (!HOSTINGER_API_TOKEN || !HOSTINGER_STORE_ID) {
    throw new HostingerAdminError(
      'Hostinger account API is not configured (need HOSTINGER_API_TOKEN and HOSTINGER_STORE_ID).',
      null,
      '',
      false,
    );
  }

  return {
    base: HOSTINGER_ACCOUNT_API_URL.replace(/\/$/, ''),
    token: HOSTINGER_API_TOKEN,
    storeId: HOSTINGER_STORE_ID,
  };
}

async function request(
  method: 'GET' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<unknown> {
  const { base, token } = config();
  const url = `${base}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch (error) {
    // A timeout or socket failure on a PATCH is the dangerous case: the write
    // may or may not have landed. `indeterminate` is how the caller knows it
    // must verify before ever retrying.
    throw new HostingerAdminError(
      `${method} ${path} failed: ${(error as Error).message}`,
      null,
      path,
      method !== 'GET',
    );
  }

  const text = await response.text();

  if (!response.ok) {
    // A 4xx/5xx is a real answer: the request was received and rejected, so
    // the outcome is known and a retry is safe on its own terms.
    throw new HostingerAdminError(
      `${method} ${path} returned ${response.status}: ${text.slice(0, 300)}`,
      response.status,
      path,
      false,
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HostingerAdminError(
      `${method} ${path} returned unparseable JSON: ${text.slice(0, 200)}`,
      response.status,
      path,
      false,
    );
  }
}

/** Hostinger wraps collections as `{ data: [...] }` in some places and not others. */
function unwrap(body: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    for (const key of ['data', ...keys]) {
      if (Array.isArray(record[key])) return record[key] as unknown[];
    }
  }
  return [];
}

function readVariant(value: unknown): VariantInventory | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const variantId = record.id ?? record.variant_id;
  const quantity = record.inventory_quantity;
  if (typeof variantId !== 'string' || typeof quantity !== 'number') return null;
  return {
    variantId,
    quantity,
    managed: record.manage_inventory !== false,
  };
}

/**
 * Read one product's variants and their stock.
 *
 * Deliberately the *account* API rather than the public catalogue, even though
 * the public one also reports `inventory_quantity`. The verification step
 * compares against what the write endpoint itself will see, and reading
 * through a different service with its own cache would let the two disagree.
 */
export async function readVariantInventory(productId: string): Promise<VariantInventory[]> {
  const { storeId } = config();
  const body = await request(
    'GET',
    `/api/ecommerce/v1/stores/${storeId}/products/${productId}/variants`,
  );
  return unwrap(body, 'variants')
    .map(readVariant)
    .filter((variant): variant is VariantInventory => variant !== null);
}

/**
 * Set one variant's stock to an absolute quantity.
 *
 * Returns the quantity the API reports *after* the write, so the caller can
 * confirm the number it asked for is the number that landed rather than
 * assuming a 200 means agreement.
 *
 * Only two fields are ever sent. See the module header for why a `prices`
 * field must never appear here.
 */
export async function setVariantInventory(
  productId: string,
  variantId: string,
  quantity: number,
): Promise<number | null> {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new HostingerAdminError(
      `Refusing to set a non-integer or negative stock quantity (${quantity}).`,
      null,
      'variants/batch',
      false,
    );
  }

  const { storeId } = config();
  const body = await request(
    'PATCH',
    `/api/ecommerce/v1/stores/${storeId}/products/${productId}/variants/batch`,
    // Exactly these two keys. Nothing else, ever.
    { variants: [{ variant_id: variantId, inventory_quantity: quantity }] },
  );

  const updated = unwrap(body, 'variants')
    .map(readVariant)
    .find((variant) => variant?.variantId === variantId);

  return updated ? updated.quantity : null;
}

/** Whether the push is switched on and fully configured. */
export function inventoryPushEnabled(): boolean {
  const { HOSTINGER_INVENTORY_PUSH, HOSTINGER_API_TOKEN, HOSTINGER_STORE_ID } = env();
  return Boolean(HOSTINGER_INVENTORY_PUSH && HOSTINGER_API_TOKEN && HOSTINGER_STORE_ID);
}
