import type { ProductFaq, SpecGroup } from '../../src/lib/commerce/types.ts';
import type { ProductSeed } from '../../src/lib/products/seed-types.ts';
import type { ManufacturerInput, SellerInput } from '../../src/lib/products/types.ts';

/**
 * The eight Trontek products, transcribed from their source listing documents.
 *
 * Provenance: the eight `.docx` listing sheets and the 32-image archive in
 * `docs/`. Every value below is copied from one of them. See
 * `src/lib/products/seed-types.ts` for the two rules the transcription follows:
 * a `[insert …]` placeholder becomes `null`, and strings are copied verbatim
 * including anything that reads like a typo.
 *
 * **What the source documents do not settle, and this file therefore does not
 * either.** Each is a business decision, not a transcription one:
 *
 *  1. Five of the eight documents give the warranty as
 *     `[insert Trontek warranty terms]`. Those five carry `warranty*: null` and
 *     their pages show no warranty. The product *images* for those five state
 *     "3 years or 1200 cycles" (EV) and "5 years or 4000 cycles" (Powercube
 *     2.7); artwork is not a warranty document, so it is not used here.
 *  2. Powercube 2.7 has `[insert]` for both MRP and selling price. It is
 *     seeded as a draft and cannot be published until it is priced.
 *  3. Seven documents say the manufacturer's legal name and registered address
 *     are "to be confirmed". Both are `null` on the manufacturer record, even
 *     though the Powercube 1.4 document alone gives values for them.
 *  4. The customer-care email is `[insert customer-care email]` in seven
 *     documents; the eighth gives one, and a different care number. The seller
 *     record carries the seven-document phone and no email.
 *  5. `48VV`, `60VV`, `72VV` appear in the EV documents where `48V`, `60V` and
 *     `72V` are meant. They are reproduced exactly. Correcting published copy
 *     is an edit for the admin console, not a silent fix here.
 *  6. No document supplies a SKU. The `TRN-<model>` scheme below was minted for
 *     this import; `product_variants.sku` is unique and `order_items.sku` is a
 *     permanent invoice snapshot, so it should be confirmed before any sale.
 *
 * Money is integer paise. Prices are quoted inclusive of taxes, as the source
 * documents state them.
 */

export const MANUFACTURERS: ManufacturerInput[] = [
  {
    key: 'trontek',
    name: 'Trontek',
    // Both null on purpose. Seven of the eight documents read "Trontek (Trontek
    // Electronics Pvt. Ltd. — confirm exact legal name and registered
    // address)"; the Powercube 1.4 document gives "Trontek Electronics Pvt.
    // Ltd." and "A-53, Naraina Industrial Area Phase-1, Naraina, Delhi-110028".
    // One document against seven explicit "to be confirmed" notes is not
    // confirmation, and a registered address is a compliance statement.
    legalName: null,
    address: null,
    website: 'www.trontek.com',
    email: 'info@trontek.com',
    phone: null,
    countryOfOrigin: 'India',
  },
];

export const SELLERS: SellerInput[] = [
  {
    key: 'itarang',
    name: 'iTarang Network Private Limited',
    address: 'Unitech Business Zone, Sector 50, Gurugram, Haryana',
    customerCarePhone: '9971027907',
    // `[insert customer-care email]` in seven documents. The Powercube 1.4
    // document gives care@itarang.com and a different care number
    // (9266120411, Trontek service centre); `src/lib/site.ts` uses a .in
    // address. Three candidates, so none is used until one is confirmed.
    customerCareEmail: null,
    gstin: '06AALFI7813E1ZE',
    grievanceOfficerName: 'Chirag Garg',
    grievanceOfficerPhone: '9971027907',
    packedBy: null,
  },
];

/* ------------------------------------------------------- shared EV content */

/** §"Key features". Identical in all six EV documents. */
export const EV_KEY_FEATURES = [
  'Attractive cycle life — 2000 cycles at 0.5C, 25°C',
  'Extended safety performance and double safety protection',
  'Wide operating temperature range; unrivalled high-temperature performance',
  'Green energy without metal contaminant',
  'High capacity, steady output voltage, low self-discharge',
  'Withstands very high levels of vibration and shock',
  'Intelligent BMS with independent cell balancing',
];

/** §"Safety characteristics (as tested)". Identical in all six EV documents. */
export const EV_SAFETY_GROUP: SpecGroup = {
  title: 'Safety characteristics (as tested)',
  specs: [
    {
      label: 'Over-charge / over-discharge',
      value: 'Withstands both — no fire, no explosion, continues to work',
    },
    { label: 'Short circuit', value: 'Withstands short circuit — no fire, no explosion' },
    { label: 'Nail puncture', value: 'Withstands nail penetration — no fire, no explosion' },
    { label: 'Thermal shock', value: 'Withstands thermal shock — no fire, no explosion' },
  ],
};

/** The shared preamble above the BMS table, used as its intro. */
const BMS_TITLE = 'BMS / PCM protection functions';

