import type { Paise, Product, ProductSection, ProductVariant, Review } from '../types';
import { artSet } from '../mock/art';
import { DEMO_PRODUCT_SLUG } from './demo-slug';

/* ===========================================================================
 * TEMPORARY DEMO PRODUCT — UI/REFERENCE ONLY
 * ===========================================================================
 *
 * Every value in this file is ILLUSTRATIVE DUMMY DATA invented to demonstrate
 * the product-card and product-detail design. None of it comes from the
 * Hostinger catalogue, and none of it describes a product iTarang sells.
 *
 * Deliberate isolation — read this before moving anything:
 *
 *   This product is NEVER returned by `catalog()`. It is injected at page
 *   level only (the `/products/[slug]` route and the batteries listing). That is not
 *   a stylistic choice: `allProducts()` feeds `syncInventoryFromHostingerAction`
 *   in `lib/admin/actions.ts`, which calls `syncCatalogue()` — a database write
 *   that claims rows in `catalogue_products` and `catalogue_skus` (a primary
 *   key) — and then reconciles inventory. Routing this product through the
 *   provider would mirror demo data into production tables the next time an
 *   admin pressed "Resync", and could collide with a real SKU.
 *
 *   So: never add this to a `CatalogProvider`, never pass it to
 *   `syncCatalogue()`, and never write it to Hostinger or the database.
 *
 * To remove the demo entirely, delete this directory and drop the `isDemoSlug`
 * branches in `app/products/[slug]/page.tsx` and `components/catalog/category-view.tsx`.
 * The page sections it demonstrates are a real `Product` field now, rendered by
 * `components/product/product-sections.tsx`, which stays.
 * ------------------------------------------------------------------------ */

/** Rupees → paise, matching the catalogue's integer-paise convention. */
const rs = (rupees: number): Paise => Math.round(rupees * 100);

export { DEMO_PRODUCT_SLUG, isDemoSlug } from './demo-slug';

/** Capacity drives the price; finish does not. */
const DEMO_CAPACITIES = [
  { value: '100Ah', code: '100', mrp: rs(57999), selling: rs(47999) },
  { value: '150Ah', code: '150', mrp: rs(74999), selling: rs(62999) },
  { value: '200Ah', code: '200', mrp: rs(94999), selling: rs(79999) },
] as const;

const DEMO_FINISHES = [
  { value: 'Graphite', code: 'GRA' },
  { value: 'Azure', code: 'AZU' },
  { value: 'Ivory', code: 'IVO' },
] as const;

/**
 * Every capacity × finish combination.
 *
 * Ordered so the 150Ah Azure pack comes first — that is the configuration the
 * specification table is written against, so it is the one the page should
 * open on. One combination is deliberately out of stock: a selector that never
 * disables anything does not demonstrate that it can.
 */
function buildDemoVariants(): ProductVariant[] {
  const variants: ProductVariant[] = [];

  for (const capacity of DEMO_CAPACITIES) {
    for (const finish of DEMO_FINISHES) {
      const soldOut = capacity.value === '200Ah' && finish.value === 'Ivory';
      variants.push({
        // "DEMO-" prefix so this can never collide with a real Hostinger SKU.
        id: `demo-lifepower-${capacity.code}-${finish.code.toLowerCase()}`,
        sku: `DEMO-BAT-LFP-${capacity.code}AH-12V-${finish.code}`,
        title: `iTarang LiFePower ${capacity.value} — 12V, ${finish.value}`,
        optionValues: { capacity: capacity.value, finish: finish.value },
        price: { mrp: capacity.mrp, selling: capacity.selling },
        availability: soldOut ? 'out-of-stock' : 'in-stock',
        stock: soldOut ? 0 : 12,
      });
    }
  }

  // 150Ah Azure to the front.
  const openOn = variants.findIndex(
    (variant) =>
      variant.optionValues.capacity === '150Ah' && variant.optionValues.finish === 'Azure',
  );
  return [variants[openOn], ...variants.filter((_, index) => index !== openOn)];
}

/* ------------------------------------------------------------ page sections */

/**
 * Battery-specific page content.
 *
 * This used to be a shape of its own, kept here because the shared `Product`
 * type had no home for it and the demo had to stay a single deletable unit.
 * `Product.sections` is that home now, backed by the `product_sections` table,
 * so this fixture is converted into `ProductSection[]` below and rendered by
 * the same `ProductSections` component every real product uses. The demo is
 * still a single deletable unit; it is just no longer the only thing that can
 * have applications and a charging block.
 */
