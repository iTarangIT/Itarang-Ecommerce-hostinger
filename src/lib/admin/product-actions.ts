'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { currentUser } from '@/lib/auth/session';
import { invalidateCatalogSnapshot } from '@/lib/commerce';
import { CATALOG_TAG } from '@/lib/commerce/db/db-provider';
import type { BadgeKind, ProductFacetValues, ProductSection } from '@/lib/commerce/types';
import { orders } from '@/lib/orders/postgres-repository';
import { productRepository } from '@/lib/products/postgres-repository';
import { UNTRACKED_STOCK } from '@/lib/products/to-domain';
import { dispatchStockAlertsInBackground } from '@/lib/stock/alerts';
import { slugify } from '@/lib/utils';
import { SKU_RULE, isValidSku, repeatedVariantField } from '@/lib/products/sku-rules';
import { categoryPairError, loadCategoryOptions } from '@/lib/catalog/category-store';
import { diffFields, diffVariants, logAdminEvent, type FieldChange } from './audit';
import {
  ALLOWED_MEDIA_TYPES,
  MAX_MEDIA_BYTES,
  deleteObject,
  mediaStoragePath,
  mediaUploadsEnabled,
  uploadObject,
} from '@/lib/products/media';
import {
  PRODUCT_MEDIA_ROLES,
  PRODUCT_STATUSES,
  type ProductMediaRole,
  type ProductRecord,
  type ProductStatus,
  type ProductWriteResult,
  type VariantInput,
} from '@/lib/products/types';
import {
  parseFaqs,
  parseLines,
  parsePairs,
  parseParagraphs,
  parseScenarios,
  parseSpecGroups,
  parseTitledItems,
} from './product-text-format';

/**
 * Product management, as Server Actions.
 *
 * Three things are load-bearing and none of them are obvious from the outside.
 *
 * **Every action re-checks authorization.** `admin/layout.tsx` guards the
 * pages, but a Server Action is its own endpoint reached by a POST to an action
 * id, not by rendering a page — the layout's check does not protect it. This is
 * the same reason `admin/actions.ts` opens each of its four actions with
 * `requireAdminActor()`.
 *
 * **Every input is parsed with zod.** The existing order actions validate
 * against an enum and a state machine, which is enough for a two-field form.
 * A product carries prices, a warranty and a publish flag; "whatever the
 * browser sent, coerced with String()" is not an adequate contract for those.
 *
 * **Failures come back on the URL.** These forms are plain server-rendered
 * `<form action={…}>` with no client state, so there is nowhere to return an
 * error object to. Redirecting to `?error=…` keeps the console free of client
 * JavaScript and makes a failed save reloadable and linkable.
 */

async function requireAdminActor(): Promise<string> {
  const user = await currentUser();
  if (!user || user.role !== 'admin') redirect('/login?next=%2Fadmin%2Fproducts');
  return user.email;
}

/**
 * Make a catalogue write visible to shoppers.
 *
 * One call, used by every write path, because the previous arrangement had each
 * action decide for itself and eleven of the twelve decided nothing at all:
 * `settle()` revalidated only the two admin paths, so an edited price reached
 * the category grid (rendered per request) and never reached the product page
 * (rendered once at build). The grid and the page it linked to disagreed.
 *
 * `revalidateTag` is the part that does the work. Every catalogue read goes
 * through the tagged cache in `db-provider.ts`, so Next knows which rendered
 * pages depend on it and purges exactly those — static product pages included,
 * and in every process rather than only the one that handled the POST.
 *
 * `invalidateCatalogSnapshot()` is kept alongside it for the Hostinger
 * provider, which still holds a real in-process snapshot.
 */
function publishCatalogueChange(): void {
  invalidateCatalogSnapshot();
  revalidateTag(CATALOG_TAG);
}

/** Where a save returns to. `redirect` throws, so it is always the last statement. */
function backTo(productKey: string, tab: string, params: Record<string, string> = {}): never {
  const search = new URLSearchParams({ tab, ...params });
  redirect(`/admin/products/${encodeURIComponent(productKey)}?${search.toString()}`);
}

/**
 * Turn a repository result into a redirect.
 *
 * Every failure the repository reports is something an administrator did — a
 * slug already taken, a product published before it had a price — so each one
 * gets a sentence rather than a stack trace.
 */