/**
 * The BMS table, flattened.
 *
 * The source is three columns — Item, Content, Criterion — with the Item cell
 * merged across several rows. Two columns are what the page renders, so the
 * Item is folded into the label where the Content alone would repeat
 * ("Detection delay time" appears under both over-current and short circuit).
 * No value is altered.
 */
export interface BmsFigures {
  overChargeDetection: string;
  overChargeRelease: string;
  maxChargeVoltage: string;
  standardChargeCurrent: string;
  overDischargeDetection: string;
  overDischargeDelay: string;
  overDischargeRelease: string;
  overCurrentDetection: string;
  overCurrentDelay: string;
  maxContinuousCurrent: string;
  shortCircuitDetection: string;
}

export function bmsGroup(figures: BmsFigures): SpecGroup {
  return {
    title: BMS_TITLE,
    specs: [
      { label: 'Over charge detection voltage', value: figures.overChargeDetection },
      { label: 'Over charge release voltage', value: figures.overChargeRelease },
      { label: 'Maximum charge voltage', value: figures.maxChargeVoltage },
      { label: 'Standard charge current', value: figures.standardChargeCurrent },
      { label: 'Over discharge detection voltage', value: figures.overDischargeDetection },
      { label: 'Over discharge detection delay time', value: figures.overDischargeDelay },
      { label: 'Over discharge release voltage', value: figures.overDischargeRelease },
      { label: 'Over current detection current', value: figures.overCurrentDetection },
      { label: 'Over current detection delay time', value: figures.overCurrentDelay },
      { label: 'Over current release condition', value: 'Cut load' },
      { label: 'Maximum continuous current', value: figures.maxContinuousCurrent },
      { label: 'Short circuit detection condition', value: figures.shortCircuitDetection },
      { label: 'Short circuit detection delay time', value: '200 µs' },
      { label: 'Short circuit release condition', value: 'Cut short circuit' },
    ],
  };
}

/** §"Chogori connector pin details", identical in the two CAN-enabled packs. */
export const CHOGORI_PIN_GROUP: SpecGroup = {
  title: 'Chogori connector pin details',
  specs: [
    { label: 'Pin 1', value: 'Main Positive (+)' },
    { label: 'Pin 2', value: 'Main Negative (−)' },
    { label: 'Pin 3', value: 'CAN L' },
    { label: 'Pin 4', value: 'CAN H' },
    { label: 'Pin 5', value: 'Switch 1' },
    { label: 'Pin 6', value: 'Switch 2' },
  ],
};

/** The four FAQ answers that are identical across all six EV documents. */
export const EV_SHARED_FAQS: ProductFaq[] = [
  {
    question: 'Is LFP safer than the NMC batteries in the news for fires?',
    answer:
      'Yes. LFP has a far higher thermal-runaway threshold and does not release oxygen when abused. This pack has been tested for over-charge, short circuit, nail puncture and thermal shock with no fire and no explosion, and the BMS cuts load on over-current, over-discharge and short circuit.',
  },
  {
    question: 'How many years will the battery last?',
    answer:
      'Rated for 2000 cycles at 0.5C and 25°C. At one full charge per day that is roughly 5–6 years of daily use before capacity drops to end-of-life, versus about 1–1.5 years for lead-acid EV batteries.',
  },
  {
    question: 'Does it need maintenance?',
    answer:
      'No. No water topping, no acid, no terminal corrosion. Keep the connector clean and avoid leaving the pack at 0% for long periods.',
  },
  {
    question: 'What happens at end of life?',
    answer:
      "The pack is fully recyclable. Return it through iTarang's battery buyback / take-back programme under the Battery Waste Management Rules, 2022. Never dispose of it in household waste.",
  },
];

/** Care points, assembled from the verbatim sentences of EV FAQ 6 and 7. */
export function evCare(enclosure: string): string[] {
  return [
    'No water topping, no acid, no terminal corrosion.',
    `${enclosure} — mount inside the vehicle's battery compartment and keep the connector dry.`,
    'Store between 15°C and 35°C.',
    'Keep the connector clean and avoid leaving the pack at 0% for long periods.',
  ];
}

/** The four supplied images, in gallery order, for one model's file prefix. */
export function mediaFor(prefix: string, label: string): ProductSeed['media'] {
  return [
    {
      file: `${prefix}_1_Battery.jpg`,
      role: 'battery',
      altText: `${label} — product view`,
    },
    {
      file: `${prefix}_2_Size_Specifications.jpg`,
      role: 'size',
      altText: `${label} — dimensions and weight`,
    },
    {
      file: `${prefix}_3_Voltage_Amp.jpg`,
      role: 'electrical',
      altText: `${label} — voltage, capacity and energy`,
    },
    {
      file: `${prefix}_4_Ecommerce_Listing.jpg`,
      role: 'listing',
      altText: `${label} — specification summary`,
    },
  ];
}

export const HSN = '8507 60 00';
export const GST = 0.18;
