import type { BadgeKind, CategorySlug, Paise, Product, ProductOption } from './types';
import { isDemoSlug } from './demo/demo-slug';
import { discountPercent, displayPrice, displayVariant, productAvailability } from '@/lib/catalog/pricing';

/**
 * Card-sized projection of a product.
 *
 * Product cards appear in server-rendered grids and in client components (cart
 * cross-sell, compare tray, recently viewed). A flat, serialisable summary
 * keeps one card implementation working in both places and keeps the full
 * catalogue out of the client bundle.
 */
export interface ProductSummary {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  image: string;
  hoverImage?: string;
  category: CategorySlug;
  categoryLabel: string;
  badges: BadgeKind[];
  price: Paise;
  mrp: Paise;
  discount: number;
  availability: 'in-stock' | 'low-stock' | 'out-of-stock' | 'preorder';
  stock: number;
  rating: { average: number; count: number } | null;
  /** Only set when the product has buyer-facing options. */
  hasOptions: boolean;
  /** Default variant id, used for one-click add from a card. */
  defaultVariantId: string;
  /**
   * The technical figures a buyer in this category actually compares, ready to
   * render as chips on the card — Ah/voltage/chemistry for a battery, VA and
   * waveform for an inverter, both for a combo.
   *
   * Replaces the former single `keySpec` line, which no surface renders any
   * more.
   *
   * Only facets the catalogue actually states are included, so a thinly
   * enriched product shows fewer chips rather than invented ones.
   */
  specChips: string[];
  /**
   * The single figure that leads the card, set in bold above the title — the
   * slot a homeware retailer fills with "100% Cotton". Here it is the first
   * comparison chip: chemistry for a battery, VA rating for an inverter.
   *
   * Null when the catalogue states nothing worth leading with; the card then
   * falls back to the category label.
   */
  leadSpec: string | null;
  /**
   * True when the variants are not all the same price, so the card must read
   * "From ₹x" rather than stating one price the buyer may not be able to get.
   */
  priceFrom: boolean;
  /**
   * The "5 more colour" line, already phrased. Null when the product has no
   * buyer-facing option, or only one value of it.
   */
  optionSummary: string | null;
  /**
   * Colours to draw as dots beside `optionSummary`, when the product has a
   * swatch option. Empty for text-only options like the warranty plan.
   */
  swatchHexes: string[];
  /** Absent when the catalogue states no warranty — cards then omit the line. */
  warrantyMonths?: number;
  installationIncluded: boolean;
  /**
   * Marks the temporary demo product so cards can label it. Never set on a real
   * catalogue product. See `lib/commerce/demo/demo-product.ts`.
   */
  isDemo?: boolean;
}

const CATEGORY_LABELS: Record<CategorySlug, string> = {
  inverters: 'Inverter',
  batteries: 'Battery',
  ups: 'UPS',
  combos: 'Combo',
};

/**
 * The comparison figures for a card, ordered by what matters in the category.
 *
 * A battery buyer compares capacity, then voltage, then chemistry; an inverter
 * buyer compares VA rating, then waveform. Anything the catalogue does not
 * state is simply omitted — the same rule the warranty line follows.
 */
function specChipsOf(product: Product): string[] {
  const { capacityVa, batteryAh, voltage, technology, backupHours } = product.facets;
  const chips: string[] = [];

  const va = capacityVa ? `${capacityVa.toLocaleString('en-IN')} VA` : null;
  const ah = batteryAh ? `${batteryAh} Ah` : null;
  const volts = voltage ? `${voltage} V` : null;

  switch (product.category) {
    case 'batteries':
      if (ah) chips.push(ah);
      // Second, not last: on a traction pack the system voltage decides
      // whether the product fits the vehicle at all, so a card that lists
      // capacity without it is describing the wrong thing. Absent on products
      // whose catalogue does not state one, which is every tubular bank.
      if (volts) chips.push(volts);
      if (technology) chips.push(technology);
      if (backupHours) chips.push(`${backupHours} hr backup`);
      break;

    case 'inverters':
    case 'ups':
      if (va) chips.push(va);
      if (technology) chips.push(technology);
      if (ah) chips.push(`${ah} battery`);
      break;

    case 'combos':
      if (va) chips.push(va);
      if (ah) chips.push(ah);
      if (technology) chips.push(technology);
      break;
  }

  // Four chips is the most a card can show without the row wrapping awkwardly.
  return chips.slice(0, 4);
}

/**
 * The option the card advertises.
 *
 * A colour option wins over any other, because it is the one a card can show
 * rather than merely count — and showing beats counting. Otherwise the first
 * option stands in.
 */
function cardOption(product: Product): ProductOption | null {
  const colour = product.options.find((option) => option.kind === 'color');
  const option = colour ?? product.options[0];
  return option && option.values.length > 1 ? option : null;
}

/**
 * The card's option line, e.g. "4 more colour" or "1 more warranty plan".
 *
 * Counts the *alternatives* to the value already on show, which is what the
 * phrasing promises — five colours available reads as "4 more colour".
 */
function optionSummaryOf(option: ProductOption | null): string | null {
  if (!option) return null;
  return `${option.values.length - 1} more ${option.name.toLowerCase()}`;
}

/**
 * Up to five dots for the card's option line.
 *
 * Read from the same option the line counts, never a different one: dots
 * showing finishes beside text counting capacities describes neither.
 */
function swatchHexesOf(option: ProductOption | null): string[] {
  if (!option || option.kind !== 'color') return [];
  return option.values
    .map((value) => option.swatches?.find((swatch) => swatch.value === value)?.hex)
    .filter((hex): hex is string => Boolean(hex))
    .slice(0, 5);
}

export function toProductSummary(product: Product): ProductSummary {
  const price = displayPrice(product);
  const variant = displayVariant(product);
  const availability = productAvailability(product);
  const specChips = specChipsOf(product);
  const sellingPrices = new Set(product.variants.map((candidate) => candidate.price.selling));
  const option = cardOption(product);

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    subtitle: product.subtitle,
    image: product.images[0] ?? '',
    hoverImage: product.images[1],
    category: product.category,
    categoryLabel: CATEGORY_LABELS[product.category],
    badges: availability === 'out-of-stock' ? ['sold-out'] : product.badges,
    price: price.selling,
    mrp: price.mrp,
    discount: discountPercent(price),
    availability,
    stock: variant?.stock ?? 0,
    rating: product.rating ? { average: product.rating.average, count: product.rating.count } : null,
    hasOptions: product.options.length > 0,
    defaultVariantId: variant?.id ?? product.variants[0]?.id ?? '',
    specChips,
    leadSpec: specChips[0] ?? null,
    priceFrom: sellingPrices.size > 1,
    optionSummary: optionSummaryOf(option),
    swatchHexes: swatchHexesOf(option),
    warrantyMonths: product.warrantyMonths,
    installationIncluded: product.installationIncluded,
    // Undefined for every real catalogue product; see demo/demo-slug.ts.
    isDemo: isDemoSlug(product.slug) || undefined,
  };
}
