import type {
  Availability,
  Paise,
  Price,
  Product,
  ProductOption,
  ProductVariant,
  SpecGroup,
} from '../types';
import { artSet } from '../mock/art';
import type { HostingerPrice, HostingerProduct, HostingerVariant } from './schema';
import { resolveEnrichment } from './enrichment';

/**
 * Hostinger Sales Channel payload → the storefront's domain types.
 *
 * Derived from the live `/products` response, not from guesswork. Every field
 * the UI reads is produced here; anything Hostinger cannot supply comes from
 * `enrichment.ts`.
 */

/* -------------------------------------------------------------------- html */

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split rich-text HTML into paragraphs, preserving reading order. */
export function htmlToParagraphs(html: string | null | undefined): string[] {
  if (!html) return [];
  const blocks = html.split(/<\/p>|<br\s*\/?>/i);
  return blocks.map(stripHtml).filter(Boolean);
}

/**
 * Parse a Hostinger "additional info" block into spec rows.
 *
 * The merchant writes `<p>VA Rating: 900 VA</p>` style lines. A line without a
 * colon becomes a value-only row rather than being discarded — losing merchant
 * copy silently would be worse than an untidy table.
 */
export function parseSpecBlock(html: string): Array<{ label: string; value: string }> {
  return htmlToParagraphs(html).map((line) => {
    const separator = line.indexOf(':');
    if (separator === -1) return { label: '', value: line };
    return {
      label: line.slice(0, separator).trim(),
      value: line.slice(separator + 1).trim(),
    };
  });
}

/* ------------------------------------------------------------------- money */

/**
 * Hostinger quotes money in minor units alongside the currency's exponent.
 *
 * INR reports `decimal_digits: 2`, so the value is already paise and passes
 * through untouched. Anything else is rescaled rather than trusted — a silent
 * 100× price error is the worst failure available in this file.
 */
export function toPaise(amount: number, decimalDigits: number): Paise {
  if (decimalDigits === 2) return Math.round(amount);
  const major = amount / 10 ** decimalDigits;
  return Math.round(major * 100);
}

export function mapPrice(price: HostingerPrice | undefined): Price {
  // A variant with no price at all used to become silently free. That does not
  // stay contained: zero is then the cheapest price in the catalogue, so it
  // becomes the product's displayed "from" price and drags the lower bound of
  // the price facet to zero for the whole shop.
  if (!price) {
    console.warn('[hostinger] variant has no price; treating as unavailable rather than free');
    return { mrp: 0, selling: 0 };
  }

  // Only `prices[0]` is ever read, and nothing upstream promises it is the
  // rupee one. Every figure in this app is paise and every price is rendered
  // behind a hard-coded rupee sign, so a foreign minor unit would be shown as
  // rupees with no visible sign that it is wrong.
  if (price.currency_code && price.currency_code.toLowerCase() !== 'inr') {
    console.warn(
      `[hostinger] ignoring non-INR price (currency_code=${price.currency_code}); ` +
        'this product will show as unpriced rather than in the wrong currency',
    );
    return { mrp: 0, selling: 0 };
  }

  const digits = price.currency.decimal_digits;
  const list = toPaise(price.amount, digits);
  const sale = price.sale_amount != null ? toPaise(price.sale_amount, digits) : null;

  // A sale above list is a merchant data error. Honouring it would render a
  // negative discount; ignoring it quietly would hide the mistake. Take the
  // lower figure and say so.
  if (sale !== null && sale > list) {
    console.warn(
      `[hostinger] sale_amount (${sale}) exceeds amount (${list}); using the lower of the two`,
    );
    return { mrp: sale, selling: list };
  }

  // When a sale is running, `amount` is the struck-through price.
  return { mrp: list, selling: sale ?? list };
}

/* ---------------------------------------------------------------- variants */

/** Same thresholds the development catalogue uses, so badges behave identically. */
function availabilityFor(stock: number, isAvailable: boolean): Availability {
  if (!isAvailable) return 'out-of-stock';
  if (stock <= 0) return 'out-of-stock';
  if (stock <= 5) return 'low-stock';
  return 'in-stock';
}

/** Stand-in ceiling for variants the merchant does not stock-manage. */
const UNMANAGED_STOCK = 99;

export function mapVariant(
  variant: HostingerVariant,
  inventory: Map<string, number>,
): ProductVariant {
  const managed = variant.manage_inventory !== false;
  const stock = managed ? (inventory.get(variant.id) ?? variant.inventory_quantity ?? 0) : UNMANAGED_STOCK;

  const optionValues: Record<string, string> = {};
  for (const option of variant.options) {
    optionValues[option.option_id] = option.value;
  }

  return {
    id: variant.id,
    sku: variant.sku ?? variant.id,
    title: variant.title,
    optionValues,
    price: mapPrice(variant.prices[0]),
    availability: availabilityFor(stock, variant.is_available !== false),
    stock,
  };
}

