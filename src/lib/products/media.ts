import { env } from '@/lib/env';

/**
 * Product images, in Supabase Storage.
 *
 * Shaped after `commerce/hostinger/admin-client.ts` rather than pulling in
 * `@supabase/supabase-js`: this needs three verbs against three URLs, and the
 * SDK would be a dependency, a second auth story and a second error taxonomy
 * for that. The house style here is a small typed fetch wrapper, so this is one.
 *
 * Two rules the rest of the codebase depends on:
 *
 * 1. **Only the object key is ever persisted.** `product_media.storage_path`
 *    holds `products/<key>/<n>-<role>.jpg` and nothing else. The browsable URL
 *    is derived on read by `publicUrl()`. Storing a full URL would bake the
 *    project host into every row, and moving project or bucket would then mean
 *    rewriting the table instead of changing one variable.
 *
 * 2. **The service-role key never leaves the server.** It bypasses row-level
 *    security on every table in the project, not just this bucket, so it is
 *    demanded at the point of writing rather than at boot — a storefront that
 *    only reads must be able to run without it ever being present.
 */

const TIMEOUT_MS = 20_000;

/** Deliberately not `unknown`: this client may read and write objects, nothing else. */
type Verb = 'GET' | 'POST' | 'PUT' | 'DELETE';

export class ProductMediaError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = 'ProductMediaError';
    this.status = status;
    this.path = path;
  }
}

/** Whether an upload could even be attempted. Reads do not need this. */
export function mediaUploadsEnabled(): boolean {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function storageBase(): { url: string; bucket: string } {
  const { SUPABASE_URL, SUPABASE_STORAGE_BUCKET } = env();
  if (!SUPABASE_URL) {
    throw new ProductMediaError('SUPABASE_URL is not configured.', 0, '');
  }
  return { url: SUPABASE_URL.replace(/\/+$/, ''), bucket: SUPABASE_STORAGE_BUCKET };
}

/**
 * The URL a browser fetches for a stored object.
 *
 * Public rather than signed, on purpose. Product photography is public
 * catalogue content; signing it would add an expiry to something that must be
 * cacheable by `next/image` and by every CDN in front of it, and would buy no
 * confidentiality because the same image is on the product page anyway.
 */
export function publicUrl(storagePath: string): string {
  const { url, bucket } = storageBase();
  const key = storagePath.replace(/^\/+/, '');
  return `${url}/storage/v1/object/public/${bucket}/${key}`;
}

/** The hostname `next.config.mjs` and the CSP have to allow. Derived, not duplicated. */
export function storageHostname(): string | null {
  const { SUPABASE_URL } = env();
  if (!SUPABASE_URL) return null;
  try {
    return new URL(SUPABASE_URL).hostname;
  } catch {
    return null;
  }
}

async function request(verb: Verb, path: string, init: RequestInit = {}): Promise<Response> {
  const { url } = storageBase();
  const { SUPABASE_SERVICE_ROLE_KEY } = env();

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new ProductMediaError(
      'SUPABASE_SERVICE_ROLE_KEY is not configured; product media cannot be written.',
      0,
      path,
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${url}${path}`, {
      ...init,
      method: verb,
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        ...init.headers,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (!response.ok) {
      // The body carries Supabase's own message; it is far more useful than the
      // status alone and contains no credential.
      const body = await response.text().catch(() => '');
      throw new ProductMediaError(
        `Storage ${verb} ${path} failed with ${response.status}. ${body.slice(0, 400)}`,
        response.status,
        path,
      );
    }

    return response;
  } catch (error) {
    if (error instanceof ProductMediaError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ProductMediaError(`Storage ${verb} ${path} timed out.`, 0, path);
    }
    throw new ProductMediaError(
      `Storage ${verb} ${path} failed: ${error instanceof Error ? error.message : String(error)}`,
      0,
      path,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Put an object at `storagePath`, replacing whatever is there.
 *
 * `x-upsert: true` is what makes replacing an image a one-step operation and
 * makes the media import idempotent — a second run overwrites the same key
 * instead of erroring or minting a duplicate.
 */
export async function uploadObject(
  storagePath: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const { bucket } = storageBase();
  const key = storagePath.replace(/^\/+/, '');

  await request('POST', `/storage/v1/object/${bucket}/${key}`, {
    body: body instanceof Uint8Array ? new Uint8Array(body) : new Uint8Array(body),
    headers: {
      'Content-Type': contentType,
      'x-upsert': 'true',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

/**
 * Remove an object.
 *
 * Only ever called alongside deleting the row that names it. An orphaned object
 * costs storage; an orphaned row renders a broken image, which is worse — so
 * the row goes first and this is best-effort after it.
 */
export async function deleteObject(storagePath: string): Promise<void> {
  const { bucket } = storageBase();
  const key = storagePath.replace(/^\/+/, '');
  await request('DELETE', `/storage/v1/object/${bucket}/${key}`);
}

/* -------------------------------------------------------------- key minting */

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export const ALLOWED_MEDIA_TYPES = Object.keys(EXTENSIONS);
/** 8 MB. Larger than any catalogue image needs to be, small enough to refuse a mistake. */
export const MAX_MEDIA_BYTES = 8 * 1024 * 1024;

export function extensionFor(mime: string): string | null {
  return EXTENSIONS[mime] ?? null;
}

/**
 * Where an image for a product lives.
 *
 * Keyed by `product_key` rather than the numeric id so the bucket stays
 * readable, and suffixed with a random token so replacing an image produces a
 * *new* URL. Reusing the key would leave every CDN and browser serving the old
 * bytes from the immutable cache header above.
 */
export function mediaStoragePath(productKey: string, role: string, mime: string): string {
  const extension = extensionFor(mime) ?? 'bin';
  const token = Math.random().toString(36).slice(2, 10);
  return `products/${productKey}/${role}-${token}.${extension}`;
}
