import type {
  BadgeKind,
  CategorySlug,
  ProductArtKind,
  ProductFacetValues,
  ProductFaq,
} from '../types';

/**
 * Merchandising metadata Hostinger cannot supply.
 *
 * The Sales Channel API returns title, price, stock, images and description.
 * It returns no collections (`product_collections` is empty on this store), no
 * structured specs beyond free-text HTML blocks, and no reviews. Everything the
 * storefront needs to *merchandise* a product — where it sits in the taxonomy,
 * what facets it carries, what it pairs with — lives here, keyed by Hostinger
 * product id.
 *
 * Adding a product in hPanel is enough for it to appear on the site; adding an
 * entry here is what files it correctly. Unmapped products are listed by
 * `/api/_diagnostics/hostinger` so the gap stays visible.
 */
export interface ProductEnrichment {
  category: CategorySlug;
  subcategory: string;
  art?: ProductArtKind;
  highlights?: string[];
  boxContents?: string[];
  faqs?: ProductFaq[];
  warrantyMonths?: number;
  installationIncluded?: boolean;
  badges?: BadgeKind[];
  facets?: Partial<ProductFacetValues>;
  frequentlyBoughtWith?: string[];
  relatedProductIds?: string[];
  /** Lower sorts earlier under "Best selling". */
  popularityRank?: number;
}

/**
 * Sourcing rule for everything below.
 *
 * Every warranty figure, capacity, chemistry and backup hour in this file is
 * quoted from the merchant's own product copy in hPanel — the description body
 * or the "Key Specifications" block — and nothing else. Where the merchant is
 * silent, the field is left out rather than guessed. `installationIncluded` is
 * the clearest case: no live product's copy mentions installation, so only the
 * one product with an explicit iTarang installation commitment carries it.
 *
 * If a figure here disagrees with hPanel, hPanel is right and this file is
 * stale.
 */