/* ----------------------------------------------------------------- product */

function mapImages(product: HostingerProduct, art: Product['art']): string[] {
  const images = [...product.images]
    .filter((image) => image.type === undefined || image.type === 'image')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((image) => image.url);

  if (images.length > 0) return images;
  if (product.thumbnail) return [product.thumbnail];
  // No merchant imagery: fall back to the local illustration set rather than
  // rendering a broken image.
  return artSet(art, 1);
}

function mapOptions(product: HostingerProduct): ProductOption[] {
  return product.options.map((option) => ({
    id: option.id,
    name: option.title,
    values: [...new Set(option.values.map((value) => value.value))],
  }));
}

function mapSpecGroups(product: HostingerProduct): SpecGroup[] {
  return [...product.additional_info]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((block) => ({ title: block.title, specs: parseSpecBlock(block.description) }))
    .filter((group) => group.specs.length > 0);
}

export function mapProduct(
  product: HostingerProduct,
  inventory: Map<string, number>,
): Product {
  const slug = product.url_handle ?? product.slug ?? product.id;
  const enrichment = resolveEnrichment({
    productId: product.id,
    title: product.title,
    subtitle: product.subtitle,
    slug,
    skus: product.variants.map((variant) => variant.sku),
  });
  const subtitle = product.subtitle ?? '';
  const description = htmlToParagraphs(product.description);

  return {
    id: product.id,
    slug,
    title: product.title,
    subtitle,
    category: enrichment.category,
    subcategory: enrichment.subcategory,
    art: enrichment.art,
    images: mapImages(product, enrichment.art),
    highlights: enrichment.highlights ?? [],
    description: description.length > 0 ? description : subtitle ? [subtitle] : [],
    specGroups: mapSpecGroups(product),
    boxContents: enrichment.boxContents ?? [],
    faqs: enrichment.faqs ?? [],
    // No `?? 24` fallback: an unknown warranty stays unknown, and every
    // surface omits the claim rather than inventing a plausible one.
    warrantyMonths: enrichment.warrantyMonths,
    installationIncluded: enrichment.installationIncluded ?? false,
    badges: enrichment.badges ?? [],
    options: mapOptions(product),
    variants: product.variants.map((variant) => mapVariant(variant, inventory)),
    // The store reports `product_reviews.is_enabled: false`, so there is
    // nothing to show. Never fabricate a rating.
    rating: null,
    facets: {
      ...enrichment.facets,
      warrantyMonths: enrichment.facets?.warrantyMonths ?? enrichment.warrantyMonths,
    },
    frequentlyBoughtWith: enrichment.frequentlyBoughtWith ?? [],
    relatedProductIds: enrichment.relatedProductIds ?? [],
    launchedAt: product.updated_at ?? new Date(0).toISOString(),
    popularityRank: popularityRankFor(enrichment.popularityRank, product.order),
  };
}

/**
 * Merchandising rank, on one scale.
 *
 * Hostinger's `order` is a display-sequence integer, not a popularity measure,
 * and on this store its values are *negative* (−4 … 0). Feeding it straight in
 * meant every unenriched product outranked every curated one, which pushed the
 * product actually badged "Bestseller" to the bottom of the best-sellers rail.
 *
 * Curated ranks therefore own the low numbers and always sort first. Unranked
 * products are pushed above `UNRANKED_BASE`, where they keep Hostinger's
 * relative ordering among themselves — so a newly added SKU still appears in a
 * sensible place without displacing deliberate merchandising.
 */
const UNRANKED_BASE = 1_000_000;

/**
 * Widest offset an unranked product may take around `UNRANKED_BASE`.
 *
 * The clamp is what makes the guarantee absolute rather than a bet on
 * Hostinger's numbers staying small: whatever `order` arrives, an unranked
 * product lands inside [900_000, 1_100_000], so any curated rank below that
 * window sorts first. Curated ranks are single or double digits.
 */
const ORDER_WINDOW = 100_000;

export function popularityRankFor(
  curated: number | undefined,
  hostingerOrder: number | null | undefined,
): number {
  if (curated !== undefined) return curated;
  const order = hostingerOrder ?? 0;
  const bounded = Math.min(ORDER_WINDOW, Math.max(-ORDER_WINDOW, order));
  return UNRANKED_BASE + bounded;
}

/** Build the variant-id → stock map from a `/variants` response. */
export function inventoryMap(
  variants: Array<{ id: string; inventory_quantity?: number | null }>,
): Map<string, number> {
  return new Map(variants.map((variant) => [variant.id, variant.inventory_quantity ?? 0]));
}