function settle(productKey: string, tab: string, result: ProductWriteResult<unknown>): never {
  if (result.ok) {
    publishCatalogueChange();
    revalidatePath('/admin/products');
    revalidatePath(`/admin/products/${productKey}`);
    backTo(productKey, tab, { saved: '1' });
  }

  switch (result.code) {
    case 'not_found':
      redirect('/admin/products?error=' + encodeURIComponent('That product no longer exists.'));
    case 'duplicate':
      backTo(productKey, tab, {
        error:
          result.field === 'variant_key'
            ? `Two rows have the same variant key (${result.value}). Each variant of a product needs its own key.`
            : result.field === 'sku'
              ? `SKU ${result.value} is already used by another product (SKUs are unique, ignoring capitals).`
              : `That ${result.field.replace('_', ' ')} is already used by another product: ${result.value}`,
      });
    case 'invalid_transition':
      backTo(productKey, tab, {
        error: `A ${result.from} product cannot move straight to ${result.to}.`,
      });
    case 'incomplete':
      backTo(productKey, tab, {
        error: `Not ready to publish. Still missing: ${result.missing.join(', ')}.`,
      });
  }
}

/**
 * Record a successful save in Logs → Product log, then hand the result on to
 * `settle`. A failed save is not logged: nothing changed.
 */
async function logged<T extends ProductWriteResult<unknown>>(
  result: T,
  entry: {
    actor: string;
    productKey: string;
    action: string;
    before?: ProductRecord | null;
    changes?: FieldChange[];
  },
): Promise<T> {
  if (result.ok) {
    await logAdminEvent({
      entityType: 'product',
      entityId: entry.productKey,
      label: entry.before?.title ?? entry.productKey,
      action: entry.action,
      actor: entry.actor,
      changes: entry.changes ?? [],
    });
  }
  return result;
}

/** The product as it is before an edit, for the old → new columns of the log. */
async function snapshot(productKey: string): Promise<ProductRecord | null> {
  try {
    return await productRepository().findByKey(productKey);
  } catch {
    return null;
  }
}

/** A product's top-level fields, flattened so `diffFields` can compare a patch against them. */
function flat(product: ProductRecord | null): Record<string, unknown> | null {
  if (!product) return null;
  return {
    ...product,
    manufacturerId: product.manufacturer?.id ?? null,
    sellerId: product.seller?.id ?? null,
  };
}

/* ------------------------------------------------------------------ schemas */

const text = (max = 500) => z.string().trim().max(max);
const optionalText = (max = 500) =>
  text(max)
    .optional()
    // An emptied field is a cleared field. Without this, blanking a model
    // number would store "" and the PDP would render an empty row rather than
    // omitting it.
    .transform((value) => (value ? value : null));

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lower-case words separated by single hyphens.');

const productKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lower-case words separated by single hyphens.');

// Checked against `catalog_categories` after parsing (see `checkCategory`), not
// a fixed list: categories are added from the admin panel.
const categorySchema = text(60).min(1, 'Choose a category.');
const artSchema = z.enum(['inverter', 'battery', 'ups', 'combo']);

/** Rupees in the form, paise in the database. One conversion, in one place. */
const rupeesToPaise = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : Math.round(Number(value) * 100)))
  .refine(
    (value) => value === null || (Number.isFinite(value) && value >= 0),
    'Enter an amount in rupees, or leave it blank.',
  );

const optionalInt = (max: number) =>
  z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : Number.parseInt(value, 10)))
    .refine(
      (value) => value === null || (Number.isInteger(value) && value > 0 && value <= max),
      'Enter a whole number, or leave it blank.',
    );

/**
 * Units in stock. Blank means "not tracked"; **zero is a real value**.
 *
 * Separate from `optionalInt` because that one refines `value > 0`, which is
 * right for a warranty term or a return window — a zero-month warranty is a
 * mistake — and exactly wrong here. Zero is the single most important quantity
 * an administrator can enter: it is the one that takes a product off sale.
 *
 * Until this existed, `stock-0` failed the refine and bounced the entire
 * pricing form with "Check the numbers on row 1", so the only way to mark
 * something sold out was the Availability dropdown, leaving a contradictory
 * number in the box beside it. The column has always been `CHECK (stock >= 0)`
 * and `availabilityFor()` has always handled `stock <= 0`; only the form
 * disagreed.
 */
const stockSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : Number.parseInt(value, 10)))
  .refine(
    (value) => value === null || (Number.isInteger(value) && value >= 0 && value <= 1_000_000),
    'Enter a whole number of units (0 or more), or leave it blank if stock is not tracked.',
  );

const optionalFloat = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : Number(value)))
  .refine((value) => value === null || Number.isFinite(value), 'Enter a number, or leave it blank.');

/* ------------------------------------------------------------------ create */

/**
 * The create form does not ask for a key or a slug: both are derived from the
 * title (plus the model number when the title does not already carry it), so an
 * administrator cannot mistype a product's address. A taken address gets a
 * numeric suffix. The slug can still be changed later under "SEO & URL".
 */
const createSchema = z.object({
  title: text(200).min(1, 'Enter a title.'),
  subtitle: text(300).optional().default(''),
  brand: optionalText(120),
  modelName: optionalText(120),
  category: categorySchema,
  subcategory: text(80).min(1),
  art: artSchema.optional().default('battery'),
});

export async function createProductAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(
      '/admin/products/new?error=' +
        encodeURIComponent(parsed.error.issues.map((issue) => issue.message).join(' ')),
    );
  }

  const categoryError = await checkCategory(parsed.data.category, parsed.data.subcategory);
  if (categoryError) redirect('/admin/products/new?error=' + encodeURIComponent(categoryError));

  const base = baseSlugFor(parsed.data.title, parsed.data.modelName);

  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    const suffix = attempt === 1 ? '' : `-${attempt}`;
    const slug = base.slice(0, 120 - suffix.length).replace(/-+$/, '') + suffix;

    const result = await productRepository().createProduct(
      { ...parsed.data, productKey: slug, slug },
      actor,
    );
    if (result.ok) {
      await logAdminEvent({
        entityType: 'product',
        entityId: slug,
        label: parsed.data.title,
        action: 'Created',
        actor,
        summary: `Category ${parsed.data.category} / ${parsed.data.subcategory}`,
      });
      publishCatalogueChange();
      revalidatePath('/admin/products');
      backTo(slug, 'information', { saved: '1' });
    }
    // Only a clash on the generated address is worth another try.
    if (result.code !== 'duplicate') break;
  }

  redirect(
    '/admin/products/new?error=' +
      encodeURIComponent('Could not create the product. A product with this title may already exist.'),
  );
}

const MAX_SLUG_ATTEMPTS = 20;

async function checkCategory(category: string, subcategory: string): Promise<string | null> {
  return categoryPairError(await loadCategoryOptions(), category, subcategory);
}

function baseSlugFor(title: string, modelName: string | null): string {
  let base = slugify(title);
  const model = modelName ? slugify(modelName) : '';
  if (model && !base.includes(model)) base = base ? `${base}-${model}` : model;
  return base || 'product';
}

/* ------------------------------------------------------------- information */

const informationSchema = z.object({
  productKey: productKeySchema,
  title: text(200).min(1),
  subtitle: text(300).optional().default(''),
  brand: optionalText(120),
  modelName: optionalText(120),
  genericName: optionalText(200),
  productType: optionalText(200),
  netQuantity: optionalText(80),
  category: categorySchema,
  subcategory: text(80).min(1),
  art: artSchema,
  countryOfOrigin: optionalText(80),
  installationIncluded: z.coerce.boolean().optional().default(false),
});

export async function updateProductInformationAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const raw = Object.fromEntries(formData);
  const parsed = informationSchema.safeParse({
    ...raw,
    installationIncluded: formData.get('installationIncluded') === 'on',
  });

  if (!parsed.success) {
    backTo(String(raw.productKey ?? ''), 'information', {
      error: parsed.error.issues.map((issue) => issue.message).join(' '),
    });
  }

  const { productKey, ...patch } = parsed.data;
  const categoryError = await checkCategory(patch.category, patch.subcategory);
  if (categoryError) backTo(productKey, 'information', { error: categoryError });
  const before = await snapshot(productKey);
  settle(
    productKey,
    'information',
    await logged(await productRepository().updateProduct(productKey, patch, actor), {
      actor,
      productKey,
      action: 'Edited information',
      before,
      changes: diffFields(flat(before), patch),
    }),
  );
}

/* ------------------------------------------------------------------ facets */