const DEMO_SECTION_SOURCE = {
  applications: [
    {
      title: 'Home inverter backup',
      description:
        'The intended use. Runs lights, fans, a router and a television through a typical outage, and recharges between them without needing a full cycle.',
    },
    {
      title: 'Solar storage',
      description:
        'Pairs with a solar MPPT controller set to a LiFePO4 profile. Partial charging does no harm, so cloudy days do not shorten its life the way they do with lead-acid.',
    },
    {
      title: 'Shop and small office',
      description:
        'Holds billing systems, a computer and lighting through daytime cuts. The flat discharge curve means equipment sees a steady voltage rather than a sagging one.',
    },
    {
      title: 'Frequent shallow cycling',
      description:
        'Areas with short, repeated outages. Lead-acid degrades quickly under this pattern; LiFePO4 is largely indifferent to it.',
    },
  ],

  charging: {
    summary:
      'Charges from the inverter mains charger, a solar MPPT controller, or both. The only requirement is that the charger is set to a lithium or LiFePO4 profile — a tubular or flat-plate profile applies the wrong voltage and will not charge the pack correctly.',
    points: [
      { label: 'Recommended current', value: '30 A — about 5 hours to full' },
      { label: 'Maximum current', value: '75 A' },
      { label: 'Absorption voltage', value: '14.6V' },
      { label: 'Float voltage', value: '13.8V' },
      { label: 'Solar', value: 'MPPT controller, LiFePO4 profile' },
      { label: 'Partial charging', value: 'Safe — no memory effect, no sulphation' },
    ],
  },

  discharge: {
    summary:
      'Holds a nearly flat voltage across the whole discharge, so appliances run at full output until the pack is genuinely empty rather than dimming progressively as a lead-acid battery does.',
    points: [
      { label: 'Continuous', value: '150 A' },
      { label: 'Peak, 3 seconds', value: '300 A' },
      { label: 'Usable depth of discharge', value: '90%' },
      { label: 'Cut-off voltage', value: '10.0V, enforced by the BMS' },
      { label: 'Voltage sag under load', value: 'Negligible until nearly empty' },
    ],
  },

  sizing: {
    summary:
      'A 150Ah 12V pack stores about 1.92 kWh, of which roughly 1.73 kWh is usable. These are indicative run times for common Indian household loads — the load calculator gives a figure for your own appliance list.',
    scenarios: [
      { load: '4 LED lights + 2 fans', draw: 'about 200 W', runtime: 'around 8 hours' },
      { load: '8 LED lights + 4 fans + router', draw: 'about 280 W', runtime: 'around 6 hours' },
      { load: 'Above plus a television', draw: 'about 400 W', runtime: 'around 4 hours' },
      { load: 'Above plus a refrigerator', draw: 'about 600 W', runtime: 'around 2.5 hours' },
    ],
  },

  compatibility: [
    'Any 12V inverter with a selectable lithium or LiFePO4 charger profile',
    'Solar MPPT controllers supporting a LiFePO4 charge curve',
    'Up to four units in parallel for 600Ah at 12.8V',
    'Not compatible with chargers fixed to a tubular or flat-plate profile',
    'Not suitable for automotive starting duty',
  ],

  care: [
    'No electrolyte topping up and no terminal cleaning — the pack is sealed and maintenance free',
    'Keep terminal bolts tight; a loose terminal is the most common cause of heating',
    'Site it somewhere ventilated and out of direct sun',
    'If storing unused, leave it at roughly half charge rather than full or empty',
    'Do not charge below 0°C — the BMS will block it, which is expected behaviour and not a fault',
  ],
};

/**
 * The fixture above, as the domain type.
 *
 * Assigned onto `DEMO_PRODUCT` below so the demo page renders through exactly
 * the same component and the same field a real product does — which is the only
 * way the demo keeps doing its job of proving the layout.
 */
export const DEMO_SECTIONS: ProductSection[] = [
  { kind: 'applications', items: DEMO_SECTION_SOURCE.applications },
  { kind: 'charging', ...DEMO_SECTION_SOURCE.charging },
  { kind: 'discharge', ...DEMO_SECTION_SOURCE.discharge },
  { kind: 'runtime', ...DEMO_SECTION_SOURCE.sizing },
  { kind: 'compatibility', items: DEMO_SECTION_SOURCE.compatibility },
  { kind: 'care', items: DEMO_SECTION_SOURCE.care },
];

/**
 * The demo battery.
 *
 * Populated generously on purpose — its whole reason for existing is to show
 * the finished design with every section filled in. Real Hostinger products
 * are held to the opposite rule and never get invented values.
 *
 * `rating` stays `null`: the store has reviews disabled and the codebase does
 * not fabricate testimonials, so the demo does not either.
 */
