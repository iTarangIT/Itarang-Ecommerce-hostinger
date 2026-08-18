import type {
  Availability,
  Paise,
  Product,
  ProductOption,
  ProductVariant,
  RatingSummary,
} from '../types';
import { artSet } from './art';

/* ------------------------------------------------------------------ helpers */

/** Rupees → paise. */
const rs = (rupees: number): Paise => Math.round(rupees * 100);

function availabilityFor(stock: number): Availability {
  if (stock <= 0) return 'out-of-stock';
  if (stock <= 5) return 'low-stock';
  return 'in-stock';
}

function rating(average: number, count: number, dist: [number, number, number, number, number]): RatingSummary {
  return { average, count, distribution: dist };
}

/** Single-SKU product with no buyer-facing options. */
function simpleVariant(
  sku: string,
  title: string,
  mrp: number,
  selling: number,
  stock: number,
): ProductVariant {
  return {
    id: `${sku}-default`,
    sku,
    title,
    optionValues: {},
    price: { mrp: rs(mrp), selling: rs(selling) },
    availability: availabilityFor(stock),
    stock,
  };
}

const WARRANTY_OPTION: ProductOption = {
  id: 'warranty',
  name: 'Warranty plan',
  values: ['Standard', 'Extended +2 years'],
};

/**
 * Inverters and UPS units are sold as one hardware SKU with an optional
 * extended warranty — a real second variant with its own price and stock.
 */
function warrantyVariants(
  sku: string,
  title: string,
  mrp: number,
  selling: number,
  stock: number,
  extendedDelta: number,
): ProductVariant[] {
  return [
    {
      id: `${sku}-std`,
      sku,
      title: `${title} — Standard warranty`,
      optionValues: { warranty: 'Standard' },
      price: { mrp: rs(mrp), selling: rs(selling) },
      availability: availabilityFor(stock),
      stock,
    },
    {
      id: `${sku}-ext`,
      sku: `${sku}-EW`,
      title: `${title} — Extended warranty`,
      optionValues: { warranty: 'Extended +2 years' },
      price: { mrp: rs(mrp + extendedDelta), selling: rs(selling + extendedDelta) },
      availability: availabilityFor(Math.max(0, stock - 3)),
      stock: Math.max(0, stock - 3),
    },
  ];
}

interface ComboVariantSpec {
  label: string;
  sku: string;
  mrp: number;
  selling: number;
  stock: number;
}

function comboVariants(specs: ComboVariantSpec[]): ProductVariant[] {
  return specs.map((s) => ({
    id: `${s.sku}-v`,
    sku: s.sku,
    title: s.label,
    optionValues: { battery: s.label },
    price: { mrp: rs(s.mrp), selling: rs(s.selling) },
    availability: availabilityFor(s.stock),
    stock: s.stock,
  }));
}

const INSTALL_LINE =
  'Installed by a certified iTarang technician. Installation is included in the price and booked after your order is confirmed.';

/* ----------------------------------------------------------------- catalogue
 *
 * Development mock catalogue.
 *
 * `itarang-inverter-900-va` mirrors the single product currently live on the
 * Hostinger storefront (title, subtitle, description, ₹8,500 price and SKU) so
 * the real listing is preserved. Every other entry is representative
 * development data with realistic specifications for the category. No pricing,
 * certification or performance claim here should be published without being
 * confirmed against the real product sheets.
 * -------------------------------------------------------------------------- */