const facetsSchema = z.object({
  productKey: productKeySchema,
  batteryAh: optionalFloat,
  voltage: optionalFloat,
  capacityVa: optionalFloat,
  backupHours: optionalFloat,
  technology: optionalText(80),
  badges: z.string().trim().optional().default(''),
  popularityRank: optionalInt(1_000_000),
});

const BADGE_KINDS: BadgeKind[] = [
  'bestseller',
  'new',
  'sale',
  'combo-saver',
  'premium',
  'low-stock',
  'sold-out',
];

export async function updateProductFacetsAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const raw = Object.fromEntries(formData);
  const parsed = facetsSchema.safeParse(raw);

  if (!parsed.success) {
    backTo(String(raw.productKey ?? ''), 'facets', {
      error: parsed.error.issues.map((issue) => issue.message).join(' '),
    });
  }

  const { productKey, badges, popularityRank, technology, ...numbers } = parsed.data;

  // Only values the catalogue actually states reach the facets object. An
  // undefined facet excludes the product from that filter, which is the correct
  // rendering of "not stated" — a zero would file it under a figure nobody gave.
  const facets: ProductFacetValues = {};
  if (numbers.batteryAh !== null) facets.batteryAh = numbers.batteryAh;
  if (numbers.voltage !== null) facets.voltage = numbers.voltage;
  if (numbers.capacityVa !== null) facets.capacityVa = numbers.capacityVa;
  if (numbers.backupHours !== null) facets.backupHours = numbers.backupHours;
  if (technology) facets.technology = technology;

  const selected = parseLines(badges).filter((badge): badge is BadgeKind =>
    (BADGE_KINDS as string[]).includes(badge),
  );

  const before = await snapshot(productKey);
  const facetPatch = { facets, badges: selected, popularityRank };
  settle(
    productKey,
    'facets',
    await logged(await productRepository().updateProduct(productKey, facetPatch, actor), {
      actor,
      productKey,
      action: 'Edited filters and badges',
      before,
      changes: diffFields(flat(before), facetPatch),
    }),
  );
}

/* ----------------------------------------------------------------- content */

const contentSchema = z.object({
  productKey: productKeySchema,
  highlights: z.string().max(8_000).optional().default(''),
  description: z.string().max(20_000).optional().default(''),
  boxContents: z.string().max(4_000).optional().default(''),
  careInstructions: z.string().max(8_000).optional().default(''),
});

export async function updateProductContentAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const raw = Object.fromEntries(formData);
  const parsed = contentSchema.safeParse(raw);

  if (!parsed.success) {
    backTo(String(raw.productKey ?? ''), 'content', {
      error: parsed.error.issues.map((issue) => issue.message).join(' '),
    });
  }

  const care = parseLines(parsed.data.careInstructions);
  const contentPatch = {
    highlights: parseLines(parsed.data.highlights),
    description: parseParagraphs(parsed.data.description),
    boxContents: parseLines(parsed.data.boxContents),
    // null rather than [], so the PDP renders no care block at all rather
    // than an empty heading.
    careInstructions: care.length > 0 ? care : null,
  };
  const before = await snapshot(parsed.data.productKey);

  settle(
    parsed.data.productKey,
    'content',
    await logged(
      await productRepository().updateProduct(parsed.data.productKey, contentPatch, actor),
      {
        actor,
        productKey: parsed.data.productKey,
        action: 'Edited content',
        before,
        changes: diffFields(flat(before), contentPatch),
      },
    ),
  );
}

/* ----------------------------------------------------------- specifications */

export async function updateProductSpecsAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const productKey = productKeySchema.parse(formData.get('productKey'));
  const groups = parseSpecGroups(String(formData.get('specs') ?? ''));

  const before = await snapshot(productKey);
  settle(
    productKey,
    'specs',
    await logged(await productRepository().replaceSpecGroups(productKey, groups, actor), {
      actor,
      productKey,
      action: 'Edited specifications',
      before,
      changes: [
        {
          field: 'Specification groups',
          from: String(before?.specGroups.length ?? 0),
          to: String(groups.length),
        },
      ],
    }),
  );
}

/* --------------------------------------------------------------------- faq */

export async function updateProductFaqsAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const productKey = productKeySchema.parse(formData.get('productKey'));
  const faqs = parseFaqs(String(formData.get('faqs') ?? ''));

  const before = await snapshot(productKey);
  settle(
    productKey,
    'faq',
    await logged(await productRepository().replaceFaqs(productKey, faqs, actor), {
      actor,
      productKey,
      action: 'Edited FAQs',
      before,
      changes: [{ field: 'FAQs', from: String(before?.faqs.length ?? 0), to: String(faqs.length) }],
    }),
  );
}