export const ENRICHMENT: Record<string, ProductEnrichment> = {
  /* ---------------------------------------------- ITG-INV-900VA-150AH · ₹8,500
   * "900VA pure sine wave home inverter with a 150Ah lithium battery … up to 4
   * hours … 3-year warranty on the inverter and battery."
   * Key Specifications block: 900 VA · 150 Ah · 4 hours · Lithium · Pure sine
   * wave · Warranty 3 years.
   *
   * Filed under combos because it ships as a matched inverter-plus-battery
   * system, which is what the combos category describes.
   */
  prod_01KZXJ4DSGQCSHXW7BME2NJG0B: {
    category: 'combos',
    subcategory: 'home-combos',
    art: 'combo',
    highlights: [
      'Runs 4 fans, 6 LED lights and a television for up to 4 hours on full load',
      '3-year warranty on the inverter and the battery',
      'Designed for Indian voltage conditions with wide-input protection',
      'Charger profile pre-set for lithium',
    ],
    boxContents: [
      '900VA pure sine wave inverter',
      '150Ah lithium battery',
      'Battery cable set',
      'Warranty card',
      'Installation guide',
    ],
    faqs: [
      {
        question: 'What does the 3-year warranty cover?',
        answer:
          'The inverter board and battery performance are both covered for 3 years from installation.',
      },
      {
        question: 'Is installation included?',
        answer:
          'Installed by a certified iTarang technician. Installation is included in the price and booked after your order is confirmed.',
      },
    ],
    warrantyMonths: 36,
    installationIncluded: true,
    badges: ['bestseller'],
    facets: {
      capacityVa: 900,
      batteryAh: 150,
      technology: 'Pure Sine Wave',
      backupHours: 4,
      warrantyMonths: 36,
    },
    frequentlyBoughtWith: [],
    relatedProductIds: [
      'prod_01M07VR9ZVY4GE9TT3BBDXGYMM', // 900VA pure sine wave inverter
      'prod_01M07WD4XP42SYQ1E1C1FTXYSM', // 900VA + 150Ah combo
    ],
    popularityRank: 1,
  },

  /* ------------------------------------------------ ITR-INV-900-150 · ₹24,999
   * "A 900VA pure sine wave inverter … up to 4 hours on a 150Ah lithium
   * battery … Backed by iTarang Assurance — 3-year warranty."
   * Spec line: VA 900 · Recommended battery 150Ah · Backup up to 4 hours ·
   * Warranty 3 years · Waveform pure sine wave.
   * Merchant copy does not mention installation.
   */
  prod_01M07VR9ZVY4GE9TT3BBDXGYMM: {
    category: 'inverters',
    subcategory: 'pure-sine-wave',
    art: 'inverter',
    highlights: [
      'Runs 4 fans, 6 LED lights and a television for up to 4 hours on a 150Ah lithium battery',
      'Wide-input protection for unstable supply',
      'Digital display shows load, battery level and charging status',
      'iTarang Assurance — 3-year warranty with on-time service',
    ],
    warrantyMonths: 36,
    installationIncluded: false,
    facets: {
      capacityVa: 900,
      batteryAh: 150,
      technology: 'Pure Sine Wave',
      backupHours: 4,
      warrantyMonths: 36,
    },
    // The description names the 150Ah battery as the pairing.
    frequentlyBoughtWith: ['prod_01M07W4SS5G4Z6ANTD39JQHTFV'],
    relatedProductIds: [
      'prod_01M07VY8GMMNFZNDG1QC4PSEAP', // 1500VA inverter
      'prod_01M07WD4XP42SYQ1E1C1FTXYSM', // 900VA + 150Ah combo
    ],
    popularityRank: 2,
  },

  /* ----------------------------------------------- ITR-INV-1500-200 · ₹41,999
   * "A 1500VA pure sine wave inverter … a refrigerator alongside fans, lights
   * and a television for up to 5 hours on a 200Ah lithium battery … 3-year
   * warranty."
   * Spec line: VA 1500 · Recommended battery 200Ah · Backup up to 5 hours ·
   * Warranty 3 years · Waveform pure sine wave.
   */
  prod_01M07VY8GMMNFZNDG1QC4PSEAP: {
    category: 'inverters',
    subcategory: 'pure-sine-wave',
    art: 'inverter',
    highlights: [
      'Handles a refrigerator alongside fans, lights and a television',
      'Up to 5 hours of backup on a 200Ah lithium battery',
      'Wide-input protection and overload cut-off',
      'iTarang Assurance — 3-year warranty with on-time service',
    ],
    warrantyMonths: 36,
    installationIncluded: false,
    facets: {
      capacityVa: 1500,
      batteryAh: 200,
      technology: 'Pure Sine Wave',
      backupHours: 5,
      warrantyMonths: 36,
    },
    // The description names the 200Ah battery as the pairing.
    frequentlyBoughtWith: ['prod_01M07W8R9V3QPTKFDC9B63XZHM'],
    relatedProductIds: ['prod_01M07VR9ZVY4GE9TT3BBDXGYMM'],
    popularityRank: 3,
  },

  /* ------------------------------------------------ ITR-BAT-LI-150 · ₹38,999
   * "A 150Ah 12V LiFePO4 battery designed to pair with a 900VA inverter …
   * over 3,000 charge cycles. 5-year warranty."
   * Spec line: Capacity 150Ah · Voltage 12V · Chemistry LiFePO4 · Cycles 3000+
   * · Warranty 5 years.
   */
  prod_01M07W4SS5G4Z6ANTD39JQHTFV: {
    category: 'batteries',
    subcategory: 'lithium',
    art: 'battery',
    highlights: [
      'Pairs with the 900VA inverter',
      'No water top-up, no acid fumes, about a third the weight of tubular',
      'Built-in BMS guards against overcharge, deep discharge, short circuit and over-temperature',
      'Rated for over 3,000 charge cycles',
    ],
    warrantyMonths: 60,
    installationIncluded: false,
    facets: {
      batteryAh: 150,
      technology: 'LiFePO4',
      warrantyMonths: 60,
    },
    frequentlyBoughtWith: ['prod_01M07VR9ZVY4GE9TT3BBDXGYMM'],
    relatedProductIds: ['prod_01M07W8R9V3QPTKFDC9B63XZHM'],
    popularityRank: 4,
  },

  /* ------------------------------------------------ ITR-BAT-LI-200 · ₹51,999
   * "A 200Ah 12V LiFePO4 battery … Pairs with the 1500VA inverter … over
   * 3,000 charge cycles. 5-year warranty."
   * Spec line: Capacity 200Ah · Voltage 12V · Chemistry LiFePO4 · Cycles 3000+
   * · Warranty 5 years.
   */
  prod_01M07W8R9V3QPTKFDC9B63XZHM: {
    category: 'batteries',
    subcategory: 'lithium',
    art: 'battery',
    highlights: [
      'Pairs with the 1500VA inverter',
      'For homes that need longer backup or run heavier loads',
      'Built-in BMS guards against overcharge, deep discharge, short circuit and over-temperature',
      'Rated for over 3,000 charge cycles',
    ],
    warrantyMonths: 60,
    installationIncluded: false,
    facets: {
      batteryAh: 200,
      technology: 'LiFePO4',
      warrantyMonths: 60,
    },
    frequentlyBoughtWith: ['prod_01M07VY8GMMNFZNDG1QC4PSEAP'],
    relatedProductIds: ['prod_01M07W4SS5G4Z6ANTD39JQHTFV'],
    popularityRank: 5,
  },

  /* ------------------------------------------------ ITR-CMB-900-150 · ₹5,999
   * "a 900VA pure sine wave inverter paired with a matched 150Ah LiFePO4
   * battery … up to 4 hours … both are covered under a single iTarang
   * Assurance claim."
   * Spec line: VA 900 · Battery 150Ah 12V LiFePO4 · Backup up to 4 hours ·
   * Inverter warranty 3 years · Battery warranty 5 years.
   *
   * The two components carry different terms, so the headline figure is the
   * shorter of the two — 3 years is what is guaranteed across the whole
   * system. The split is spelled out in the highlights rather than averaged
   * away.
   *
   * NOTE: the live price of ₹5,999 is inconsistent with the merchant's own
   * "saves ₹4,999" claim against components totalling ₹63,998. Flagged for the
   * merchant; deliberately not compensated for here, because the storefront
   * must show what hPanel says.
   */
  prod_01M07WD4XP42SYQ1E1C1FTXYSM: {
    category: 'combos',
    subcategory: 'home-combos',
    art: 'combo',
    highlights: [
      '900VA pure sine wave inverter matched to a 150Ah LiFePO4 battery',
      'Sized for a typical 2BHK — 4 fans, 6 LED lights and a television for up to 4 hours',
      '3-year inverter warranty and 5-year battery warranty',
      'Both covered under a single iTarang Assurance claim',
    ],
    warrantyMonths: 36,
    installationIncluded: false,
    facets: {
      capacityVa: 900,
      batteryAh: 150,
      technology: 'Pure Sine Wave',
      backupHours: 4,
      warrantyMonths: 36,
    },
    relatedProductIds: [
      'prod_01KZXJ4DSGQCSHXW7BME2NJG0B', // the other 900VA + 150Ah system
      'prod_01M07VR9ZVY4GE9TT3BBDXGYMM', // 900VA inverter on its own
    ],
    popularityRank: 6,
  },
};

