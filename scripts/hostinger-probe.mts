/**
 * Hostinger account-API probe — Step 0 of the inventory-decrement work.
 *
 *   node --env-file-if-exists=.env.local scripts/hostinger-probe.mts
 *
 * This answers the one question the plan is blocked on: can the token we hold
 * actually write inventory, and to which store?
 *
 * The storefront talks to the *public* Sales Channel API
 * (`api-ecommerce.hostinger.com/store/{scha_…}`), which needs no credential and
 * exposes no inventory write. Inventory writes live on a different API
 * altogether — the authenticated account API at `developers.hostinger.com`,
 * under `/api/ecommerce/v1/…`. Nothing in `src/` reaches it today.
 *
 * READ-ONLY BY CONSTRUCTION. Like `commerce/hostinger/client.ts`, there is one
 * request function here and it takes no HTTP-verb argument, so this script
 * cannot mutate the merchant's catalogue even by mistake. It is a diagnostic,
 * not a migration.
 *
 * The token is never printed. Every path that reports it masks it first.
 */
const ACCOUNT_API = process.env.HOSTINGER_ACCOUNT_API_URL ?? 'https://developers.hostinger.com';
const PUBLIC_API = process.env.HOSTINGER_ECOMMERCE_API_URL ?? 'https://api-ecommerce.hostinger.com';
const CHANNEL = process.env.HOSTINGER_SALES_CHANNEL_ID;
const TOKEN = process.env.HOSTINGER_API_TOKEN;
const TIMEOUT_MS = 15_000;

function mask(secret: string): string {
  if (secret.length <= 8) return '****';
  return `${secret.slice(0, 4)}…${secret.slice(-4)} (${secret.length} chars)`;
}

function fail(message: string): never {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

function heading(text: string): void {
  console.log(`\n${text}\n${'─'.repeat(text.length)}`);
}

/** The only request function. No `method` parameter exists, so this is GET-only. */
async function get(url: string): Promise<{ status: number; body: unknown; ms: number }> {
  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(`${url.replace(ACCOUNT_API, '')} — network failure: ${(error as Error).message}`);
  }

  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep the raw text; a non-JSON body is itself the diagnostic */
  }
  return { status: response.status, body, ms: Date.now() - started };
}

/** Hostinger wraps collections as `{ data: [...] }` in some places and not others. */
function unwrap(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    for (const key of ['data', 'stores', 'products', 'variants', 'items']) {
      if (Array.isArray(record[key])) return record[key] as unknown[];
    }
  }
  return [];
}

function pick(value: unknown, ...keys: string[]): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const found = record[key];
    if (typeof found === 'string' || typeof found === 'number') return String(found);
    if (typeof found === 'boolean') return found ? 'true' : 'false';
  }
  return '';
}

/* ------------------------------------------------------------ preflight */

if (!TOKEN) {
  fail(
    'HOSTINGER_API_TOKEN is not set.\n\n' +
      '    Add it to .env.local (which is gitignored):\n\n' +
      '      HOSTINGER_API_TOKEN=<token from hPanel → API>\n\n' +
      '    It is a SECRET. It must never gain a NEXT_PUBLIC_ prefix, and it is\n' +
      '    not the same thing as HOSTINGER_SALES_CHANNEL_ID.',
  );
}

console.log('\n  Hostinger account-API probe (read-only)');
console.log(`  account API : ${ACCOUNT_API}`);
console.log(`  token       : ${mask(TOKEN)}`);
console.log(`  public API  : ${PUBLIC_API}`);
console.log(`  channel id  : ${CHANNEL ?? '(unset)'}`);

/* ----------------------------------------------------- 1. token + stores */

heading('1. Token scope and store discovery');

const stores = await get(`${ACCOUNT_API}/api/ecommerce/v1/stores`);

if (stores.status === 401 || stores.status === 403) {
  fail(
    `GET /api/ecommerce/v1/stores returned ${stores.status}.\n\n` +
      '    The token is rejected, or it lacks the ecommerce scope. Inventory\n' +
      '    decrement is BLOCKED until a token with ecommerce access exists.\n' +
      '    Every other part of the plan can still proceed.',
  );
}

if (stores.status !== 200) {
  fail(
    `GET /api/ecommerce/v1/stores returned ${stores.status}: ` +
      JSON.stringify(stores.body).slice(0, 400),
  );
}