export const PRODUCTS: Product[] = [
  /* ============================================================== INVERTERS */
  {
    id: 'itg-inv-lite-700',
    slug: 'itarang-sine-lite-700',
    title: 'iTarang Sine Lite 700',
    subtitle: '700VA pure sine wave inverter for single-room backup',
    category: 'inverters',
    subcategory: 'pure-sine-wave',
    art: 'inverter',
    images: artSet('inverter', 1),
    highlights: [
      'Pure sine wave output — safe for televisions, routers and laptop adapters',
      'Carries 2 fans, 4 LED lights and a router',
      'Wide input window of 110V–290V',
      'Silent changeover with no relay click',
    ],
    description: [
      'The Sine Lite 700 is the entry point to the iTarang pure sine wave range, sized for a single room, a study or a small shop counter. It runs a compact connected load cleanly, without the hum that modified sine wave units induce in fans and adapters.',
      'A single 12V battery drives the unit. The charger profile is selectable between tubular, flat plate and lithium, so the same inverter carries forward if you upgrade the battery chemistry later.',
    ],
    specGroups: [
      {
        title: 'Output',
        specs: [
          { label: 'Rated capacity', value: '700 VA' },
          { label: 'Waveform', value: 'Pure sine wave' },
          { label: 'Maximum continuous load', value: '560 W' },
          { label: 'Output voltage', value: '230V ± 5%' },
          { label: 'Changeover time', value: 'Under 20 ms' },
        ],
      },
      {
        title: 'Input & battery',
        specs: [
          { label: 'Input voltage range', value: '110V – 290V' },
          { label: 'Battery system', value: '12V, single battery' },
          { label: 'Supported capacity', value: '80Ah – 180Ah' },
          { label: 'Charger profiles', value: 'Tubular / Flat plate / Lithium' },
          { label: 'Charging current', value: '10A' },
        ],
      },
      {
        title: 'Physical',
        specs: [
          { label: 'Dimensions (W×D×H)', value: '265 × 230 × 115 mm' },
          { label: 'Weight', value: '6.8 kg' },
          { label: 'Mounting', value: 'Tabletop or wall bracket' },
          { label: 'Cooling', value: 'Natural convection' },
        ],
      },
    ],
    boxContents: ['Sine Lite 700 inverter unit', 'Battery cable set', 'Wall mounting bracket', 'Warranty card', 'Installation guide'],
    faqs: [
      {
        question: 'Will this run a refrigerator?',
        answer:
          'No. A domestic refrigerator draws a large start-up surge that a 700VA unit cannot absorb. Choose the Sine Pro 1500 or higher for refrigeration.',
      },
      {
        question: 'Can I use my existing battery?',
        answer:
          'Yes, provided it is a 12V battery between 80Ah and 180Ah. Your installer will set the charger profile to match its chemistry during commissioning.',
      },
      {
        question: 'How long does installation take?',
        answer:
          'A standard single-battery installation takes about 60–90 minutes including cable routing, commissioning and a load test.',
      },
    ],
    warrantyMonths: 24,
    installationIncluded: true,
    badges: ['sale'],
    options: [WARRANTY_OPTION],
    variants: warrantyVariants('ITG-INV-700', 'Sine Lite 700', 6499, 4999, 24, 1499),
    rating: rating(4.3, 41, [1, 2, 4, 12, 22]),
    facets: {
      capacityVa: 700,
      technology: 'Pure Sine Wave',
      warrantyMonths: 24,
      solarReady: false,
      phase: 'Single phase',
    },
    frequentlyBoughtWith: ['itg-bat-flat-100', 'itg-bat-smf-42'],
    relatedProductIds: ['itg-inv-pro-900', 'itg-inv-dups-850', 'itg-combo-studio-700'],
    launchedAt: '2025-02-18',
    popularityRank: 9,
  },
  {
    id: 'itg-inv-pro-900',
    slug: 'itarang-sine-pro-900',
    title: 'iTarang Sine Pro 900',
    subtitle: '900VA pure sine wave inverter for two and three bedroom homes',
    category: 'inverters',
    subcategory: 'pure-sine-wave',
    art: 'inverter',
    images: artSet('inverter', 2),
    highlights: [
      'Carries 4 fans, 6 LED lights, a television and a router',
      'Wide input protection from 100V to 290V',
      'Selectable charger profile for tubular, flat plate and lithium',
      'Overload, short-circuit and deep-discharge cut-offs',
    ],
    description: [
      'The Sine Pro 900 is the volume seller in the iTarang range and the default recommendation for a two or three bedroom home. It carries a full evening load — fans, lighting, a television, a router and phone charging — without strain.',
      'Wide input protection matters more than headline VA on unstable feeders. The Sine Pro 900 keeps regulating from 100V upward, so it continues charging through the brownouts that force narrower units onto battery unnecessarily.',
    ],
    specGroups: [
      {
        title: 'Output',
        specs: [
          { label: 'Rated capacity', value: '900 VA' },
          { label: 'Waveform', value: 'Pure sine wave' },
          { label: 'Maximum continuous load', value: '720 W' },
          { label: 'Peak surge capacity', value: '1400 W for 5 s' },
          { label: 'Output voltage', value: '230V ± 5%' },
          { label: 'Changeover time', value: 'Under 15 ms' },
        ],
      },
      {
        title: 'Input & battery',
        specs: [
          { label: 'Input voltage range', value: '100V – 290V' },
          { label: 'Battery system', value: '12V, single battery' },
          { label: 'Supported capacity', value: '100Ah – 220Ah' },
          { label: 'Charger profiles', value: 'Tubular / Flat plate / Lithium' },
          { label: 'Charging current', value: '15A, selectable' },
        ],
      },
      {
        title: 'Protection',
        specs: [
          { label: 'Overload', value: 'Automatic cut-off with retry' },
          { label: 'Short circuit', value: 'Electronic trip' },
          { label: 'Deep discharge', value: 'Configurable cut-off voltage' },
          { label: 'Reverse polarity', value: 'Fused' },
        ],
      },
      {
        title: 'Physical',
        specs: [
          { label: 'Dimensions (W×D×H)', value: '290 × 250 × 125 mm' },
          { label: 'Weight', value: '8.4 kg' },
          { label: 'Display', value: 'LED status panel' },
          { label: 'Cooling', value: 'Temperature-controlled fan' },
        ],
      },
    ],
    boxContents: ['Sine Pro 900 inverter unit', 'Battery cable set', 'Wall mounting bracket', 'Warranty card', 'Installation and sizing guide'],
    faqs: [
      {
        question: 'How many hours of backup will I get?',
        answer:
          'With a 150Ah battery on a typical four-fan, six-light load, expect roughly six to eight hours. Adding a television reduces that to around five. Use the load calculator for a figure based on your actual appliances.',
      },
      {
        question: 'Can I pair this with a lithium battery?',
        answer:
          'Yes. Set the charger profile to lithium during commissioning; your installer will do this. A 150Ah lithium pack roughly doubles usable capacity compared with the same nominal rating in lead acid.',
      },
      {
        question: 'Does it make noise?',
        answer:
          'The changeover is silent. The cooling fan runs only above a temperature threshold and is audible at close range under sustained heavy load.',
      },
    ],
    warrantyMonths: 36,
    installationIncluded: true,
    badges: ['bestseller', 'sale'],
    options: [WARRANTY_OPTION],
    variants: warrantyVariants('ITG-INV-900', 'Sine Pro 900', 8990, 6749, 46, 1699),
    rating: rating(4.6, 128, [2, 3, 9, 34, 80]),
    facets: {
      capacityVa: 900,
      technology: 'Pure Sine Wave',
      warrantyMonths: 36,
      solarReady: false,
      phase: 'Single phase',
    },
    frequentlyBoughtWith: ['itg-bat-tall-150', 'itg-bat-life-150'],
    relatedProductIds: ['itg-inv-pro-1100', 'itg-combo-home-900', 'itg-inv-lite-700'],
    launchedAt: '2024-11-04',
    popularityRank: 1,
  },
  {
    id: 'itg-inv-pro-1100',
    slug: 'itarang-sine-pro-1100',
    title: 'iTarang Sine Pro 1100',
    subtitle: '1100VA pure sine wave inverter with headroom for mixed loads',
    category: 'inverters',
    subcategory: 'pure-sine-wave',
    art: 'inverter',
    images: artSet('inverter', 3),
    highlights: [
      'Comfortable headroom over a full three-bedroom load',
      'Handles a mixer or small pump alongside fans and lighting',
      '20A charger recharges a 200Ah bank overnight',
      'Battery-agnostic charger with lithium profile',
    ],
    description: [
      'The Sine Pro 1100 sits a step above the 900 for homes that occasionally run a short high-draw appliance — a mixer grinder, a small pump, a soldering station — alongside the standard evening load.',
      'The larger 20A charger matters on feeders where mains supply returns only for short windows: a 200Ah bank recovers meaningfully in a two-hour grid window rather than needing a full night.',
    ],
    specGroups: [
      {
        title: 'Output',
        specs: [
          { label: 'Rated capacity', value: '1100 VA' },
          { label: 'Waveform', value: 'Pure sine wave' },
          { label: 'Maximum continuous load', value: '880 W' },
          { label: 'Peak surge capacity', value: '1800 W for 5 s' },
          { label: 'Changeover time', value: 'Under 15 ms' },
        ],
      },
      {
        title: 'Input & battery',
        specs: [
          { label: 'Input voltage range', value: '100V – 290V' },
          { label: 'Battery system', value: '12V, single battery' },
          { label: 'Supported capacity', value: '120Ah – 260Ah' },
          { label: 'Charging current', value: '20A, selectable' },
          { label: 'Charger profiles', value: 'Tubular / Flat plate / Lithium' },
        ],
      },
      {
        title: 'Physical',
        specs: [
          { label: 'Dimensions (W×D×H)', value: '300 × 255 × 130 mm' },
          { label: 'Weight', value: '9.6 kg' },
          { label: 'Display', value: 'LED status panel with load bar' },
        ],
      },
    ],
    boxContents: ['Sine Pro 1100 inverter unit', 'Battery cable set', 'Wall mounting bracket', 'Warranty card', 'Installation and sizing guide'],
    faqs: [
      {
        question: 'Is the 1100 worth the difference over the 900?',
        answer:
          'If your load is fans, lights and a television, the 900 is sufficient. Choose the 1100 if you expect to run a mixer, a pump or a second refrigerator circuit during an outage.',
      },
      {
        question: 'What battery should I pair with it?',
        answer:
          'A 150Ah to 200Ah battery balances the charger output well. Lithium at 150Ah gives more usable capacity than tubular at 200Ah, at a higher up-front cost.',
      },
    ],
    warrantyMonths: 36,
    installationIncluded: true,
    badges: ['sale'],
    options: [WARRANTY_OPTION],
    variants: warrantyVariants('ITG-INV-1100', 'Sine Pro 1100', 10990, 8299, 31, 1699),
    rating: rating(4.5, 86, [1, 3, 8, 26, 48]),
    facets: {
      capacityVa: 1100,
      technology: 'Pure Sine Wave',
      warrantyMonths: 36,
      solarReady: false,
      phase: 'Single phase',
    },
    frequentlyBoughtWith: ['itg-bat-life-150', 'itg-bat-tall-180'],
    relatedProductIds: ['itg-inv-pro-900', 'itg-inv-pro-1500', 'itg-combo-home-1100'],
    launchedAt: '2025-01-22',
    popularityRank: 3,
  },
  {
    id: 'itg-inv-pro-1500',
    slug: 'itarang-sine-pro-1500',
    title: 'iTarang Sine Pro 1500',
    subtitle: '1500VA pure sine wave inverter for homes with refrigeration',
    category: 'inverters',
    subcategory: 'pure-sine-wave',
    art: 'inverter',
    images: artSet('inverter', 1),
    highlights: [
      'Surge capacity sized for refrigerator and pump start-up',
      'Runs a full four-bedroom evening load',
      '25A charger with temperature compensation',
      'Configurable deep-discharge cut-off',
    ],
    description: [
      'The Sine Pro 1500 is specified for homes that need refrigeration to survive an outage. Compressor start-up draws several times the running current for a fraction of a second, and the 1500 carries a 2600W surge window to absorb it without tripping.',
      'Temperature-compensated charging adjusts the float voltage against ambient temperature, which measurably extends lead acid life in rooms that get hot through summer.',
    ],
    specGroups: [
      {
        title: 'Output',
        specs: [
          { label: 'Rated capacity', value: '1500 VA' },
          { label: 'Waveform', value: 'Pure sine wave' },
          { label: 'Maximum continuous load', value: '1200 W' },
          { label: 'Peak surge capacity', value: '2600 W for 5 s' },
          { label: 'Changeover time', value: 'Under 15 ms' },
        ],
      },
      {
        title: 'Input & battery',
        specs: [
          { label: 'Input voltage range', value: '100V – 290V' },
          { label: 'Battery system', value: '12V, single battery' },
          { label: 'Supported capacity', value: '150Ah – 260Ah' },
          { label: 'Charging current', value: '25A with temperature compensation' },
        ],
      },
      {
        title: 'Physical',
        specs: [
          { label: 'Dimensions (W×D×H)', value: '320 × 270 × 140 mm' },
          { label: 'Weight', value: '12.1 kg' },
          { label: 'Cooling', value: 'Dual temperature-controlled fans' },
        ],
      },
    ],
    boxContents: ['Sine Pro 1500 inverter unit', 'Heavy-gauge battery cable set', 'Wall mounting bracket', 'Warranty card', 'Installation and sizing guide'],
    faqs: [
      {
        question: 'Will it start a 1 HP water pump?',
        answer:
          'A 1 HP pump draws roughly 750W running and can surge past 2200W on start. The Sine Pro 1500 handles this provided the pump is not started simultaneously with a refrigerator compressor.',
      },
      {
        question: 'Do I need a bigger battery for this inverter?',
        answer:
          'The inverter sets what you can run; the battery sets for how long. A 220Ah tubular or 200Ah lithium bank suits this unit for a full-evening runtime with refrigeration.',
      },
    ],
    warrantyMonths: 36,
    installationIncluded: true,
    badges: ['premium'],
    options: [WARRANTY_OPTION],
    variants: warrantyVariants('ITG-INV-1500', 'Sine Pro 1500', 14490, 11299, 18, 1999),
    rating: rating(4.7, 63, [0, 1, 4, 16, 42]),
    facets: {
      capacityVa: 1500,
      technology: 'Pure Sine Wave',
      warrantyMonths: 36,
      solarReady: false,
      phase: 'Single phase',
    },
    frequentlyBoughtWith: ['itg-bat-tall-220', 'itg-bat-life-200'],
    relatedProductIds: ['itg-inv-pro-1100', 'itg-inv-max-2200', 'itg-combo-home-1500'],
    launchedAt: '2025-03-11',
    popularityRank: 5,
  },
  {
    id: 'itg-inv-max-2200',
    slug: 'itarang-sine-max-2200',
    title: 'iTarang Sine Max 2200',
    subtitle: '2200VA / 24V pure sine wave inverter for large homes and shops',
    category: 'inverters',
    subcategory: 'high-capacity',
    art: 'inverter',
    images: artSet('inverter', 2),
    highlights: [
      '24V two-battery bank keeps cable losses low',
      'Carries refrigeration, lighting and billing equipment together',
      '30A charger for fast bank recovery',
      'Certified installation on a dedicated circuit included',
    ],
    description: [
      'At 2200VA the Sine Max moves to a 24V two-battery architecture. Doubling the bank voltage halves the current for the same delivered power, which keeps cable heating, voltage drop and connector wear under control on a system that runs long hours.',
      'This is the family for a retail counter, a clinic reception or a large home with a borewell pump. Installation on a correctly rated dedicated circuit is included.',
    ],
    specGroups: [
      {
        title: 'Output',
        specs: [
          { label: 'Rated capacity', value: '2200 VA' },
          { label: 'Waveform', value: 'Pure sine wave' },
          { label: 'Maximum continuous load', value: '1760 W' },
          { label: 'Peak surge capacity', value: '3800 W for 5 s' },
        ],
      },
      {
        title: 'Input & battery',
        specs: [
          { label: 'Input voltage range', value: '100V – 290V' },
          { label: 'Battery system', value: '24V, two batteries in series' },
          { label: 'Supported capacity', value: '150Ah – 260Ah per battery' },
          { label: 'Charging current', value: '30A' },
        ],
      },
      {
        title: 'Physical',
        specs: [
          { label: 'Dimensions (W×D×H)', value: '380 × 300 × 160 mm' },
          { label: 'Weight', value: '17.4 kg' },
          { label: 'Mounting', value: 'Floor or heavy-duty wall bracket' },
        ],
      },
    ],
    boxContents: ['Sine Max 2200 inverter unit', 'Heavy-gauge interconnect and battery cables', 'Floor stand', 'Warranty card', 'Installation guide'],
    faqs: [
      {
        question: 'Can I run it on a single battery?',
        answer: 'No. A 24V system requires two matched batteries in series, purchased and replaced as a pair.',
      },
      {
        question: 'Do both batteries need to be the same model?',
        answer:
          'Yes. Mixing capacity, chemistry or age in a series bank causes uneven charging and shortens the life of both units.',
      },
    ],
    warrantyMonths: 36,
    installationIncluded: true,
    badges: ['premium'],
    options: [WARRANTY_OPTION],
    variants: warrantyVariants('ITG-INV-2200', 'Sine Max 2200', 19990, 15999, 9, 2499),
    rating: rating(4.5, 34, [0, 1, 3, 9, 21]),
    facets: {
      capacityVa: 2200,
      technology: 'Pure Sine Wave',
      warrantyMonths: 36,
      solarReady: false,
      phase: 'Single phase',
    },
    frequentlyBoughtWith: ['itg-bat-tall-180', 'itg-bat-tall-220'],
    relatedProductIds: ['itg-inv-max-3500', 'itg-inv-pro-1500', 'itg-combo-shop-2200'],
    launchedAt: '2025-04-08',
    popularityRank: 8,
  },
  {
    id: 'itg-inv-max-3500',
    slug: 'itarang-sine-max-3500',
    title: 'iTarang Sine Max 3500',
    subtitle: '3500VA / 48V pure sine wave inverter for workshops and large premises',
    category: 'inverters',
    subcategory: 'high-capacity',
    art: 'inverter',
    images: artSet('inverter', 3),
    highlights: [
      '48V four-battery bank for sustained heavy load',
      'Handles workshop tools and multiple refrigeration circuits',
      '40A charger with bank balancing',
      'Site survey included before installation',
    ],
    description: [
      'The Sine Max 3500 is the largest single-phase inverter in the iTarang range, built for workshops, small manufacturing units and premises running several heavy circuits simultaneously.',
      'A 48V four-battery bank keeps current draw manageable at full output. Because bank sizing, cable gauge and circuit segregation all matter at this capacity, a site survey is carried out before installation is scheduled.',
    ],
    specGroups: [
      {
        title: 'Output',
        specs: [
          { label: 'Rated capacity', value: '3500 VA' },
          { label: 'Waveform', value: 'Pure sine wave' },
          { label: 'Maximum continuous load', value: '2800 W' },
          { label: 'Peak surge capacity', value: '6000 W for 5 s' },
        ],
      },
      {
        title: 'Input & battery',
        specs: [
          { label: 'Battery system', value: '48V, four batteries in series' },
          { label: 'Supported capacity', value: '150Ah – 260Ah per battery' },
          { label: 'Charging current', value: '40A' },
          { label: 'Bank management', value: 'Per-string voltage monitoring' },
        ],
      },
      {
        title: 'Physical',
        specs: [
          { label: 'Dimensions (W×D×H)', value: '440 × 340 × 190 mm' },
          { label: 'Weight', value: '26.8 kg' },
          { label: 'Mounting', value: 'Floor standing' },
        ],
      },
    ],
    boxContents: ['Sine Max 3500 inverter unit', 'Bank interconnect cable set', 'Floor stand', 'Warranty card', 'Installation and commissioning guide'],
    faqs: [
      {
        question: 'Is a site survey mandatory?',
        answer:
          'Yes, for this capacity. Our engineer confirms incoming supply rating, cable runs, battery room ventilation and circuit segregation before installation is booked.',
      },
      {
        question: 'Can it run three-phase equipment?',
        answer: 'No. This is a single-phase system. Three-phase requirements need a different configuration — contact our engineers.',
      },
    ],
    warrantyMonths: 36,
    installationIncluded: true,
    badges: ['premium', 'low-stock'],
    options: [WARRANTY_OPTION],
    variants: warrantyVariants('ITG-INV-3500', 'Sine Max 3500', 28990, 23499, 4, 3499),
    rating: rating(4.8, 12, [0, 0, 1, 1, 10]),
    facets: {
      capacityVa: 3500,
      technology: 'Pure Sine Wave',
      warrantyMonths: 36,
      solarReady: false,
      phase: 'Single phase',
    },
    frequentlyBoughtWith: ['itg-bat-tall-220'],
    relatedProductIds: ['itg-inv-max-2200', 'itg-ups-online-2k'],
    launchedAt: '2025-06-02',
    popularityRank: 14,
  },
  {
    id: 'itg-inv-dups-850',
    slug: 'itarang-digi-ups-850',
    title: 'iTarang Digi UPS 850',
    subtitle: '850VA digital UPS inverter with sub-10ms changeover',
    category: 'inverters',
    subcategory: 'digital-ups',
    art: 'inverter',
    images: artSet('inverter', 1),
    highlights: [
      'Changeover under 10 ms — desktops do not reboot',
      'Home inverter runtime with computer UPS transfer speed',
      'Suits home offices, reception desks and NVR cabinets',
      'Pure sine wave output throughout',
    ],
    description: [
      'A digital UPS bridges two product categories: it holds a household battery for hours of runtime, but transfers fast enough that a desktop computer, network switch or camera recorder never sees an interruption.',
      'If your work-from-home setup shares a circuit with normal household load, this is the correct inverter family — a standard home inverter transfers too slowly to protect a desktop power supply.',
    ],
    specGroups: [
      {
        title: 'Output',
        specs: [
          { label: 'Rated capacity', value: '850 VA' },
          { label: 'Waveform', value: 'Pure sine wave' },
          { label: 'Maximum continuous load', value: '680 W' },
          { label: 'Changeover time', value: 'Under 10 ms' },
        ],
      },
      {
        title: 'Input & battery',
        specs: [
          { label: 'Input voltage range', value: '110V – 290V' },
          { label: 'Battery system', value: '12V, single battery' },
          { label: 'Supported capacity', value: '100Ah – 200Ah' },
          { label: 'Charging current', value: '15A' },
        ],
      },
    ],
    boxContents: ['Digi UPS 850 unit', 'Battery cable set', 'Wall mounting bracket', 'Warranty card'],
    faqs: [
      {
        question: 'Is this the same as a computer UPS?',
        answer:
          'It transfers as fast as one, but holds a much larger external battery. A desktop UPS gives you minutes; this gives you hours, on the same equipment.',
      },
    ],
    warrantyMonths: 24,
    installationIncluded: true,
    badges: ['sale'],
    options: [WARRANTY_OPTION],
    variants: warrantyVariants('ITG-DUPS-850', 'Digi UPS 850', 7990, 5999, 22, 1499),
    rating: rating(4.4, 57, [1, 2, 6, 18, 30]),
    facets: {
      capacityVa: 850,
      technology: 'Digital UPS',
      warrantyMonths: 24,
      solarReady: false,
      phase: 'Single phase',
    },
    frequentlyBoughtWith: ['itg-bat-tall-150', 'itg-bat-flat-100'],
    relatedProductIds: ['itg-inv-dups-1250', 'itg-ups-home-1000', 'itg-inv-pro-900'],
    launchedAt: '2025-02-02',
    popularityRank: 7,
  },
  {
    id: 'itg-inv-dups-1250',
    slug: 'itarang-digi-ups-1250',
    title: 'iTarang Digi UPS 1250',
    subtitle: '1250VA digital UPS inverter for multi-workstation setups',
    category: 'inverters',
    subcategory: 'digital-ups',
    art: 'inverter',
    images: artSet('inverter', 2),
    highlights: [
      'Runs two workstations plus network and lighting',
      'Sub-10 ms changeover across the whole load',
      'Load-priority output so critical sockets hold longest',
      '20A charger for short grid windows',
    ],
    description: [
      'The Digi UPS 1250 extends fast-transfer protection across a small office: two workstations, a network rack, a printer on standby and the room lighting, all on one system.',
      'Load-priority output lets your installer designate a critical socket group that stays powered longest as the battery depletes.',
    ],
    specGroups: [
      {
        title: 'Output',
        specs: [
          { label: 'Rated capacity', value: '1250 VA' },
          { label: 'Waveform', value: 'Pure sine wave' },
          { label: 'Maximum continuous load', value: '1000 W' },
          { label: 'Changeover time', value: 'Under 10 ms' },
          { label: 'Load priority', value: 'Two output groups' },
        ],
      },
      {
        title: 'Input & battery',
        specs: [
          { label: 'Battery system', value: '12V, single battery' },
          { label: 'Supported capacity', value: '150Ah – 220Ah' },
          { label: 'Charging current', value: '20A' },
        ],
      },
    ],
    boxContents: ['Digi UPS 1250 unit', 'Battery cable set', 'Wall mounting bracket', 'Warranty card'],
    faqs: [
      {
        question: 'What is load priority?',
        answer:
          'Your outputs are split into two groups. As the battery approaches its cut-off, the non-critical group is shed first, extending runtime on the group carrying your computers.',
      },
    ],
    warrantyMonths: 24,
    installationIncluded: true,
    badges: [],
    options: [WARRANTY_OPTION],
    variants: warrantyVariants('ITG-DUPS-1250', 'Digi UPS 1250', 11490, 8999, 14, 1699),
    rating: rating(4.5, 29, [0, 1, 2, 9, 17]),
    facets: {
      capacityVa: 1250,
      technology: 'Digital UPS',
      warrantyMonths: 24,
      solarReady: false,
      phase: 'Single phase',
    },
    frequentlyBoughtWith: ['itg-bat-tall-180'],
    relatedProductIds: ['itg-inv-dups-850', 'itg-ups-online-1k'],
    launchedAt: '2025-05-19',
    popularityRank: 12,
  },
  {
    id: 'itg-inv-solar-1100',
    slug: 'itarang-solaris-1100',
    title: 'iTarang Solaris 1100',
    subtitle: '1100VA solar-ready inverter with integrated charge controller',
    category: 'inverters',
    subcategory: 'solar-ready',
    art: 'inverter',
    images: artSet('inverter', 3),
    highlights: [
      'Built-in PWM solar charge controller',
      'Prioritises panel charging over grid charging',
      'Accepts up to 1000Wp of panel array',
      'Runs on grid alone until you add panels',
    ],
    description: [
      'The Solaris 1100 is a normal pure sine wave home inverter with a solar charge controller built in. Buy it now, run it on grid charging, and add panels whenever you are ready — without replacing the inverter.',
      'When panels are connected the controller charges the battery from the array first and only draws grid power to finish the cycle, which is where the running-cost saving comes from.',
    ],
    specGroups: [
      {
        title: 'Output',
        specs: [
          { label: 'Rated capacity', value: '1100 VA' },
          { label: 'Waveform', value: 'Pure sine wave' },
          { label: 'Maximum continuous load', value: '880 W' },
        ],
      },
      {
        title: 'Solar input',
        specs: [
          { label: 'Controller type', value: 'PWM' },
          { label: 'Maximum array', value: '1000 Wp' },
          { label: 'Open circuit voltage', value: 'Up to 45V' },
          { label: 'Charging priority', value: 'Solar first, grid top-up' },
        ],
      },
      {
        title: 'Battery',
        specs: [
          { label: 'Battery system', value: '12V, single battery' },
          { label: 'Supported capacity', value: '120Ah – 260Ah' },
          { label: 'Recommended chemistry', value: 'Lithium for daily partial cycling' },
        ],
      },
    ],
    boxContents: ['Solaris 1100 inverter unit', 'Battery cable set', 'Solar input connector set', 'Wall mounting bracket', 'Warranty card'],
    faqs: [
      {
        question: 'Can I use it without solar panels?',
        answer:
          'Yes. It functions as a standard grid-charged pure sine wave inverter until an array is connected.',
      },
      {
        question: 'How many panels do I need?',
        answer:
          'That depends on your daily consumption and roof orientation, and is specified by your installer at survey. The inverter accepts up to 1000Wp.',
      },
      {
        question: 'Which battery works best with solar?',
        answer:
          'Lithium. Solar charging produces daily partial cycles, which lead acid tolerates poorly over time and LiFePO4 handles without measurable degradation.',
      },
    ],
    warrantyMonths: 36,
    installationIncluded: true,
    badges: ['new'],
    options: [WARRANTY_OPTION],
    variants: warrantyVariants('ITG-SOL-1100', 'Solaris 1100', 13990, 10999, 16, 1999),
    rating: rating(4.4, 22, [0, 1, 2, 6, 13]),
    facets: {
      capacityVa: 1100,
      technology: 'Solar Hybrid',
      warrantyMonths: 36,
      solarReady: true,
      phase: 'Single phase',
    },
    frequentlyBoughtWith: ['itg-bat-life-150', 'itg-bat-life-200'],
    relatedProductIds: ['itg-inv-solar-2000', 'itg-combo-solar-1100', 'itg-inv-pro-1100'],
    launchedAt: '2025-07-14',
    popularityRank: 10,
  },
  {
    id: 'itg-inv-solar-2000',
    slug: 'itarang-solaris-2000',
    title: 'iTarang Solaris 2000',
    subtitle: '2000VA / 24V solar hybrid inverter with MPPT controller',
    category: 'inverters',
    subcategory: 'solar-ready',
    art: 'inverter',
    images: artSet('inverter', 1),
    highlights: [
      'MPPT controller extracts more from the same array',
      '24V bank for larger daily consumption',
      'Accepts up to 2000Wp of panels',
      'Grid, solar and battery priority is configurable',
    ],
    description: [
      'The Solaris 2000 replaces the PWM controller of the smaller unit with MPPT tracking, which extracts meaningfully more energy from the same array — particularly in low light and at high panel temperature.',
      'Source priority is configurable, so you can choose whether the load runs from solar, battery or grid first at different times of day.',
    ],
    specGroups: [
      {
        title: 'Output',
        specs: [
          { label: 'Rated capacity', value: '2000 VA' },
          { label: 'Waveform', value: 'Pure sine wave' },
          { label: 'Maximum continuous load', value: '1600 W' },
        ],
      },
      {
        title: 'Solar input',
        specs: [
          { label: 'Controller type', value: 'MPPT' },
          { label: 'Maximum array', value: '2000 Wp' },
          { label: 'MPPT voltage range', value: '60V – 115V' },
          { label: 'Source priority', value: 'Configurable solar / battery / grid' },
        ],
      },
      {
        title: 'Battery',
        specs: [
          { label: 'Battery system', value: '24V, two batteries in series' },
          { label: 'Recommended chemistry', value: 'LiFePO4' },
        ],
      },
    ],
    boxContents: ['Solaris 2000 inverter unit', 'Battery and interconnect cables', 'Solar input connector set', 'Floor stand', 'Warranty card'],
    faqs: [
      {
        question: 'Is MPPT worth the extra cost over PWM?',
        answer:
          'On arrays above roughly 1000Wp, yes. MPPT tracks the array’s optimum operating point continuously and typically recovers noticeably more energy per day than PWM on the same panels.',
      },
    ],
    warrantyMonths: 36,
    installationIncluded: true,
    badges: ['new', 'premium'],
    options: [WARRANTY_OPTION],
    variants: warrantyVariants('ITG-SOL-2000', 'Solaris 2000', 21990, 17499, 7, 2499),
    rating: null,
    facets: {
      capacityVa: 2000,
      technology: 'Solar Hybrid',
      warrantyMonths: 36,
      solarReady: true,
      phase: 'Single phase',
    },
    frequentlyBoughtWith: ['itg-bat-life-200'],
    relatedProductIds: ['itg-inv-solar-1100', 'itg-inv-max-2200'],
    launchedAt: '2025-08-01',
    popularityRank: 17,
  },

  /* ============================================================== BATTERIES */
  {
    id: 'itg-bat-life-100',
    slug: 'itarang-life-100-lithium',
    title: 'iTarang LiFe 100',
    subtitle: '100Ah LiFePO4 lithium battery with integrated BMS',
    category: 'batteries',
    subcategory: 'lithium',
    art: 'battery',
    images: artSet('battery', 1),
    highlights: [
      'Around a third the weight of an equivalent lead acid battery',
      'No water topping up, no ventilated trolley',
      'Deep discharge without the capacity penalty of lead acid',
      'Integrated BMS with cell balancing and temperature cut-off',
    ],
    description: [
      'The LiFe 100 is the entry point to iTarang lithium storage. Usable capacity is considerably higher than the nominal comparison with lead acid suggests, because LiFePO4 tolerates deep discharge that would damage a tubular battery.',
      'The integrated battery management system handles cell balancing, over-charge and over-discharge protection and high-temperature cut-off, so no external monitoring is required.',
    ],
    specGroups: [
      {
        title: 'Electrical',
        specs: [
          { label: 'Nominal capacity', value: '100 Ah' },
          { label: 'Nominal voltage', value: '12.8 V' },
          { label: 'Chemistry', value: 'Lithium iron phosphate (LiFePO4)' },
          { label: 'Recommended depth of discharge', value: 'Up to 90%' },
          { label: 'Maximum charge current', value: '50 A' },
        ],
      },
      {
        title: 'Protection',
        specs: [
          { label: 'BMS', value: 'Integrated, with cell balancing' },
          { label: 'Over-discharge', value: 'Automatic cut-off' },
          { label: 'Temperature', value: 'Charge inhibit below 0°C' },
          { label: 'Short circuit', value: 'Electronic protection' },
        ],
      },
      {
        title: 'Physical',
        specs: [
          { label: 'Dimensions (L×W×H)', value: '330 × 172 × 215 mm' },
          { label: 'Weight', value: '11.4 kg' },
          { label: 'Terminals', value: 'M8 threaded' },
          { label: 'Maintenance', value: 'None required' },
        ],
      },
    ],
    boxContents: ['LiFe 100 battery', 'Terminal hardware set', 'Warranty card', 'Safety and handling sheet'],
    faqs: [
      {
        question: 'Will my existing inverter charge it correctly?',
        answer:
          'Only if it has a lithium charger profile. All current iTarang inverters do. Older or third-party units may need their profile checked by a technician before connection.',
      },
      {
        question: 'How does 100Ah lithium compare with 150Ah tubular?',
        answer:
          'Usable energy is comparable, because lithium can be discharged far deeper without damage. Lithium also weighs less, charges faster and lasts considerably more cycles — at a higher purchase price.',
      },
    ],
    warrantyMonths: 60,
    installationIncluded: true,
    badges: ['premium'],
    options: [],
    variants: [simpleVariant('ITG-BAT-LI-100', 'iTarang LiFe 100', 32990, 26499, 12)],
    rating: rating(4.7, 44, [0, 1, 2, 9, 32]),
    facets: {
      batteryAh: 100,
      technology: 'LiFePO4',
      backupHours: 5,
      warrantyMonths: 60,
    },
    frequentlyBoughtWith: ['itg-inv-pro-900', 'itg-inv-solar-1100'],
    relatedProductIds: ['itg-bat-life-150', 'itg-bat-life-200', 'itg-bat-tall-150'],
    launchedAt: '2025-01-08',
    popularityRank: 11,
  },
  {
    id: 'itg-bat-life-150',
    slug: 'itarang-life-150-lithium',
    title: 'iTarang LiFe 150',
    subtitle: '150Ah LiFePO4 lithium battery for full-evening backup',
    category: 'batteries',
    subcategory: 'lithium',
    art: 'battery',
    images: artSet('battery', 2),
    highlights: [
      'Roughly 7–9 hours on a four-fan, six-light load',
      'Maintenance-free with integrated BMS',
      'Charges roughly twice as fast as tubular',
      'Suited to daily partial cycling from solar',
    ],
    description: [
      'The LiFe 150 is the most commonly specified lithium pack in the iTarang range, paired with the Sine Pro 900 and 1100 for homes that want a full evening of backup without a battery trolley or water topping.',
      'Because LiFePO4 tolerates daily partial cycles without measurable degradation, this is also the correct battery for a solar-charged system.',
    ],
    specGroups: [
      {
        title: 'Electrical',
        specs: [
          { label: 'Nominal capacity', value: '150 Ah' },
          { label: 'Nominal voltage', value: '12.8 V' },
          { label: 'Chemistry', value: 'Lithium iron phosphate (LiFePO4)' },
          { label: 'Recommended depth of discharge', value: 'Up to 90%' },
          { label: 'Maximum charge current', value: '75 A' },
        ],
      },
      {
        title: 'Physical',
        specs: [
          { label: 'Dimensions (L×W×H)', value: '405 × 175 × 225 mm' },
          { label: 'Weight', value: '16.2 kg' },
          { label: 'Terminals', value: 'M8 threaded' },
          { label: 'Maintenance', value: 'None required' },
        ],
      },
    ],
    boxContents: ['LiFe 150 battery', 'Terminal hardware set', 'Warranty card', 'Safety and handling sheet'],
    faqs: [
      {
        question: 'Does it need a battery trolley?',
        answer:
          'No. There is no electrolyte to spill and no venting requirement, so it can sit on a shelf or floor mount close to the inverter.',
      },
    ],
    warrantyMonths: 60,
    installationIncluded: true,
    badges: ['bestseller'],
    options: [],
    variants: [simpleVariant('ITG-BAT-LI-150', 'iTarang LiFe 150', 44990, 36999, 15)],
    rating: rating(4.8, 91, [0, 1, 3, 14, 73]),
    facets: {
      batteryAh: 150,
      technology: 'LiFePO4',
      backupHours: 8,
      warrantyMonths: 60,
    },
    frequentlyBoughtWith: ['itg-inv-pro-1100', 'itg-inv-solar-1100'],
    relatedProductIds: ['itg-bat-life-100', 'itg-bat-life-200', 'itg-combo-home-1100'],
    launchedAt: '2024-12-12',
    popularityRank: 2,
  },
  {
    id: 'itg-bat-life-200',
    slug: 'itarang-life-200-lithium',
    title: 'iTarang LiFe 200',
    subtitle: '200Ah LiFePO4 lithium battery for large homes and solar systems',
    category: 'batteries',
    subcategory: 'lithium',
    art: 'battery',
    images: artSet('battery', 3),
    highlights: [
      'Carries refrigeration through a long outage',
      'Highest usable capacity in the iTarang lithium range',
      'Parallel-capable for larger banks',
      'Integrated BMS with per-cell balancing',
    ],
    description: [
      'The LiFe 200 is specified for large homes running refrigeration through extended outages, and for solar systems where the daily cycle depth matters more than the purchase price.',
      'Units can be paralleled to build a larger bank; your installer will confirm the configuration against your inverter’s charge current.',
    ],
    specGroups: [
      {
        title: 'Electrical',
        specs: [
          { label: 'Nominal capacity', value: '200 Ah' },
          { label: 'Nominal voltage', value: '12.8 V' },
          { label: 'Chemistry', value: 'Lithium iron phosphate (LiFePO4)' },
          { label: 'Maximum charge current', value: '100 A' },
          { label: 'Parallel capable', value: 'Yes, up to 4 units' },
        ],
      },
      {
        title: 'Physical',
        specs: [
          { label: 'Dimensions (L×W×H)', value: '480 × 180 × 240 mm' },
          { label: 'Weight', value: '21.5 kg' },
          { label: 'Terminals', value: 'M8 threaded' },
        ],
      },
    ],
    boxContents: ['LiFe 200 battery', 'Terminal hardware set', 'Warranty card', 'Safety and handling sheet'],
    faqs: [
      {
        question: 'Can I add a second unit later?',
        answer:
          'Yes, up to four in parallel. Adding a much newer unit to a heavily used one is not recommended — banks perform best when units are of similar age and cycle count.',
      },
    ],
    warrantyMonths: 60,
    installationIncluded: true,
    badges: ['premium'],
    options: [],
    variants: [simpleVariant('ITG-BAT-LI-200', 'iTarang LiFe 200', 56990, 47499, 6)],
    rating: rating(4.6, 27, [0, 1, 1, 7, 18]),
    facets: {
      batteryAh: 200,
      technology: 'LiFePO4',
      backupHours: 11,
      warrantyMonths: 60,
    },
    frequentlyBoughtWith: ['itg-inv-pro-1500', 'itg-inv-solar-2000'],
    relatedProductIds: ['itg-bat-life-150', 'itg-bat-tall-220'],
    launchedAt: '2025-03-27',
    popularityRank: 15,
  },
  {
    id: 'itg-bat-tall-150',
    slug: 'itarang-talltube-150',
    title: 'iTarang TallTube 150',
    subtitle: '150Ah C20 tall tubular battery for daily deep cycling',
    category: 'batteries',
    subcategory: 'tall-tubular',
    art: 'battery',
    images: artSet('battery', 1),
    highlights: [
      'Thick tubular positive plates for repeated deep discharge',
      'Large electrolyte reserve extends topping-up interval',
      'The value choice for long, frequent outages',
      'Shipped in a protective crate',
    ],
    description: [
      'Tall tubular construction is the long-standing answer to areas where the grid fails for hours at a time, several times a week. Thick gauntlet-protected plates and a tall electrolyte column tolerate the repeated deep cycling that would exhaust a flat plate battery quickly.',
      'The TallTube 150 pairs naturally with the Sine Pro 900 and is the most cost-effective route to a full evening of backup.',
    ],
    specGroups: [
      {
        title: 'Electrical',
        specs: [
          { label: 'Nominal capacity', value: '150 Ah at C20' },
          { label: 'Nominal voltage', value: '12 V' },
          { label: 'Technology', value: 'Tall tubular, flooded lead acid' },
          { label: 'Recommended depth of discharge', value: 'Up to 60%' },
        ],
      },
      {
        title: 'Physical',
        specs: [
          { label: 'Dimensions (L×W×H)', value: '505 × 190 × 410 mm' },
          { label: 'Weight', value: '48.5 kg (filled)' },
          { label: 'Electrolyte reserve', value: 'High' },
          { label: 'Ventilation', value: 'Required — install on a trolley in a ventilated space' },
        ],
      },
      {
        title: 'Maintenance',
        specs: [
          { label: 'Topping up', value: 'Distilled water, roughly every 4–6 months' },
          { label: 'Level indicators', value: 'Float indicators on each cell' },
        ],
      },
    ],
    boxContents: ['TallTube 150 battery in protective crate', 'Terminal hardware set', 'Float indicators fitted', 'Warranty card', 'Maintenance guide'],
    faqs: [
      {
        question: 'How often do I need to top up the water?',
        answer:
          'Typically every four to six months, depending on ambient temperature and how deeply the battery is cycled. The float indicators show when a cell needs attention.',
      },
      {
        question: 'Can it go inside the house?',
        answer:
          'It needs ventilation. A balcony, utility area or ventilated store is appropriate. It should not be enclosed in a sealed cupboard or placed in a bedroom.',
      },
    ],
    warrantyMonths: 42,
    installationIncluded: true,
    badges: ['bestseller', 'sale'],
    options: [],
    variants: [simpleVariant('ITG-BAT-TT-150', 'iTarang TallTube 150', 16490, 13299, 38)],
    rating: rating(4.4, 152, [4, 6, 14, 46, 82]),
    facets: {
      batteryAh: 150,
      technology: 'Tall Tubular',
      backupHours: 6,
      warrantyMonths: 42,
    },
    frequentlyBoughtWith: ['itg-inv-pro-900', 'itg-inv-dups-850'],
    relatedProductIds: ['itg-bat-tall-180', 'itg-bat-tall-220', 'itg-bat-life-150'],
    launchedAt: '2024-10-15',
    popularityRank: 4,
  },
  {
    id: 'itg-bat-tall-180',
    slug: 'itarang-talltube-180',
    title: 'iTarang TallTube 180',
    subtitle: '180Ah C20 tall tubular battery for extended outages',
    category: 'batteries',
    subcategory: 'tall-tubular',
    art: 'battery',
    images: artSet('battery', 2),
    highlights: [
      'A step up in runtime over the 150Ah at modest extra cost',
      'Suits 1100VA and 1250VA inverters',
      'Long topping-up interval',
      'Shipped in a protective crate',
    ],
    description: [
      'The TallTube 180 is the natural pairing for the Sine Pro 1100 and Digi UPS 1250 — enough capacity to carry a mixed load through a long evening outage without pushing the battery past a healthy depth of discharge.',
    ],
    specGroups: [
      {
        title: 'Electrical',
        specs: [
          { label: 'Nominal capacity', value: '180 Ah at C20' },
          { label: 'Nominal voltage', value: '12 V' },
          { label: 'Technology', value: 'Tall tubular, flooded lead acid' },
        ],
      },
      {
        title: 'Physical',
        specs: [
          { label: 'Dimensions (L×W×H)', value: '505 × 190 × 440 mm' },
          { label: 'Weight', value: '55.2 kg (filled)' },
          { label: 'Ventilation', value: 'Required' },
        ],
      },
    ],
    boxContents: ['TallTube 180 battery in protective crate', 'Terminal hardware set', 'Warranty card', 'Maintenance guide'],
    faqs: [
      {
        question: 'Is 180Ah noticeably better than 150Ah?',
        answer:
          'It gives roughly 20% more runtime on the same load. On a heavily used system that also means each cycle is shallower, which extends service life.',
      },
    ],
    warrantyMonths: 42,
    installationIncluded: true,
    badges: [],
    options: [],
    variants: [simpleVariant('ITG-BAT-TT-180', 'iTarang TallTube 180', 18990, 15299, 26)],
    rating: rating(4.3, 68, [2, 3, 8, 22, 33]),
    facets: {
      batteryAh: 180,
      technology: 'Tall Tubular',
      backupHours: 7,
      warrantyMonths: 42,
    },
    frequentlyBoughtWith: ['itg-inv-pro-1100', 'itg-inv-max-2200'],
    relatedProductIds: ['itg-bat-tall-150', 'itg-bat-tall-220'],
    launchedAt: '2024-11-28',
    popularityRank: 6,
  },
  {
    id: 'itg-bat-tall-220',
    slug: 'itarang-talltube-220',
    title: 'iTarang TallTube 220',
    subtitle: '220Ah C20 tall tubular battery for large homes and shops',
    category: 'batteries',
    subcategory: 'tall-tubular',
    art: 'battery',
    images: artSet('battery', 3),
    highlights: [
      'Highest capacity tubular unit in the range',
      'Carries refrigeration through a long outage',
      'Used in pairs for 24V systems',
      'Shipped in a protective crate',
    ],
    description: [
      'The TallTube 220 is specified for large homes with refrigeration, and used in matched pairs on the 24V Sine Max 2200. It gives the longest runtime available from lead acid in the iTarang range.',
    ],
    specGroups: [
      {
        title: 'Electrical',
        specs: [
          { label: 'Nominal capacity', value: '220 Ah at C20' },
          { label: 'Nominal voltage', value: '12 V' },
          { label: 'Technology', value: 'Tall tubular, flooded lead acid' },
        ],
      },
      {
        title: 'Physical',
        specs: [
          { label: 'Dimensions (L×W×H)', value: '520 × 195 × 470 mm' },
          { label: 'Weight', value: '66.8 kg (filled)' },
          { label: 'Ventilation', value: 'Required' },
        ],
      },
    ],
    boxContents: ['TallTube 220 battery in protective crate', 'Terminal hardware set', 'Warranty card', 'Maintenance guide'],
    faqs: [
      {
        question: 'Do I need two for a 24V inverter?',
        answer:
          'Yes. A 24V system uses two identical batteries in series, bought and replaced together.',
      },
    ],
    warrantyMonths: 48,
    installationIncluded: true,
    badges: ['sale'],
    options: [],
    variants: [simpleVariant('ITG-BAT-TT-220', 'iTarang TallTube 220', 22490, 18499, 17)],
    rating: rating(4.5, 49, [1, 1, 5, 14, 28]),
    facets: {
      batteryAh: 220,
      technology: 'Tall Tubular',
      backupHours: 9,
      warrantyMonths: 48,
    },
    frequentlyBoughtWith: ['itg-inv-pro-1500', 'itg-inv-max-2200'],
    relatedProductIds: ['itg-bat-tall-180', 'itg-bat-life-200'],
    launchedAt: '2025-01-30',
    popularityRank: 13,
  },
  {
    id: 'itg-bat-short-135',
    slug: 'itarang-shorttube-135',
    title: 'iTarang ShortTube 135',
    subtitle: '135Ah C20 short tubular battery for low-headroom spaces',
    category: 'batteries',
    subcategory: 'short-tubular',
    art: 'battery',
    images: artSet('battery', 1),
    highlights: [
      'Tubular plate performance in a reduced-height case',
      'Fits under counters and inside utility cupboards',
      'Suits 700VA to 1100VA inverters',
      'Shipped in a protective crate',
    ],
    description: [
      'Where a tall tubular battery simply will not stand, the ShortTube 135 delivers the same plate technology in a lower case. Capacity per unit is lower than a tall equivalent, but the format solves a real installation constraint.',
    ],
    specGroups: [
      {
        title: 'Electrical',
        specs: [
          { label: 'Nominal capacity', value: '135 Ah at C20' },
          { label: 'Nominal voltage', value: '12 V' },
          { label: 'Technology', value: 'Short tubular, flooded lead acid' },
        ],
      },
      {
        title: 'Physical',
        specs: [
          { label: 'Dimensions (L×W×H)', value: '505 × 190 × 285 mm' },
          { label: 'Weight', value: '41.2 kg (filled)' },
          { label: 'Ventilation', value: 'Required' },
        ],
      },
    ],
    boxContents: ['ShortTube 135 battery in protective crate', 'Terminal hardware set', 'Warranty card', 'Maintenance guide'],
    faqs: [
      {
        question: 'Why choose short over tall tubular?',
        answer:
          'Only for height clearance. If a tall unit fits, it gives more capacity for the money and a longer topping-up interval.',
      },
    ],
    warrantyMonths: 36,
    installationIncluded: true,
    badges: [],
    options: [],
    variants: [simpleVariant('ITG-BAT-ST-135', 'iTarang ShortTube 135', 14990, 12199, 11)],
    rating: rating(4.2, 31, [1, 2, 5, 11, 12]),
    facets: {
      batteryAh: 135,
      technology: 'Short Tubular',
      backupHours: 5,
      warrantyMonths: 36,
    },
    frequentlyBoughtWith: ['itg-inv-pro-900'],
    relatedProductIds: ['itg-bat-tall-150', 'itg-bat-flat-100'],
    launchedAt: '2025-04-22',
    popularityRank: 18,
  },
  {
    id: 'itg-bat-flat-100',
    slug: 'itarang-flatmax-100',
    title: 'iTarang FlatMax 100',
    subtitle: '100Ah flat plate battery for short, infrequent outages',
    category: 'batteries',
    subcategory: 'flat-plate-smf',
    art: 'battery',
    images: artSet('battery', 2),
    highlights: [
      'Lowest entry price in the range',
      'Suited to areas with short, occasional cuts',
      'Compact footprint',
      'Not intended for daily deep cycling',
    ],
    description: [
      'Flat plate construction is the economical option where outages are short and infrequent. It is deliberately not the right choice for daily deep cycling — in areas with long daily cuts, a tubular or lithium battery will outlast it several times over and cost less per year of service.',
    ],
    specGroups: [
      {
        title: 'Electrical',
        specs: [
          { label: 'Nominal capacity', value: '100 Ah at C20' },
          { label: 'Nominal voltage', value: '12 V' },
          { label: 'Technology', value: 'Flat plate, flooded lead acid' },
          { label: 'Recommended depth of discharge', value: 'Up to 50%' },
        ],
      },
      {
        title: 'Physical',
        specs: [
          { label: 'Dimensions (L×W×H)', value: '410 × 175 × 225 mm' },
          { label: 'Weight', value: '27.6 kg (filled)' },
        ],
      },
    ],
    boxContents: ['FlatMax 100 battery', 'Terminal hardware set', 'Warranty card', 'Maintenance guide'],
    faqs: [
      {
        question: 'Should I buy this if my area has long power cuts?',
        answer:
          'No. Choose tubular or lithium. Flat plate batteries degrade quickly under repeated deep discharge and will need replacing far sooner.',
      },
    ],
    warrantyMonths: 24,
    installationIncluded: true,
    badges: ['sale'],
    options: [],
    variants: [simpleVariant('ITG-BAT-FP-100', 'iTarang FlatMax 100', 11490, 9299, 29)],
    rating: rating(3.9, 58, [4, 6, 12, 19, 17]),
    facets: {
      batteryAh: 100,
      technology: 'Flat Plate',
      backupHours: 4,
      warrantyMonths: 24,
    },
    frequentlyBoughtWith: ['itg-inv-lite-700'],
    relatedProductIds: ['itg-bat-smf-42', 'itg-bat-tall-150'],
    launchedAt: '2024-09-20',
    popularityRank: 16,
  },
  {
    id: 'itg-bat-smf-42',
    slug: 'itarang-sealpro-42-smf',
    title: 'iTarang SealPro 42',
    subtitle: '42Ah sealed maintenance-free battery for UPS duty',
    category: 'batteries',
    subcategory: 'flat-plate-smf',
    art: 'battery',
    images: artSet('battery', 3),
    highlights: [
      'Sealed and spill-proof — safe for indoor placement',
      'No water topping up ever required',
      'Sized for desktop and network UPS duty',
      'Compact and light enough to shelf-mount',
    ],
    description: [
      'The SealPro 42 is a sealed maintenance-free battery for UPS applications: a desktop, a router and ONT, or a small camera recorder. It is sealed, so it can sit indoors beside the equipment it protects.',
    ],
    specGroups: [
      {
        title: 'Electrical',
        specs: [
          { label: 'Nominal capacity', value: '42 Ah' },
          { label: 'Nominal voltage', value: '12 V' },
          { label: 'Technology', value: 'Sealed maintenance-free (VRLA)' },
        ],
      },
      {
        title: 'Physical',
        specs: [
          { label: 'Dimensions (L×W×H)', value: '197 × 165 × 170 mm' },
          { label: 'Weight', value: '13.1 kg' },
          { label: 'Maintenance', value: 'None required' },
        ],
      },
    ],
    boxContents: ['SealPro 42 battery', 'Terminal hardware set', 'Warranty card'],
    faqs: [
      {
        question: 'Can I use this with a home inverter?',
        answer:
          'It will work but runtime will be short and the battery will wear quickly. SMF batteries are intended for UPS duty, not household backup.',
      },
    ],
    warrantyMonths: 24,
    installationIncluded: false,
    badges: [],
    options: [],
    variants: [simpleVariant('ITG-BAT-SMF-42', 'iTarang SealPro 42', 5490, 4399, 44)],
    rating: rating(4.1, 36, [2, 3, 6, 13, 12]),
    facets: {
      batteryAh: 42,
      technology: 'SMF',
      backupHours: 2,
      warrantyMonths: 24,
    },
    frequentlyBoughtWith: ['itg-ups-home-600', 'itg-ups-home-1000'],
    relatedProductIds: ['itg-bat-flat-100', 'itg-ups-home-1000'],
    launchedAt: '2024-08-30',
    popularityRank: 19,
  },

  /* ==================================================================== UPS */
  {
    id: 'itg-ups-home-600',
    slug: 'itarang-guardups-600',
    title: 'iTarang GuardUPS 600',
    subtitle: '600VA line-interactive UPS for a desktop and router',
    category: 'ups',
    subcategory: 'home-ups',
    art: 'ups',
    images: artSet('ups', 1),
    highlights: [
      'Rides through short cuts without a reboot',
      'Automatic voltage regulation without draining the battery',
      'Four protected outlets',
      'Audible alarm on battery and on fault',
    ],
    description: [
      'The GuardUPS 600 protects a single desktop and its router through short cuts and voltage dips. Automatic voltage regulation corrects moderate swings using an internal transformer tap, so the battery is preserved for genuine outages.',
    ],
    specGroups: [
      {
        title: 'Output',
        specs: [
          { label: 'Rated capacity', value: '600 VA / 360 W' },
          { label: 'Topology', value: 'Line-interactive with AVR' },
          { label: 'Transfer time', value: 'Under 6 ms' },
          { label: 'Outlets', value: '4 protected' },
        ],
      },
      {
        title: 'Battery',
        specs: [
          { label: 'Battery', value: 'Internal, sealed' },
          { label: 'Typical runtime at 200W', value: 'Around 8 minutes' },
          { label: 'Recharge time', value: 'Around 6 hours to 90%' },
        ],
      },
    ],
    boxContents: ['GuardUPS 600 unit', 'Power cable', 'User manual', 'Warranty card'],
    faqs: [
      {
        question: 'How long will it run my computer?',
        answer:
          'Runtime depends on the load, not the VA rating alone. A desktop and monitor drawing around 200W typically gets about eight minutes — enough to save work and shut down safely.',
      },
    ],
    warrantyMonths: 24,
    installationIncluded: false,
    badges: ['sale'],
    options: [],
    variants: [simpleVariant('ITG-UPS-600', 'iTarang GuardUPS 600', 5990, 4499, 33)],
    rating: rating(4.2, 74, [3, 4, 9, 24, 34]),
    facets: {
      capacityVa: 600,
      technology: 'Line Interactive',
      warrantyMonths: 24,
    },
    frequentlyBoughtWith: ['itg-bat-smf-42'],
    relatedProductIds: ['itg-ups-home-1000', 'itg-ups-home-1450'],
    launchedAt: '2024-10-02',
    popularityRank: 20,
  },
  {
    id: 'itg-ups-home-1000',
    slug: 'itarang-guardups-1000',
    title: 'iTarang GuardUPS 1000',
    subtitle: '1000VA line-interactive UPS for a workstation and NVR',
    category: 'ups',
    subcategory: 'home-ups',
    art: 'ups',
    images: artSet('ups', 2),
    highlights: [
      'Carries a workstation, monitor, router and NVR together',
      'Wide AVR window for unstable supply',
      'USB monitoring with safe-shutdown software',
      'Six protected outlets',
    ],
    description: [
      'The GuardUPS 1000 covers a full desk: workstation, monitor, router, ONT and a camera recorder. USB monitoring lets a connected computer shut down cleanly if the outage outlasts the battery.',
    ],
    specGroups: [
      {
        title: 'Output',
        specs: [
          { label: 'Rated capacity', value: '1000 VA / 600 W' },
          { label: 'Topology', value: 'Line-interactive with AVR' },
          { label: 'Transfer time', value: 'Under 6 ms' },
          { label: 'Outlets', value: '6 protected' },
        ],
      },
      {
        title: 'Management',
        specs: [
          { label: 'Monitoring', value: 'USB with safe-shutdown utility' },
          { label: 'Display', value: 'LCD with load and battery status' },
        ],
      },
    ],
    boxContents: ['GuardUPS 1000 unit', 'Power cable', 'USB cable', 'User manual', 'Warranty card'],
    faqs: [
      {
        question: 'Will it run a laser printer?',
        answer:
          'No. Laser printers draw a large fusing surge that will overload a UPS of this size. Keep printers on an unprotected outlet.',
      },
    ],
    warrantyMonths: 24,
    installationIncluded: false,
    badges: ['bestseller'],
    options: [],
    variants: [simpleVariant('ITG-UPS-1000', 'iTarang GuardUPS 1000', 8490, 6499, 21)],
    rating: rating(4.4, 52, [1, 2, 6, 17, 26]),
    facets: {
      capacityVa: 1000,
      technology: 'Line Interactive',
      warrantyMonths: 24,
    },
    frequentlyBoughtWith: ['itg-bat-smf-42'],
    relatedProductIds: ['itg-ups-home-600', 'itg-ups-home-1450', 'itg-inv-dups-850'],
    launchedAt: '2024-12-01',
    popularityRank: 21,
  },
  {
    id: 'itg-ups-home-1450',
    slug: 'itarang-guardups-1450',
    title: 'iTarang GuardUPS 1450',
    subtitle: '1450VA line-interactive UPS for small racks and multi-device desks',
    category: 'ups',
    subcategory: 'home-ups',
    art: 'ups',
    images: artSet('ups', 3),
    highlights: [
      'Sized for a small network rack',
      'Eight protected outlets across two groups',
      'LCD with load, runtime and input voltage',
      'Cold start on battery',
    ],
    description: [
      'The GuardUPS 1450 is the largest line-interactive unit in the range — appropriate for a small network cabinet with a switch, router, NAS and recorder, or a desk running two workstations.',
    ],
    specGroups: [
      {
        title: 'Output',
        specs: [
          { label: 'Rated capacity', value: '1450 VA / 900 W' },
          { label: 'Topology', value: 'Line-interactive with AVR' },
          { label: 'Transfer time', value: 'Under 6 ms' },
          { label: 'Outlets', value: '8 across 2 groups' },
        ],
      },
      {
        title: 'Management',
        specs: [
          { label: 'Monitoring', value: 'USB with safe-shutdown utility' },
          { label: 'Cold start', value: 'Supported' },
        ],
      },
    ],
    boxContents: ['GuardUPS 1450 unit', 'Power cable', 'USB cable', 'Rack ears', 'Warranty card'],
    faqs: [
      {
        question: 'Can it be rack mounted?',
        answer: 'Yes. Rack ears are supplied in the box for a standard 19-inch cabinet.',
      },
    ],
    warrantyMonths: 24,
    installationIncluded: false,
    badges: [],
    options: [],
    variants: [simpleVariant('ITG-UPS-1450', 'iTarang GuardUPS 1450', 11990, 9299, 9)],
    rating: rating(4.3, 18, [0, 1, 2, 6, 9]),
    facets: {
      capacityVa: 1450,
      technology: 'Line Interactive',
      warrantyMonths: 24,
    },
    frequentlyBoughtWith: [],
    relatedProductIds: ['itg-ups-home-1000', 'itg-ups-online-1k'],
    launchedAt: '2025-02-26',
    popularityRank: 22,
  },
  {
    id: 'itg-ups-online-1k',
    slug: 'itarang-online-1k',
    title: 'iTarang OnLine 1K',
    subtitle: '1kVA online double-conversion UPS with zero transfer time',
    category: 'ups',
    subcategory: 'online-ups',
    art: 'ups',
    images: artSet('ups', 1),
    highlights: [
      'True zero transfer time — the load never touches raw grid',
      'Waveform regenerated continuously',
      'For servers, diagnostic equipment and instrumentation',
      'Tower or rack mounting',
    ],
    description: [
      'An online UPS rectifies incoming AC to DC and inverts it back continuously. The connected equipment is permanently isolated from grid disturbance, and there is no transfer event at all when supply fails.',
      'This is the correct topology for servers, medical and diagnostic equipment, and precision instrumentation, where even a few milliseconds of interruption is unacceptable.',
    ],
    specGroups: [
      {
        title: 'Output',
        specs: [
          { label: 'Rated capacity', value: '1000 VA / 900 W' },
          { label: 'Topology', value: 'Online double conversion' },
          { label: 'Transfer time', value: 'Zero' },
          { label: 'Output power factor', value: '0.9' },
        ],
      },
      {
        title: 'Management',
        specs: [
          { label: 'Monitoring', value: 'USB and RS-232' },
          { label: 'Mounting', value: 'Tower or 2U rack' },
          { label: 'Bypass', value: 'Automatic and manual' },
        ],
      },
    ],
    boxContents: ['OnLine 1K unit', 'Power cables', 'USB cable', 'Rack ears and tower feet', 'Warranty card'],
    faqs: [
      {
        question: 'Why is an online UPS more expensive?',
        answer:
          'It runs its inverter continuously rather than only on failure, which requires more capable components and produces a genuinely gap-free output. For equipment that cannot tolerate a transfer event, there is no cheaper substitute.',
      },
    ],
    warrantyMonths: 24,
    installationIncluded: false,
    badges: ['premium'],
    options: [],
    variants: [simpleVariant('ITG-UPS-ON-1K', 'iTarang OnLine 1K', 24990, 20499, 7)],
    rating: rating(4.7, 15, [0, 0, 1, 3, 11]),
    facets: {
      capacityVa: 1000,
      technology: 'Online Double Conversion',
      warrantyMonths: 24,
    },
    frequentlyBoughtWith: [],
    relatedProductIds: ['itg-ups-online-2k', 'itg-ups-home-1450'],
    launchedAt: '2025-05-06',
    popularityRank: 23,
  },
  {
    id: 'itg-ups-online-2k',
    slug: 'itarang-online-2k',
    title: 'iTarang OnLine 2K',
    subtitle: '2kVA online double-conversion UPS for server racks',
    category: 'ups',
    subcategory: 'online-ups',
    art: 'ups',
    images: artSet('ups', 2),
    highlights: [
      'Rack-mount online UPS for a full server cabinet',
      'Extendable runtime with external battery packs',
      'Network management card slot',
      'Automatic and maintenance bypass',
    ],
    description: [
      'The OnLine 2K is a rack-mount double-conversion UPS for a populated server cabinet. External battery packs extend runtime, and a management card slot allows shutdown orchestration across multiple protected hosts.',
    ],
    specGroups: [
      {
        title: 'Output',
        specs: [
          { label: 'Rated capacity', value: '2000 VA / 1800 W' },
          { label: 'Topology', value: 'Online double conversion' },
          { label: 'Transfer time', value: 'Zero' },
        ],
      },
      {
        title: 'Management',
        specs: [
          { label: 'Expansion', value: 'External battery packs supported' },
          { label: 'Card slot', value: 'SNMP network management card' },
          { label: 'Bypass', value: 'Automatic and maintenance' },
        ],
      },
    ],
    boxContents: ['OnLine 2K unit', 'Power cables', 'Rack rails', 'Warranty card'],
    faqs: [
      {
        question: 'Can runtime be extended?',
        answer:
          'Yes. External battery packs connect in series with the internal bank; your integrator will size these against the required hold-up time.',
      },
    ],
    warrantyMonths: 24,
    installationIncluded: false,
    badges: ['premium', 'low-stock'],
    options: [],
    variants: [simpleVariant('ITG-UPS-ON-2K', 'iTarang OnLine 2K', 39990, 32999, 3)],
    rating: null,
    facets: {
      capacityVa: 2000,
      technology: 'Online Double Conversion',
      warrantyMonths: 24,
    },
    frequentlyBoughtWith: [],
    relatedProductIds: ['itg-ups-online-1k', 'itg-inv-max-3500'],
    launchedAt: '2025-07-30',
    popularityRank: 24,
  },

  /* ================================================================= COMBOS */
  {
    id: 'itg-combo-900-live',
    slug: 'itarang-inverter-900-va',
    title: 'iTarang Home Inverter 900VA',
    subtitle: '900VA Pure Sine Wave Home Inverter with 150Ah Lithium Battery',
    category: 'combos',
    subcategory: 'home-combos',
    art: 'combo',
    images: artSet('combo', 1),
    highlights: [
      'Runs 4 fans, 6 LED lights and a television for up to 4 hours on full load',
      '3-year warranty on the inverter and the battery',
      'Designed for Indian voltage conditions with wide-input protection',
      'Charger profile pre-set for lithium',
    ],
    description: [
      '900VA pure sine wave home inverter with a 150Ah lithium battery. Runs 4 fans, 6 LED lights and a television for up to 4 hours on full load. Includes a 3-year warranty on the inverter and battery. Designed for Indian voltage conditions with wide-input protection.',
    ],
    specGroups: [
      {
        title: 'Key Specifications',
        specs: [
          { label: 'Inverter capacity', value: '900 VA' },
          { label: 'Waveform', value: 'Pure sine wave' },
          { label: 'Battery', value: '150Ah lithium' },
          { label: 'Typical backup', value: 'Up to 4 hours at full load' },
          { label: 'Warranty', value: '3 years on inverter and battery' },
          { label: 'Input protection', value: 'Wide input voltage range' },
        ],
      },
    ],
    boxContents: ['900VA pure sine wave inverter', '150Ah lithium battery', 'Battery cable set', 'Warranty card', 'Installation guide'],
    faqs: [
      {
        question: 'What does the 3-year warranty cover?',
        answer: 'The inverter board and battery performance are both covered for 3 years from installation.',
      },
      {
        question: 'Is installation included?',
        answer: INSTALL_LINE,
      },
    ],
    warrantyMonths: 36,
    installationIncluded: true,
    badges: ['bestseller'],
    options: [],
    variants: [simpleVariant('ITG-INV-900VA-150AH', 'iTarang Home Inverter 900VA', 10999, 8500, 25)],
    rating: rating(4.6, 38, [0, 1, 3, 10, 24]),
    facets: {
      capacityVa: 900,
      batteryAh: 150,
      technology: 'Pure Sine Wave',
      backupHours: 4,
      warrantyMonths: 36,
    },
    frequentlyBoughtWith: ['itg-inv-pro-900'],
    relatedProductIds: ['itg-combo-home-900', 'itg-combo-home-1100', 'itg-inv-pro-900'],
    launchedAt: '2025-08-20',
    popularityRank: 25,
  },
  {
    id: 'itg-combo-home-900',
    slug: 'itarang-home-combo-900',
    title: 'iTarang Home Combo 900',
    subtitle: 'Sine Pro 900 inverter with a matched 150Ah battery',
    category: 'combos',
    subcategory: 'home-combos',
    art: 'combo',
    images: artSet('combo', 2),
    highlights: [
      'Charger profile pre-matched to the supplied chemistry',
      'One warranty and one installation visit for both units',
      'Choose tall tubular or lithium at checkout',
      'Priced below buying the two products separately',
    ],
    description: [
      'The Home Combo 900 pairs our best-selling Sine Pro 900 inverter with a battery sized for a full evening outage in a two or three bedroom home.',
      'Choosing the combo removes the matching problem: charging current, charger profile and cable gauge are all specified together, and both units arrive on one delivery with one installation visit.',
    ],
    specGroups: [
      {
        title: 'System',
        specs: [
          { label: 'Inverter', value: 'iTarang Sine Pro 900, 900VA pure sine wave' },
          { label: 'Battery', value: '150Ah — tubular or lithium' },
          { label: 'Battery system', value: '12V, single battery' },
          { label: 'Typical backup', value: '6–8 hours on a four-fan, six-light load' },
        ],
      },
      {
        title: 'Included',
        specs: [
          { label: 'Installation', value: 'Certified technician, included' },
          { label: 'Warranty', value: '36 months inverter; battery per chemistry' },
          { label: 'Delivery', value: 'Both units on one delivery' },
        ],
      },
    ],
    boxContents: ['Sine Pro 900 inverter', 'Selected battery in protective crate', 'Battery cable set', 'Wall mounting bracket', 'Warranty cards'],
    faqs: [
      {
        question: 'Which battery should I choose?',
        answer:
          'Tubular if the purchase price matters most and you can accommodate ventilation and periodic topping up. Lithium if you want a maintenance-free system with a much longer replacement interval.',
      },
      {
        question: 'Is it cheaper than buying separately?',
        answer: 'Yes. Combo pricing is set below the sum of the two individual product prices.',
      },
    ],
    warrantyMonths: 36,
    installationIncluded: true,
    badges: ['combo-saver', 'bestseller'],
    options: [{ id: 'battery', name: 'Battery', values: ['150Ah Tall Tubular', '150Ah Lithium'] }],
    variants: comboVariants([
      { label: '150Ah Tall Tubular', sku: 'ITG-CMB-900-TT150', mrp: 25480, selling: 19499, stock: 19 },
      { label: '150Ah Lithium', sku: 'ITG-CMB-900-LI150', mrp: 53980, selling: 42499, stock: 8 },
    ]),
    rating: rating(4.6, 73, [1, 1, 5, 20, 46]),
    facets: {
      capacityVa: 900,
      batteryAh: 150,
      technology: 'Pure Sine Wave',
      backupHours: 7,
      warrantyMonths: 36,
    },
    frequentlyBoughtWith: ['itg-bat-tall-150'],
    relatedProductIds: ['itg-combo-home-1100', 'itg-combo-home-1500', 'itg-inv-pro-900'],
    launchedAt: '2024-11-18',
    popularityRank: 26,
  },
  {
    id: 'itg-combo-home-1100',
    slug: 'itarang-home-combo-1100',
    title: 'iTarang Home Combo 1100 Lithium',
    subtitle: 'Sine Pro 1100 inverter with a 150Ah LiFePO4 battery',
    category: 'combos',
    subcategory: 'home-combos',
    art: 'combo',
    images: artSet('combo', 3),
    highlights: [
      'Fully maintenance-free — no topping up, no trolley',
      'Around 8 hours on a typical evening load',
      'Headroom for a mixer or small pump',
      'Charger pre-set to the lithium profile',
    ],
    description: [
      'The Home Combo 1100 Lithium is the system to buy if you would rather not think about the battery again. There is no water to top up, no ventilated trolley to accommodate, and the replacement interval is measured in years rather than seasons.',
      'The 1100VA inverter adds headroom over the 900 for a mixer, a small pump or a second refrigeration circuit during an outage.',
    ],
    specGroups: [
      {
        title: 'System',
        specs: [
          { label: 'Inverter', value: 'iTarang Sine Pro 1100, 1100VA pure sine wave' },
          { label: 'Battery', value: 'iTarang LiFe 150, 150Ah LiFePO4' },
          { label: 'Typical backup', value: '7–9 hours on a four-fan, six-light load' },
          { label: 'Charging', value: '20A, lithium profile pre-set' },
        ],
      },
      {
        title: 'Included',
        specs: [
          { label: 'Installation', value: 'Certified technician, included' },
          { label: 'Warranty', value: '36 months inverter, 60 months battery' },
        ],
      },
    ],
    boxContents: ['Sine Pro 1100 inverter', 'LiFe 150 lithium battery', 'Battery cable set', 'Wall mounting bracket', 'Warranty cards'],
    faqs: [
      {
        question: 'Does lithium need special installation?',
        answer:
          'No special site preparation is needed — it is sealed and does not require ventilation. The installer sets the inverter charger profile to lithium during commissioning.',
      },
    ],
    warrantyMonths: 36,
    installationIncluded: true,
    badges: ['combo-saver', 'premium'],
    options: [{ id: 'battery', name: 'Battery', values: ['150Ah Lithium', '200Ah Lithium'] }],
    variants: comboVariants([
      { label: '150Ah Lithium', sku: 'ITG-CMB-1100-LI150', mrp: 55980, selling: 43999, stock: 11 },
      { label: '200Ah Lithium', sku: 'ITG-CMB-1100-LI200', mrp: 67980, selling: 54499, stock: 5 },
    ]),
    rating: rating(4.8, 41, [0, 0, 2, 6, 33]),
    facets: {
      capacityVa: 1100,
      batteryAh: 150,
      technology: 'LiFePO4',
      backupHours: 8,
      warrantyMonths: 60,
    },
    frequentlyBoughtWith: ['itg-bat-life-150'],
    relatedProductIds: ['itg-combo-home-900', 'itg-combo-solar-1100', 'itg-inv-pro-1100'],
    launchedAt: '2025-01-15',
    popularityRank: 27,
  },
  {
    id: 'itg-combo-home-1500',
    slug: 'itarang-home-combo-1500',
    title: 'iTarang Home Combo 1500',
    subtitle: 'Sine Pro 1500 inverter with a 220Ah tall tubular battery',
    category: 'combos',
    subcategory: 'home-combos',
    art: 'combo',
    images: artSet('combo', 1),
    highlights: [
      'Sized to carry a refrigerator through a long outage',
      'Surge headroom for compressor and pump start-up',
      'Highest lead acid capacity in the range',
      'Single installation visit for both units',
    ],
    description: [
      'The Home Combo 1500 is specified for a four-bedroom home that needs refrigeration to survive an outage. The 1500VA inverter absorbs compressor start-up surge, and the 220Ah tubular battery supplies the runtime.',
    ],
    specGroups: [
      {
        title: 'System',
        specs: [
          { label: 'Inverter', value: 'iTarang Sine Pro 1500, 1500VA pure sine wave' },
          { label: 'Battery', value: 'iTarang TallTube 220, 220Ah C20' },
          { label: 'Typical backup', value: '8–10 hours with refrigeration on a duty cycle' },
        ],
      },
      {
        title: 'Included',
        specs: [
          { label: 'Installation', value: 'Certified technician, included' },
          { label: 'Warranty', value: '36 months inverter, 48 months battery' },
        ],
      },
    ],
    boxContents: ['Sine Pro 1500 inverter', 'TallTube 220 battery in protective crate', 'Heavy-gauge cable set', 'Wall mounting bracket', 'Warranty cards'],
    faqs: [
      {
        question: 'Will the refrigerator run the whole time?',
        answer:
          'A refrigerator cycles rather than running continuously, so the average draw is well below its peak. On a typical duty cycle this system carries refrigeration plus lighting and fans for most of an evening.',
      },
    ],
    warrantyMonths: 36,
    installationIncluded: true,
    badges: ['combo-saver'],
    options: [{ id: 'battery', name: 'Battery', values: ['220Ah Tall Tubular', '200Ah Lithium'] }],
    variants: comboVariants([
      { label: '220Ah Tall Tubular', sku: 'ITG-CMB-1500-TT220', mrp: 36980, selling: 28499, stock: 13 },
      { label: '200Ah Lithium', sku: 'ITG-CMB-1500-LI200', mrp: 71480, selling: 57999, stock: 4 },
    ]),
    rating: rating(4.5, 26, [0, 1, 2, 8, 15]),
    facets: {
      capacityVa: 1500,
      batteryAh: 220,
      technology: 'Tall Tubular',
      backupHours: 9,
      warrantyMonths: 48,
    },
    frequentlyBoughtWith: ['itg-bat-tall-220'],
    relatedProductIds: ['itg-combo-home-1100', 'itg-combo-shop-2200', 'itg-inv-pro-1500'],
    launchedAt: '2025-03-05',
    popularityRank: 28,
  },
  {
    id: 'itg-combo-shop-2200',
    slug: 'itarang-shop-combo-2200',
    title: 'iTarang Shop Combo 2200',
    subtitle: 'Sine Max 2200 inverter with a matched 24V two-battery bank',
    category: 'combos',
    subcategory: 'shop-office-combos',
    art: 'combo',
    images: artSet('combo', 2),
    highlights: [
      'Carries a retail counter through a full working day of cuts',
      'Matched pair of batteries supplied and warranted together',
      '24V bank keeps cable losses and heating low',
      'Site survey and certified installation included',
    ],
    description: [
      'The Shop Combo 2200 is built for commercial premises: a retail counter with refrigeration and billing equipment, a clinic reception, or a small office floor.',
      'Both batteries are supplied as a matched pair from the same production batch, which matters on a series bank — mismatched units charge unevenly and fail early.',
    ],
    specGroups: [
      {
        title: 'System',
        specs: [
          { label: 'Inverter', value: 'iTarang Sine Max 2200, 2200VA pure sine wave' },
          { label: 'Battery bank', value: '2 × 180Ah or 2 × 220Ah tall tubular, 24V series' },
          { label: 'Maximum continuous load', value: '1760 W' },
          { label: 'Charging current', value: '30 A' },
        ],
      },
      {
        title: 'Included',
        specs: [
          { label: 'Site survey', value: 'Before installation is scheduled' },
          { label: 'Installation', value: 'Certified technician, dedicated circuit' },
          { label: 'Warranty', value: '36 months inverter, 42–48 months batteries' },
        ],
      },
    ],
    boxContents: ['Sine Max 2200 inverter', 'Two matched batteries in protective crates', 'Series interconnect and battery cables', 'Floor stand', 'Warranty cards'],
    faqs: [
      {
        question: 'Why must the batteries be a matched pair?',
        answer:
          'In a series bank both batteries carry the same current. If one has lower capacity or is older, it is repeatedly over-discharged and drags the other down with it.',
      },
      {
        question: 'What does the site survey cover?',
        answer:
          'Incoming supply rating, cable runs, battery placement and ventilation, and which circuits should be on backup. It is carried out before installation is booked.',
      },
    ],
    warrantyMonths: 36,
    installationIncluded: true,
    badges: ['combo-saver', 'premium'],
    options: [{ id: 'battery', name: 'Battery bank', values: ['2 × 180Ah Tubular', '2 × 220Ah Tubular'] }],
    variants: comboVariants([
      { label: '2 × 180Ah Tubular', sku: 'ITG-CMB-2200-TT180X2', mrp: 57970, selling: 44999, stock: 6 },
      { label: '2 × 220Ah Tubular', sku: 'ITG-CMB-2200-TT220X2', mrp: 64970, selling: 50999, stock: 3 },
    ]),
    rating: rating(4.6, 19, [0, 0, 2, 4, 13]),
    facets: {
      capacityVa: 2200,
      batteryAh: 180,
      technology: 'Tall Tubular',
      backupHours: 8,
      warrantyMonths: 42,
    },
    frequentlyBoughtWith: ['itg-bat-tall-180'],
    relatedProductIds: ['itg-combo-home-1500', 'itg-inv-max-2200', 'itg-inv-max-3500'],
    launchedAt: '2025-04-30',
    popularityRank: 29,
  },
  {
    id: 'itg-combo-solar-1100',
    slug: 'itarang-solar-combo-1100',
    title: 'iTarang Solar Combo 1100',
    subtitle: 'Solaris 1100 solar-ready inverter with a 150Ah lithium battery',
    category: 'combos',
    subcategory: 'solar-combos',
    art: 'combo',
    images: artSet('combo', 3),
    highlights: [
      'Runs on grid today, accepts panels whenever you add them',
      'Lithium battery suited to daily partial cycling',
      'Integrated charge controller — no separate hardware',
      'Panel array specified free at survey',
    ],
    description: [
      'The Solar Combo 1100 is the sensible entry into solar backup: a solar-ready inverter and a lithium bank that tolerates the daily partial cycling a panel array produces.',
      'The system runs entirely on grid charging from day one. When you add panels, the built-in controller takes over charging duty — no inverter replacement, no separate charge controller to buy.',
    ],
    specGroups: [
      {
        title: 'System',
        specs: [
          { label: 'Inverter', value: 'iTarang Solaris 1100, 1100VA solar hybrid' },
          { label: 'Battery', value: 'iTarang LiFe 150, 150Ah LiFePO4' },
          { label: 'Solar controller', value: 'Integrated PWM, up to 1000 Wp' },
          { label: 'Typical backup', value: '7–9 hours on a four-fan, six-light load' },
        ],
      },
      {
        title: 'Included',
        specs: [
          { label: 'Installation', value: 'Certified technician, included' },
          { label: 'Panel sizing', value: 'Specified free at survey; panels sold separately' },
          { label: 'Warranty', value: '36 months inverter, 60 months battery' },
        ],
      },
    ],
    boxContents: ['Solaris 1100 inverter', 'LiFe 150 lithium battery', 'Battery cable set', 'Solar input connector set', 'Warranty cards'],
    faqs: [
      {
        question: 'Are solar panels included?',
        answer:
          'No. Panels are specified against your roof orientation and daily consumption at survey, and are quoted separately. The inverter accepts up to 1000Wp.',
      },
      {
        question: 'Can I add panels later?',
        answer:
          'Yes — that is the point of this system. It runs as a normal grid-charged inverter until an array is connected.',
      },
    ],
    warrantyMonths: 36,
    installationIncluded: true,
    badges: ['new', 'combo-saver'],
    options: [{ id: 'battery', name: 'Battery', values: ['150Ah Lithium', '200Ah Lithium'] }],
    variants: comboVariants([
      { label: '150Ah Lithium', sku: 'ITG-CMB-SOL1100-LI150', mrp: 58980, selling: 46499, stock: 8 },
      { label: '200Ah Lithium', sku: 'ITG-CMB-SOL1100-LI200', mrp: 70980, selling: 56999, stock: 4 },
    ]),
    rating: rating(4.7, 14, [0, 0, 1, 2, 11]),
    facets: {
      capacityVa: 1100,
      batteryAh: 150,
      technology: 'Solar Hybrid',
      backupHours: 8,
      warrantyMonths: 60,
    },
    frequentlyBoughtWith: ['itg-inv-solar-1100'],
    relatedProductIds: ['itg-inv-solar-1100', 'itg-combo-home-1100', 'itg-inv-solar-2000'],
    launchedAt: '2025-07-18',
    popularityRank: 30,
  },
  {
    id: 'itg-combo-studio-700',
    slug: 'itarang-studio-combo-700',
    title: 'iTarang Studio Combo 700',
    subtitle: 'Sine Lite 700 inverter with a 100Ah flat plate battery',
    category: 'combos',
    subcategory: 'home-combos',
    art: 'combo',
    images: artSet('combo', 1),
    highlights: [
      'Lowest-cost complete system in the range',
      'Sized for a studio flat or a single room',
      'Pure sine wave output despite the entry price',
      'One delivery, one installation visit',
    ],
    description: [
      'The Studio Combo 700 is the most affordable complete iTarang system: enough to keep two fans, four lights and a router running through an outage in a studio flat, a hostel room or a small shop counter.',
      'It uses a flat plate battery to keep the price down, which is appropriate where outages are short and occasional. If your area loses supply for hours daily, choose the Home Combo 900 instead — the tubular battery will last considerably longer under that duty.',
    ],
    specGroups: [
      {
        title: 'System',
        specs: [
          { label: 'Inverter', value: 'iTarang Sine Lite 700, 700VA pure sine wave' },
          { label: 'Battery', value: 'iTarang FlatMax 100, 100Ah C20' },
          { label: 'Typical backup', value: '3–4 hours on a two-fan, four-light load' },
        ],
      },
      {
        title: 'Included',
        specs: [
          { label: 'Installation', value: 'Certified technician, included' },
          { label: 'Warranty', value: '24 months inverter, 24 months battery' },
        ],
      },
    ],
    boxContents: ['Sine Lite 700 inverter', 'FlatMax 100 battery', 'Battery cable set', 'Wall mounting bracket', 'Warranty cards'],
    faqs: [
      {
        question: 'Is this enough for a one-bedroom flat?',
        answer:
          'For fans, lights and a router, yes. If you want a television and longer runtime, step up to the Home Combo 900.',
      },
    ],
    warrantyMonths: 24,
    installationIncluded: true,
    badges: ['combo-saver', 'sale'],
    options: [],
    variants: [simpleVariant('ITG-CMB-700-FP100', 'iTarang Studio Combo 700', 17989, 13499, 21)],
    rating: rating(4.1, 47, [2, 4, 8, 15, 18]),
    facets: {
      capacityVa: 700,
      batteryAh: 100,
      technology: 'Pure Sine Wave',
      backupHours: 4,
      warrantyMonths: 24,
    },
    frequentlyBoughtWith: ['itg-bat-flat-100'],
    relatedProductIds: ['itg-combo-home-900', 'itg-inv-lite-700'],
    launchedAt: '2025-02-10',
    popularityRank: 31,
  },
];

export const PRODUCT_BY_SLUG = new Map(PRODUCTS.map((p) => [p.slug, p]));
export const PRODUCT_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));