/* ------------------------------------------------------------------ fallback */

/**
 * Best-effort category for a product with no enrichment entry.
 *
 * This is the crude title matching the old Hostinger Horizons storefront used
 * for its whole taxonomy. Here it is only a fallback so a newly added SKU shows
 * up somewhere sensible instead of vanishing — it is not the routine path.
 */
const CATEGORY_HINTS: Array<{ category: CategorySlug; subcategory: string; match: RegExp }> = [
  { category: 'combos', subcategory: 'home-combos', match: /\bcombo\b|inverter\s*\+|with .*batter/i },
  { category: 'ups', subcategory: 'home-ups', match: /\bups\b/i },
  { category: 'batteries', subcategory: 'tall-tubular', match: /\bbatter|tubular|lithium|\bah\b|lifepo/i },
  { category: 'inverters', subcategory: 'pure-sine-wave', match: /inverter|\bva\b|sine/i },
];

const DEFAULT_ART: Record<CategorySlug, ProductArtKind> = {
  inverters: 'inverter',
  batteries: 'battery',
  ups: 'ups',
  combos: 'combo',
};

export interface ResolvedEnrichment extends ProductEnrichment {
  art: ProductArtKind;
  /** True when this came from the fallback rather than an explicit entry. */
  inferred: boolean;
}

export function resolveEnrichment(
  productId: string,
  title: string,
  subtitle?: string | null,
): ResolvedEnrichment {
  const explicit = ENRICHMENT[productId];
  if (explicit) {
    return { ...explicit, art: explicit.art ?? DEFAULT_ART[explicit.category], inferred: false };
  }

  const haystack = `${title} ${subtitle ?? ''}`;
  const hint =
    CATEGORY_HINTS.find((candidate) => candidate.match.test(haystack)) ??
    CATEGORY_HINTS[CATEGORY_HINTS.length - 1];

  // A guessed *category* is recoverable — the product still appears, just
  // possibly in the wrong aisle. A guessed *warranty* or *installation
  // commitment* is not: both are promises a customer can act on, and inventing
  // them is worse than showing nothing. So the fallback places the product and
  // then stops. Fill in a real entry above to make these claims.
  return {
    category: hint.category,
    subcategory: hint.subcategory,
    art: DEFAULT_ART[hint.category],
    installationIncluded: false,
    warrantyMonths: undefined,
    inferred: true,
  };
}

/** Product ids present in the live catalogue with no explicit entry here. */
export function unmappedProductIds(productIds: string[]): string[] {
  return productIds.filter((id) => !ENRICHMENT[id]);
}