/* ---------------------------------------------------------------- sections */

/**
 * The six page blocks, submitted as one form.
 *
 * A section with no content is omitted rather than stored empty: the PDP
 * renders whatever sections a product has, so an empty "Charging" block would
 * be a heading with nothing under it.
 */
export async function updateProductSectionsAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const productKey = productKeySchema.parse(formData.get('productKey'));
  const field = (name: string) => String(formData.get(name) ?? '');

  const sections: ProductSection[] = [];

  const applications = parseTitledItems(field('applications'));
  if (applications.length) sections.push({ kind: 'applications', items: applications });

  for (const kind of ['charging', 'discharge'] as const) {
    const summary = field(`${kind}Summary`).trim();
    const points = parsePairs(field(`${kind}Points`));
    if (summary || points.length) sections.push({ kind, summary, points });
  }

  const runtimeSummary = field('runtimeSummary').trim();
  const scenarios = parseScenarios(field('runtimeScenarios'));
  if (runtimeSummary || scenarios.length) {
    sections.push({ kind: 'runtime', summary: runtimeSummary, scenarios });
  }

  for (const kind of ['compatibility', 'care'] as const) {
    const items = parseLines(field(kind));
    if (items.length) sections.push({ kind, items });
  }

  const before = await snapshot(productKey);
  settle(
    productKey,
    'sections',
    await logged(await productRepository().replaceSections(productKey, sections, actor), {
      actor,
      productKey,
      action: 'Edited page sections',
      before,
      changes: diffFields(
        { sections: before?.sections.map((section) => section.kind) },
        { sections: sections.map((section) => section.kind) },
      ),
    }),
  );
}

/* ---------------------------------------------------------------- warranty */

const warrantySchema = z.object({
  productKey: productKeySchema,
  warrantyMonths: optionalInt(600),
  warrantyCycles: optionalInt(100_000),
  warrantyText: optionalText(300),
  returnWindowDays: optionalInt(365),
});

export async function updateProductWarrantyAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const raw = Object.fromEntries(formData);
  const parsed = warrantySchema.safeParse(raw);

  if (!parsed.success) {
    backTo(String(raw.productKey ?? ''), 'warranty', {
      error: parsed.error.issues.map((issue) => issue.message).join(' '),
    });
  }

  const { productKey, ...patch } = parsed.data;
  const before = await snapshot(productKey);
  settle(
    productKey,
    'warranty',
    await logged(await productRepository().updateProduct(productKey, patch, actor), {
      actor,
      productKey,
      action: 'Edited warranty',
      before,
      changes: diffFields(flat(before), patch),
    }),
  );
}

/* ----------------------------------------------------------------- pricing */

const pricingSchema = z.object({
  productKey: productKeySchema,
  hsnCode: optionalText(20),
  taxRatePercent: optionalFloat,
  // An unchecked checkbox submits nothing at all, so absence is false. That is
  // the safe direction for a financing claim: a form that fails to send the
  // field turns the offer off, never on.
  emiEnabled: z.coerce.boolean().optional().default(false),
});