export const DEMO_PRODUCT: Product = {
  id: 'demo-lifepower-150ah',
  slug: DEMO_PRODUCT_SLUG,
  // No capacity in the title: the listing now carries three of them, and the
  // one on show depends on what the shopper has selected.
  title: 'iTarang LiFePower LiFePO4 Battery — 12V',
  subtitle: 'LiFePO4 lithium battery for home inverter and backup systems',
  category: 'batteries',
  subcategory: 'lithium',
  art: 'battery',
  images: artSet('battery', 1),
  sections: DEMO_SECTIONS,

  highlights: [
    '150Ah usable capacity at 12.8V — about 1.92 kWh of storage',
    '4000+ cycle life, roughly eight times a tubular battery of the same size',
    'Built-in BMS with cell balancing, over-current and over-temperature cut-off',
    'Charges from mains or solar, and weighs about a third of an equivalent tubular',
  ],

  description: [
    'The LiFePower 150Ah is a lithium iron phosphate battery built for home backup. It stores about 1.92 kWh at 12.8V and delivers it at a flat voltage, so lights stay at full brightness and fans stay at full speed until the pack is genuinely empty — unlike lead-acid, which sags steadily through a discharge.',
    'Lithium iron phosphate is the safest of the common lithium chemistries. It does not have the thermal runaway behaviour that makes cobalt-based cells a fire risk, it tolerates partial charging without damage, and it holds capacity far longer through repeated shallow cycles — which is exactly how a home backup battery is actually used.',
    'At roughly 15 kg it can be wall-mounted or stood beside the inverter, and the integrated battery management system handles cell balancing, charge and discharge limits and temperature protection without any external controller.',
  ],

  specGroups: [
    {
      // Stated against the 150Ah reference pack; the capacity guide under
      // "What is in the box" gives the figures for the other two.
      title: 'Capacity & electrical — 150Ah reference',
      specs: [
        { label: 'Rated capacity', value: '150 Ah' },
        { label: 'Nominal voltage', value: '12.8V' },
        { label: 'Energy stored', value: '1.92 kWh' },
        { label: 'Maximum continuous discharge', value: '150 A' },
        { label: 'Peak discharge (3 seconds)', value: '300 A' },
        { label: 'Voltage range', value: '10.0V – 14.6V' },
      ],
    },
    {
      title: 'Cell & chemistry',
      specs: [
        { label: 'Chemistry', value: 'Lithium iron phosphate (LiFePO4)' },
        { label: 'Cycle life', value: '4000+ cycles at 80% depth of discharge' },
        { label: 'Usable depth of discharge', value: '90%' },
        { label: 'Round-trip efficiency', value: '98%' },
        { label: 'Self-discharge', value: 'Under 3% per month' },
        { label: 'Cell configuration', value: '4S — four prismatic cells in series' },
      ],
    },
    {
      title: 'Charging',
      specs: [
        { label: 'Recommended charge current', value: '30 A' },
        { label: 'Maximum charge current', value: '75 A' },
        { label: 'Charge voltage', value: '14.6V (absorption), 13.8V (float)' },
        { label: 'Typical full charge', value: '5 hours at 30 A' },
        { label: 'Charging sources', value: 'Mains inverter charger or solar MPPT' },
        { label: 'Charger profile required', value: 'Lithium / LiFePO4' },
      ],
    },
    {
      title: 'Protection & safety',
      specs: [
        { label: 'Battery management system', value: 'Integrated, 150 A rated' },
        { label: 'Protections', value: 'Over-current, over-voltage, under-voltage, short circuit' },
        { label: 'Thermal protection', value: 'Charge and discharge cut-off on over-temperature' },
        { label: 'Cell balancing', value: 'Automatic, passive' },
        { label: 'Operating temperature', value: '0°C to 45°C charging, −20°C to 60°C discharging' },
      ],
    },
    {
      title: 'Physical',
      specs: [
        { label: 'Weight', value: 'Approximately 15 kg' },
        { label: 'Dimensions (W×D×H)', value: '330 × 175 × 220 mm' },
        { label: 'Terminals', value: 'M8 threaded inserts' },
        { label: 'Enclosure', value: 'Flame-retardant ABS' },
        { label: 'Ingress protection', value: 'IP54' },
        { label: 'Mounting', value: 'Floor standing or wall bracket' },
      ],
    },
    {
      title: 'Warranty & support',
      specs: [
        { label: 'Warranty', value: '5 years from date of installation' },
        { label: 'Coverage', value: 'Cell failure, BMS failure and capacity below 70%' },
        { label: 'Installation', value: 'Available — certified iTarang technician' },
        { label: 'Service', value: 'Through the iTarang service network' },
      ],
    },
  ],

  boxContents: [
    'LiFePower battery unit',
    'M8 terminal bolts and insulating covers',
    'Wall mounting bracket and fixings',
    'Quick-start and safety guide',
    'Warranty card',
  ],

  careInstructions: [
    'Mount on a level surface with at least 100 mm of clear air on every side.',
    'Torque the M8 terminals to 8–10 Nm and re-check them after the first month.',
    'Wipe the casing with a dry cloth only — never a solvent or a wet cloth.',
    'If storing unused, leave the pack at roughly 50% charge and top it up every six months.',
    'Do not open the enclosure, bypass the BMS, or series-connect with a lead-acid battery.',
  ],

  // What each capacity ships with, and how big it is. `boxContents` above
  // lists the same parts; this states them per capacity, which is the form a
  // shopper choosing between the three actually needs.
  sizeChart: {
    title: 'Includes / Size chart',
    columns: ['Capacity', 'Includes', 'Measurement'],
    groups: [
      {
        label: '100Ah',
        rows: [
          ['1 Battery Unit', '300 × 175 × 220 mm || 10.5 kg'],
          ['1 Mounting Bracket + M8 Terminal Kit', '1.28 kWh || 4 hours typical backup'],
        ],
      },
      {
        label: '150Ah',
        rows: [
          ['1 Battery Unit', '330 × 175 × 220 mm || 15.0 kg'],
          ['1 Mounting Bracket + M8 Terminal Kit', '1.92 kWh || 6 hours typical backup'],
        ],
      },
      {
        label: '200Ah',
        rows: [
          ['1 Battery Unit', '390 × 175 × 220 mm || 19.5 kg'],
          ['1 Mounting Bracket + M8 Terminal Kit', '2.56 kWh || 8 hours typical backup'],
        ],
      },
    ],
  },

  seller: {
    name: 'iTarang Products Private Limited',
    address: 'Registered address to be confirmed — illustrative sample data.',
    packedBy: 'iTarang Products Private Limited',
  },

  returnWindowDays: 7,

  faqs: [
    {
      question: 'Will this work with my existing inverter?',
      answer:
        'It works with any 12V inverter whose charger can be set to a lithium or LiFePO4 profile. A charger locked to a tubular or flat-plate profile will use the wrong charge voltage, so check that setting before ordering — the load calculator and our support team can both confirm compatibility.',
    },
    {
      question: 'How long will it run my home?',
      answer:
        'About 1.92 kWh of storage runs four fans, eight LED lights and a router for roughly six to seven hours. Adding a refrigerator brings that down to about three hours. The load calculator gives a figure for your specific appliance list.',
    },
    {
      question: 'How does 4000 cycles compare to a tubular battery?',
      answer:
        'A good tubular battery gives roughly 500 to 1500 cycles depending on how deeply it is discharged. At one cycle a day, 4000 cycles is over ten years of daily use, which is why the higher purchase price usually works out cheaper across the life of the system.',
    },
    {
      question: 'Can it be charged from solar?',
      answer:
        'Yes. It charges from a solar MPPT controller set to a LiFePO4 profile, from the inverter mains charger, or from both. Partial charging does no harm to this chemistry, so a day of poor sunlight is not a problem.',
    },
    {
      question: 'Does it need maintenance?',
      answer:
        'No. There is no electrolyte to top up and no terminal corrosion to clean, which is the main practical difference from a tubular battery. Keeping the terminals tight and the unit ventilated is all that is required.',
    },
  ],

  warrantyMonths: 60,
  installationIncluded: true,
  // The one product allowed to advertise EMI, because it is the one product
  // that is not real. The page carries a banner saying every figure on it is
  // illustrative, and the design has to keep demonstrating this line.
  emiEnabled: true,
  badges: ['premium'],

  /**
   * Two options, one of each kind, so the demo exercises both selectors: a
   * priced text option and a colour swatch option. The finish does not change
   * the price — only the capacity does.
   */
  options: [
    { id: 'capacity', name: 'Capacity', values: ['100Ah', '150Ah', '200Ah'] },
    {
      id: 'finish',
      name: 'Finish',
      kind: 'color',
      values: ['Graphite', 'Azure', 'Ivory'],
      swatches: [
        { value: 'Graphite', hex: '#2b3138' },
        { value: 'Azure', hex: '#1183c4' },
        { value: 'Ivory', hex: '#efe9dd' },
      ],
    },
  ],

  // All nine combinations, built below. The first entry is what the page opens
  // on; 200Ah/Ivory is out of stock so the disabled-swatch path is visible.
  variants: buildDemoVariants(),

  rating: {
    // Illustrative, like every other figure in this file. The rule against
    // inventing ratings (see `hostinger/map.ts` and `hostinger-provider.ts`)
    // binds the catalogue providers and is untouched: this fixture is fenced
    // behind `isDemoSlug()`, never returned by `catalog()`, and the page it
    // renders on carries a "Demonstration product" banner saying so.
    average: 4.6,
    count: 128,
    distribution: [2, 3, 9, 28, 86],
  },

  facets: {
    batteryAh: 150,
    technology: 'LiFePO4',
    backupHours: 6,
    warrantyMonths: 60,
    solarReady: true,
  },

  // Empty so the PDP skips the related and frequently-bought lookups entirely —
  // the demo product must not reach into the live catalogue for companions.
  frequentlyBoughtWith: [],
  relatedProductIds: [],

  launchedAt: '2026-01-15',
  popularityRank: 1,
};