const storeList = unwrap(stores.body);
console.log(`  ✓ 200 in ${stores.ms}ms — ecommerce scope confirmed`);
console.log(`  ${storeList.length} store(s) on this account:\n`);

for (const store of storeList) {
  const id = pick(store, 'id', 'store_id');
  const name = pick(store, 'name', 'title');
  const currency = pick(store, 'currency', 'default_currency');
  console.log(`    ${id}   ${name}${currency ? `  [${currency}]` : ''}`);
}

if (storeList.length === 0) {
  fail('The token is valid but the account has no ecommerce stores.');
}

const storeId = process.env.HOSTINGER_STORE_ID || pick(storeList[0], 'id', 'store_id');
if (!storeId) fail('Could not determine a store id from the response.');
console.log(`\n  Using store_id: ${storeId}`);
console.log('  → add this to .env.local as HOSTINGER_STORE_ID');

/* ------------------------------------------- 2. products + variant stock */

heading('2. Products and variant-level inventory');

const products = await get(
  `${ACCOUNT_API}/api/ecommerce/v1/stores/${storeId}/products?include=variants`,
);

if (products.status !== 200) {
  fail(
    `GET .../products returned ${products.status}: ` + JSON.stringify(products.body).slice(0, 400),
  );
}

const productList = unwrap(products.body);
console.log(`  ✓ 200 in ${products.ms}ms — ${productList.length} product(s)\n`);

const accountVariants = new Map<string, string>();

for (const product of productList) {
  const productId = pick(product, 'id', 'product_id');
  const title = pick(product, 'name', 'title');
  const variants = unwrap((product as Record<string, unknown>).variants ?? []);
  console.log(`    ${productId}  ${title}`);
  for (const variant of variants) {
    const variantId = pick(variant, 'id', 'variant_id');
    const qty = pick(variant, 'inventory_quantity');
    const managed = pick(variant, 'manage_inventory');
    const sku = pick(variant, 'sku');
    accountVariants.set(variantId, productId);
    console.log(
      `        variant ${variantId}  stock=${qty || '—'}  managed=${managed || '—'}  sku=${sku || '—'}`,
    );
  }
}

/* ------------------------------- 3. cross-check against the public channel */

heading('3. Do account-API variant ids match the storefront?');

if (!CHANNEL) {
  console.log('  ⚠ HOSTINGER_SALES_CHANNEL_ID is unset — cross-check skipped.');
} else {
  const publicResponse = await fetch(`${PUBLIC_API}/store/${CHANNEL}/products?limit=100&offset=0`, {
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!publicResponse.ok) {
    console.log(`  ⚠ public catalogue returned ${publicResponse.status} — cross-check skipped.`);
  } else {
    const publicList = unwrap(await publicResponse.json());
    const publicVariantIds = new Set<string>();
    for (const product of publicList) {
      for (const variant of unwrap((product as Record<string, unknown>).variants ?? [])) {
        publicVariantIds.add(pick(variant, 'id'));
      }
    }

    const shared = [...publicVariantIds].filter((id) => accountVariants.has(id));
    console.log(`  public catalogue variants : ${publicVariantIds.size}`);
    console.log(`  account API variants      : ${accountVariants.size}`);
    console.log(`  ids present in both       : ${shared.length}`);

    if (shared.length === 0) {
      console.log(
        '\n  ✗ NO OVERLAP. The two APIs use different variant identifiers, so\n' +
          '    inventory_baseline.variant_id cannot address the write endpoint\n' +
          '    directly and the outbox needs an explicit id mapping.',
      );
    } else if (shared.length === publicVariantIds.size) {
      console.log('\n  ✓ Every storefront variant id is addressable by the write API.');
    } else {
      console.log('\n  ⚠ Partial overlap — some storefront variants are not addressable:');
      for (const id of publicVariantIds) {
        if (!accountVariants.has(id)) console.log(`      missing: ${id}`);
      }
    }
  }
}

/* ------------------------------------------------------------- verdict */

heading('Verdict');
console.log(`  HOSTINGER_STORE_ID=${storeId}`);
console.log('\n  Inventory write endpoint:');
console.log(
  `    PATCH ${ACCOUNT_API}/api/ecommerce/v1/stores/${storeId}/products/{product_id}/variants/batch`,
);
console.log('    body: { "variants": [ { "variant_id": "…", "inventory_quantity": N } ] }');
console.log('\n  Send ONLY variant_id and inventory_quantity. This endpoint replaces');
console.log('  prices in full, so including "prices" would clobber the merchant pricing.\n');