export async function updateProductPricingAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const raw = Object.fromEntries(formData);
  const parsed = pricingSchema.safeParse({
    ...raw,
    emiEnabled: formData.get('emiEnabled') === 'on',
  });

  if (!parsed.success) {
    backTo(String(raw.productKey ?? ''), 'pricing', {
      error: parsed.error.issues.map((issue) => issue.message).join(' '),
    });
  }

  const { productKey, hsnCode, taxRatePercent, emiEnabled } = parsed.data;

  // Variants arrive as parallel indexed fields, the plain-HTML equivalent of an
  // array of rows.
  const variants: VariantInput[] = [];
  const count = Number(formData.get('variantCount') ?? 0);

  for (let index = 0; index < count; index += 1) {
    const sku = String(formData.get(`sku-${index}`) ?? '').trim();

    // A cleared SKU used to `continue`, which silently dropped the row — and
    // because the write is delete-then-reinsert, that permanently destroyed
    // that variant's price, stock and availability while the form reported a
    // successful save. Refusing is the only safe answer: a SKU is not
    // something to lose by accident, and a genuine deletion should be a
    // deliberate action rather than an emptied field.
    if (!sku) {
      backTo(productKey, 'pricing', {
        error:
          `Row ${index + 1} has no SKU. Every variant needs one — clearing it would ` +
          'delete the price and stock on that row. Nothing was saved.',
      });
    }

    if (!isValidSku(sku)) {
      backTo(productKey, 'pricing', {
        error: `Row ${index + 1}: "${sku}" is not a valid SKU. ${SKU_RULE} Nothing was saved.`,
      });
    }

    const mrp = rupeesToPaise.safeParse(String(formData.get(`mrp-${index}`) ?? ''));
    const selling = rupeesToPaise.safeParse(String(formData.get(`selling-${index}`) ?? ''));
    const cost = rupeesToPaise.safeParse(String(formData.get(`cost-${index}`) ?? ''));
    const stock = stockSchema.safeParse(String(formData.get(`stock-${index}`) ?? ''));
    const availability = String(formData.get(`availability-${index}`) ?? '').trim();

    if (!mrp.success || !selling.success || !cost.success || !stock.success) {
      backTo(productKey, 'pricing', { error: `Check the numbers on row ${index + 1}.` });
    }

    variants.push({
      variantKey: String(formData.get(`variantKey-${index}`) ?? '').trim() || 'default',
      sku,
      title: String(formData.get(`variantTitle-${index}`) ?? '').trim(),
      optionValues: {},
      mrp: mrp.data,
      selling: selling.data,
      costPrice: cost.data,
      stock: stock.data,
      availability:
        availability === 'in-stock' ||
        availability === 'low-stock' ||
        availability === 'out-of-stock' ||
        availability === 'preorder'
          ? availability
          : null,
    });
  }

  // Caught here, not by the database, so the message can name both rows.
  const repeated = repeatedVariantField(variants);
  if (repeated) backTo(productKey, 'pricing', { error: `${repeated} Nothing was saved.` });

  // One transaction for both halves. These were two calls, so a duplicate SKU
  // could fail the variant write *after* the tax fields had committed —
  // leaving a product taxed at the new rate, priced at the old one, and an
  // error on screen implying nothing had been saved.
  const before = await snapshot(productKey);
  const result = await productRepository().updatePricing(
    productKey,
    {
      hsnCode,
      // Entered as a percentage because that is how a GST rate is written
      // and read; stored as the fraction `orders.gst_rate` uses.
      taxRate: taxRatePercent === null ? null : taxRatePercent / 100,
      emiEnabled,
    },
    variants,
    actor,
  );

  /**
   * Setting a stock count to zero here records an out-of-stock transition
   * inside that transaction; this sends the alert for it, after the commit.
   *
   * Fire-and-forget: an administrator saving a price must not wait on an SMTP
   * round trip, and must not see a save fail because a mail server did.
   * `settle` throws a redirect, so this has to happen before it.
   */
  if (result.ok) {
    dispatchStockAlertsInBackground();
    await syncCheckoutStock(productKey, variants);
  }

  settle(
    productKey,
    'pricing',
    await logged(result, {
      actor,
      productKey,
      action: 'Edited prices and stock',
      before,
      changes: [
        ...diffFields(flat(before), {
          hsnCode,
          taxRate: taxRatePercent === null ? null : taxRatePercent / 100,
          emiEnabled,
        }),
        ...diffVariants(before, variants),
      ],
    }),
  );
}

/**
 * Make checkout agree with the stock just saved.
 *
 * Checkout does not read `product_variants.stock` directly: it checks against
 * `inventory_baseline`, the ledger it locks while reserving units, and takes
 * the smaller of the two. Nothing used to write that ledger when stock was
 * edited here, so a row seeded at 0 stayed 0 — the product page said "Only 2
 * left" while every checkout answered "One of your items just went out of
 * stock". The number typed here is the new count on the shelf, which is what
 * `reconcileInventory` records (sales already deducted from it are marked
 * settled so they are not subtracted twice; units held by orders awaiting
 * payment still count against it).
 *
 * The product save has already committed. A failure here is logged rather than
 * reported as a failed save — which it was not — and the "resync stock" button
 * on /admin repairs it.
 */