/* ------------------------------------------------------------ demo reviews */

/**
 * Illustrative reviews for the demo product.
 *
 * Same fencing as `DEMO_PRODUCT.rating`: invented, never served by
 * `getReviews()`, and read only by the `/products/[slug]` route when the slug is the
 * demo one. Reviewers are identified by city and verification state alone, the
 * convention the real fixtures follow in `mock/reviews.ts`.
 */
export const DEMO_REVIEWS: Review[] = [
  {
    id: 'demo-rv-1',
    productId: 'demo-lifepower-150ah',
    rating: 5,
    title: 'Lights do not dim any more',
    body: 'We moved off a tubular battery that had started sagging badly by the second hour. This one holds the fans at full speed right up to the point it cuts off. The difference is obvious on the first evening.',
    city: 'Pune',
    verifiedPurchase: true,
    createdAt: '2026-07-18',
    helpfulCount: 31,
    hasPhotos: true,
  },
  {
    id: 'demo-rv-2',
    productId: 'demo-lifepower-150ah',
    rating: 5,
    title: 'Half the weight, and no maintenance',
    body: 'Wall-mounted it myself with the supplied bracket. Nothing to top up, no acid smell in the utility room, and the terminals have stayed clean through a full monsoon.',
    city: 'Kochi',
    verifiedPurchase: true,
    createdAt: '2026-06-02',
    helpfulCount: 22,
    hasPhotos: false,
  },
  {
    id: 'demo-rv-3',
    productId: 'demo-lifepower-150ah',
    rating: 4,
    title: 'Good pack, check your charger first',
    body: 'Works very well, but my old inverter had no lithium charge profile and I had to replace it. Worth saying that up front — the battery is not the whole cost if your inverter is older.',
    city: 'Jaipur',
    verifiedPurchase: true,
    createdAt: '2026-05-21',
    helpfulCount: 47,
    hasPhotos: false,
  },
  {
    id: 'demo-rv-4',
    productId: 'demo-lifepower-150ah',
    rating: 5,
    title: 'Pairs well with rooftop solar',
    body: 'Charging from an MPPT set to LiFePO4. Partial charging on cloudy days does not seem to bother it at all, which was the main thing I was worried about.',
    city: 'Ahmedabad',
    verifiedPurchase: true,
    createdAt: '2026-04-09',
    helpfulCount: 18,
    hasPhotos: true,
  },
  {
    id: 'demo-rv-5',
    productId: 'demo-lifepower-150ah',
    rating: 3,
    title: 'Fine, but the price is steep',
    body: 'No complaints about how it performs. It is roughly three times what a tubular of the same rating costs, and you only get that back if you actually keep it for the ten years.',
    city: 'Nagpur',
    verifiedPurchase: true,
    createdAt: '2026-03-27',
    helpfulCount: 39,
    hasPhotos: false,
  },
  {
    id: 'demo-rv-6',
    productId: 'demo-lifepower-150ah',
    rating: 4,
    title: 'Installation was quick',
    body: 'Technician arrived on the slot booked, set the charger profile and load-tested before leaving. Took about an hour. Knocking off a star because the wall bracket needed longer fixings than the ones supplied.',
    city: 'Coimbatore',
    verifiedPurchase: true,
    createdAt: '2026-02-14',
    helpfulCount: 11,
    hasPhotos: false,
  },
];