async function syncCheckoutStock(productKey: string, variants: VariantInput[]): Promise<void> {
  try {
    await orders().reconcileInventory(
      variants.map((variant) => ({
        variantId: `${productKey}:${variant.variantKey}`,
        quantity: variant.stock ?? UNTRACKED_STOCK,
      })),
    );
  } catch (error) {
    console.error(`[admin] checkout stock not synced for ${productKey}:`, error);
  }
}

/* ----------------------------------------------------------------- parties */

const partiesSchema = z.object({
  productKey: productKeySchema,
  manufacturerId: optionalInt(1_000_000),
  sellerId: optionalInt(1_000_000),
});

export async function updateProductPartiesAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const raw = Object.fromEntries(formData);
  const parsed = partiesSchema.safeParse(raw);

  if (!parsed.success) {
    backTo(String(raw.productKey ?? ''), 'parties', {
      error: parsed.error.issues.map((issue) => issue.message).join(' '),
    });
  }

  const { productKey, manufacturerId, sellerId } = parsed.data;
  const before = await snapshot(productKey);
  settle(
    productKey,
    'parties',
    await logged(
      await productRepository().updateProduct(productKey, { manufacturerId, sellerId }, actor),
      {
        actor,
        productKey,
        action: 'Edited manufacturer and seller',
        before,
        changes: diffFields(flat(before), { manufacturerId, sellerId }),
      },
    ),
  );
}

/* --------------------------------------------------------------------- seo */

const seoSchema = z.object({
  productKey: productKeySchema,
  slug: slugSchema,
  seoTitle: optionalText(200),
  seoDescription: optionalText(400),
});

export async function updateProductSeoAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const raw = Object.fromEntries(formData);
  const parsed = seoSchema.safeParse(raw);

  if (!parsed.success) {
    backTo(String(raw.productKey ?? ''), 'seo', {
      error: parsed.error.issues.map((issue) => issue.message).join(' '),
    });
  }

  const { productKey, ...patch } = parsed.data;
  const before = await snapshot(productKey);
  settle(
    productKey,
    'seo',
    await logged(await productRepository().updateProduct(productKey, patch, actor), {
      actor,
      productKey,
      action: 'Edited SEO and URL',
      before,
      changes: diffFields(flat(before), patch),
    }),
  );
}

/* ------------------------------------------------------------------ status */

export async function setProductStatusAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const productKey = productKeySchema.parse(formData.get('productKey'));
  const status = String(formData.get('status') ?? '');

  if (!(PRODUCT_STATUSES as string[]).includes(status)) {
    backTo(productKey, 'information', { error: 'Unknown status.' });
  }

  const before = await snapshot(productKey);
  const result = await logged(
    await productRepository().setStatus(productKey, status as ProductStatus, actor),
    {
      actor,
      productKey,
      action:
        status === 'published' ? 'Published' : status === 'archived' ? 'Archived' : 'Moved to draft',
      before,
      changes: diffFields(flat(before), { status }),
    },
  );

  if (result.ok) {
    // The storefront's own pages have to be revalidated too: publishing is the
    // one action here whose whole point is to change what a customer sees.
    // Publishing changes which products exist at all, so it purges the
    // catalogue tag like every other write. The two route-shaped
    // `revalidatePath` calls that used to be here are gone: they named
    // `/c/[category]` and `/p/[slug]` but missed `/c/[category]/[sub]`, the
    // homepage rails, search and the sitemap, and a tag covers every page that
    // actually read the catalogue without anyone having to keep a list.
    publishCatalogueChange();
    revalidatePath('/admin/products');
    revalidatePath(`/admin/products/${productKey}`);
  }

  settle(productKey, 'information', result);
}

/* ------------------------------------------------------------------- media */

export async function uploadProductMediaAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const productKey = productKeySchema.parse(formData.get('productKey'));

  if (!mediaUploadsEnabled()) {
    backTo(productKey, 'media', {
      error: 'Image storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    });
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    backTo(productKey, 'media', { error: 'Choose a file to upload.' });
  }

  if (!ALLOWED_MEDIA_TYPES.includes(file.type)) {
    backTo(productKey, 'media', {
      error: `${file.type || 'That file type'} is not an accepted image. Use JPEG, PNG, WebP or AVIF.`,
    });
  }

  if (file.size > MAX_MEDIA_BYTES) {
    backTo(productKey, 'media', {
      error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_MEDIA_BYTES / 1024 / 1024} MB.`,
    });
  }

  const roleValue = String(formData.get('role') ?? 'other');
  const role: ProductMediaRole = (PRODUCT_MEDIA_ROLES as string[]).includes(roleValue)
    ? (roleValue as ProductMediaRole)
    : 'other';

  const storagePath = mediaStoragePath(productKey, role, file.type);

  // The object goes up first. A row pointing at an object that was never
  // written renders a broken image; an object with no row costs storage and
  // nothing else, so this is the safer order.
  try {
    await uploadObject(storagePath, await file.arrayBuffer(), file.type);
  } catch (error) {
    backTo(productKey, 'media', {
      error: `Upload failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    });
  }

  settle(
    productKey,
    'media',
    await logged(
      await productRepository().addMedia(
        productKey,
        {
          storagePath,
          altText: String(formData.get('altText') ?? '').trim(),
          role,
          mime: file.type,
          bytes: file.size,
        },
        actor,
      ),
      {
        actor,
        productKey,
        action: 'Added image',
        before: await snapshot(productKey),
        changes: [{ field: 'Image', from: '—', to: `${file.name} (${role})` }],
      },
    ),
  );
}

export async function updateProductMediaAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const productKey = productKeySchema.parse(formData.get('productKey'));
  const mediaId = Number(formData.get('mediaId'));
  const roleValue = String(formData.get('role') ?? '');

  settle(
    productKey,
    'media',
    await logged(
      await productRepository().updateMedia(
        productKey,
        mediaId,
        {
          altText: String(formData.get('altText') ?? '').trim(),
          role: (PRODUCT_MEDIA_ROLES as string[]).includes(roleValue)
            ? (roleValue as ProductMediaRole)
            : undefined,
        },
        actor,
      ),
      { actor, productKey, action: 'Edited image details', before: await snapshot(productKey) },
    ),
  );
}

/**
 * Move one image one place.
 *
 * A pair of up/down buttons rather than drag-and-drop: dragging needs client
 * state, a pointer, and an accessible keyboard fallback that ends up being
 * these buttons anyway.
 */
export async function moveProductMediaAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const productKey = productKeySchema.parse(formData.get('productKey'));
  const mediaId = Number(formData.get('mediaId'));
  const direction = formData.get('direction') === 'up' ? -1 : 1;

  const product = await productRepository().findByKey(productKey);
  if (!product) settle(productKey, 'media', { ok: false, code: 'not_found' });

  const ordered = [...product.media].sort((a, b) => a.position - b.position);
  const index = ordered.findIndex((media) => media.id === mediaId);
  const target = index + direction;

  // Already at the end it is being pushed towards: nothing to do, and no error
  // either — the button simply has no effect there.
  if (index === -1 || target < 0 || target >= ordered.length) backTo(productKey, 'media');

  const swapped = ordered[index];
  const other = ordered[target];
  if (!swapped || !other) backTo(productKey, 'media');
  ordered[index] = other;
  ordered[target] = swapped;

  settle(
    productKey,
    'media',
    await logged(
      await productRepository().reorderMedia(
        productKey,
        ordered.map((media) => media.id),
        actor,
      ),
      { actor, productKey, action: 'Reordered images', before: product },
    ),
  );
}

export async function setPrimaryProductMediaAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const productKey = productKeySchema.parse(formData.get('productKey'));
  const mediaId = Number(formData.get('mediaId'));

  settle(
    productKey,
    'media',
    await logged(await productRepository().setPrimaryMedia(productKey, mediaId, actor), {
      actor,
      productKey,
      action: 'Changed main image',
      before: await snapshot(productKey),
    }),
  );
}

export async function deleteProductMediaAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const productKey = productKeySchema.parse(formData.get('productKey'));
  const mediaId = Number(formData.get('mediaId'));

  const result = await logged(await productRepository().deleteMedia(productKey, mediaId, actor), {
    actor,
    productKey,
    action: 'Deleted image',
    before: await snapshot(productKey),
  });

  if (result.ok) {
    // Best effort, and deliberately not fatal. The row is already gone, so the
    // page is correct; a stranded object costs storage and is visible in the
    // bucket, which is a far smaller problem than failing the request.
    try {
      await deleteObject(result.value);
    } catch (error) {
      console.warn(
        `[admin] deleted product_media row but could not remove ${result.value}: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  settle(productKey, 'media', result);
}
