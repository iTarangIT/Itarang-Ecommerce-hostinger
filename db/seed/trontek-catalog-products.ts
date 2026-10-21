import type { ProductSeed } from '../../src/lib/products/seed-types.ts';
import { GST, HSN, mediaFor } from './trontek-shared.ts';

/**
 * The rest of the Trontek catalogue: eight 3-wheeler / e-rickshaw packs, four
 * TK-51.2 series ESS units, two EKON C&I storage cubes and nineteen chargers.
 *
 * Transcribed from the listing sheets in the `trontek-product-catalog` set
 * (`listings/<stem>.md`, converted from `Trontek_<stem>_Product_Listing.docx`);
 * the images are the four `<stem>_n_*.jpg` files of the same set. The rules
 * are the ones in `seed-types.ts`: a placeholder becomes `null` or is left out,
 * and strings are copied verbatim, typos included.
 *
 * **Every product here is a draft, and unpriced.** The ESS and charger sheets
 * read "₹ [insert from price list]"; the BESS sheets say "On request — project
 * quotation". The e-rickshaw sheets do print an MRP and selling price, but
 * those are computed at a flat ₹25 / Wh and ₹18 / Wh rather than taken from a
 * price list, so they are not used. Nothing here can be published until an
 * administrator prices it.
 *
 * What else the sheets leave open, and this file therefore leaves open too:
 *
 *  1. Warranty. Only the e-rickshaw packs ("3 years or 1200 cycles") and the
 *     ESS units ("5 years or 4000 cycles … (design life 10 years)") state one.
 *     The chargers read "[insert Trontek charger warranty]" and the BESS cubes
 *     "[as per supply contract — confirm with Trontek]"; both carry
 *     `warranty*: null`. The chargers' "What is the warranty?" FAQ is dropped,
 *     because its answer opens with that placeholder.
 *  2. Weight. Every e-rickshaw sheet gives net and shipping weight as
 *     "[confirm with Trontek — not stated on poster]", and its detailed
 *     charge/discharge ratings as "[add from Trontek datasheet]". Those rows are
 *     left out. None of these sheets states a maximum charge voltage, so no
 *     such row is written; `linked-products.ts` derives one from the nominal
 *     voltage for an e-rickshaw pack.
 *  3. HSN. The chargers' sheets give 8504 40 (static converters / battery
 *     chargers), not the battery code, so they use `CHARGER_HSN` below. The
 *     BESS sheets give "8507 60 00 (battery) / 8504 40 (PCS)"; the column takes
 *     the battery code and the product-details row keeps the full text.
 *  4. The e-rickshaw FAQ "How is this better than the lead-acid bank in my
 *     rickshaw?" is a lead-acid comparison and is dropped, per the business's
 *     website changes. Safety instructions that name lead-acid ("a lead-acid
 *     charger will damage the pack", "Do not use on lead-acid batteries") stay.
 *  5. SKUs are minted here as before (`TRN-<model>`, chargers `TRN-CHG-<model>`);
 *     no sheet supplies one.
 *
 * Rows that repeat a structured column or another table are not transcribed
 * twice: "Net quantity" is the `netQuantity` column, and section 2's
 * dimensions (and its weight, where it matches section 7) live in the size
 * table built from sections 6 and 7.
 */

/** Section 8 of every charger sheet: "8504 40 (static converters / battery chargers)". */
const CHARGER_HSN = '8504 40';

/** A single, unpriced, untracked variant — the only kind a draft starts with. */
function unpriced(sku: string): ProductSeed['variants'][number] {
  return {
    variantKey: 'default',
    sku,
    title: '',
    optionValues: {},
    mrp: null,
    selling: null,
    stock: null,
    availability: 'in-stock',
  };
}

export const TRONTEK_CATALOG_PRODUCTS: ProductSeed[] = [
  /* ============================================================ 3-wheeler / e-rickshaw packs */

  /* -------------------- 3W · TK LiEV-51140 · 51V 140Ah */
  {
    productKey: 'trontek-liev-51140',
    slug: 'trontek-liev-51v-140ah-e-rickshaw',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek LiEV LiFePO4 EV Battery 51V 140Ah (7.168 kWh)',
    subtitle: 'Lithium Iron Phosphate EV traction battery pack',
    modelName: 'TK LiEV-51140',
    genericName: 'Lithium Iron Phosphate EV traction battery pack',
    productType: null,
    netQuantity: '1 Count',
    category: 'batteries',
    subcategory: 'ev-3-wheeler',
    art: 'battery',
    countryOfOrigin: 'India',
    description: [
      'The Trontek TK LiEV-51140 is a 51.2V 140Ah (7.168 kWh) lithium iron phosphate traction pack for electric three-wheelers. It ships as a complete kit — battery, 51V 25A charger, Anderson SB50 connector and an external SOC indicator — so a dealer can fit it as a drop-in lead-acid replacement. LFP chemistry gives long cycle life, steady voltage under load and no thermal runaway; the BMS monitors every cell and cuts load on any fault. Trontek is an established Indian manufacturer with 1 GWh capacity and in-house R&D and testing.',
    ],
    highlights: [
      'Lithium Ferro Phosphate cells — safest lithium chemistry for road use',
      'Intelligent BMS: over-charge, over-discharge, over-current, short-circuit and over-temperature protection with cell balancing',
      'External SOC indicator so the driver always sees real charge and temperature',
      'Anderson SB50 quick-connect output',
      'Bundled Trontek charger matched to the pack',
      'Withstands high vibration and shock; no maintenance',
    ],
    boxContents: [
      '51V 25A Trontek charger',
      'Anderson SB50 output connector',
      'external SOC (state-of-charge) indicator',
    ],
    careInstructions: null,
    // Stated in the product-details table and in FAQ 7.
    warrantyMonths: 36,
    warrantyCycles: 1200,
    warrantyText: '3 years or 1200 cycles, whichever is earlier',
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: HSN,
    taxRate: GST,
    facets: { batteryAh: 140, voltage: 51.2, technology: 'LiFePO4', warrantyMonths: 36 },
    badges: [],
    popularityRank: 9,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-TKLIEV51140')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Model', value: 'TK LiEV-51140' },
          { label: 'Nominal voltage', value: '51.2 V' },
          { label: 'Nominal capacity', value: '140 Ah' },
          { label: 'Battery pack energy', value: '7.168 kWh (7168 Wh)' },
          { label: 'Cell type', value: 'LFP 3.2 V prismatic' },
          { label: 'Charger', value: '51V 25A Trontek charger' },
          { label: 'Output connector', value: 'Anderson SB50' },
          { label: 'SOC indicator', value: 'External LCD (V / A / °C / SOC %)' },
          {
            label: 'BMS protections',
            value:
              'Over-charge, over-discharge, over-current, short-circuit, over-temperature, cell balancing',
          },
        ],
      },
      {
        title: 'Size',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '531 × 430 × 260 mm' },
          { label: 'In centimetres', value: '53.1 × 43.0 × 26.0 cm' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek LiEV LiFePO4 EV Battery 51V 140Ah (7.168 kWh)' },
          { label: 'Model name', value: 'TK LiEV-51140' },
          { label: 'Category', value: '3-Wheeler / E-Rickshaw Lithium Battery / EV Battery' },
          { label: 'Generic name', value: 'Lithium Iron Phosphate EV traction battery pack' },
          { label: 'Battery cell composition', value: 'Lithium Iron Phosphate (LiFePO4 / LFP)' },
          { label: 'Voltage', value: '51.2 V (nominal)' },
          { label: 'Capacity', value: '140 Ah (7.168 kWh)' },
          {
            label: 'Recommended uses',
            value:
              'Electric 3-wheelers — e-rickshaws, e-loaders and L5 cargo vehicles on a 48V system; OEM fitment or lead-acid replacement with compatible controller',
          },
          {
            label: 'Supplied with',
            value:
              '51V 25A Trontek charger; Anderson SB50 output connector; external SOC (state-of-charge) indicator',
          },
          { label: 'Connector', value: 'Anderson SB50' },
          { label: 'Charger', value: '51V 25A Trontek charger' },
          {
            label: 'SOC display',
            value:
              'External Trontek LCD indicator — voltage, current, temperature, SOC %, charging/protection status',
          },
          {
            label: 'Enclosure',
            value:
              'Powder-coated steel enclosure, orange top cover, dual carry handles, mounting feet',
          },
          { label: 'Colour', value: 'Black with orange top' },
          { label: 'Country of origin', value: 'India' },
          { label: 'Warranty', value: '3 years or 1200 cycles, whichever is earlier' },
          { label: 'HSN code', value: '8507 60 00' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which vehicles is this battery for?',
        answer:
          'Any 48V-system electric 3-wheeler — passenger e-rickshaw, e-loader or L5 cargo — whose controller accepts a 51.2V nominal LFP pack. Confirm connector (Anderson SB50) and charger compatibility with iTarang before purchase.',
      },
      {
        question: 'What range will I get?',
        answer:
          'The pack stores 7.168 kWh. E-rickshaws typically consume 45–65 Wh/km, so expect roughly 110–159 km per charge depending on passenger load, speed and terrain.',
      },
      {
        question: 'Is the charger included?',
        answer:
          'Yes — a 51V 25A Trontek charger is bundled. Use only this or another Trontek-approved LFP charger; a lead-acid charger will damage the pack and void the warranty.',
      },
      {
        question: 'What does the SOC indicator show?',
        answer:
          'Live voltage, current, temperature, charge percentage and charging/protection status, mounted on the dashboard so the driver never guesses remaining range.',
      },
      {
        question: 'Is it safe in summer and rain?',
        answer:
          'LFP does not thermally run away; the BMS throttles charging above safe temperature. The steel enclosure is splash-resistant but not submersible — keep the connector dry and do not drive through deep water.',
      },
      {
        question: 'What is the warranty?',
        answer:
          '3 years or 1200 cycles, whichever is earlier. Void if a non-approved charger is used or the pack is opened.',
      },
      {
        question: 'What happens at end of life?',
        answer:
          "Return it through iTarang's battery buyback programme; we pay for the old pack and recycle it under the Battery Waste Management Rules, 2022.",
      },
    ],
    sections: [
      {
        kind: 'compatibility',
        items: [
          'Connector: Anderson SB50',
          'Charger: 51V 25A Trontek charger',
          'Electric 3-wheelers — e-rickshaws, e-loaders and L5 cargo vehicles on a 48V system; OEM fitment or lead-acid replacement with compatible controller',
        ],
      },
      {
        kind: 'care',
        items: [
          'The steel enclosure is splash-resistant but not submersible — keep the connector dry and do not drive through deep water.',
        ],
      },
    ],
    media: mediaFor('LiEV_51V_140Ah_ERickshaw', 'Trontek LiEV 51V 140Ah (TK LiEV-51140)'),
  },

  /* -------------------- 3W · TK LiEV-51153 · 51V 153Ah */
  {
    productKey: 'trontek-liev-51153',
    slug: 'trontek-liev-51v-153ah-e-rickshaw',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek LiEV LiFePO4 EV Battery 51V 153Ah (7.834 kWh)',
    subtitle: 'Lithium Iron Phosphate EV traction battery pack',
    modelName: 'TK LiEV-51153',
    genericName: 'Lithium Iron Phosphate EV traction battery pack',
    productType: null,
    netQuantity: '1 Count',
    category: 'batteries',
    subcategory: 'ev-3-wheeler',
    art: 'battery',
    countryOfOrigin: 'India',
    description: [
      'The Trontek TK LiEV-51153 is a 51.2V 153Ah (7.834 kWh) lithium iron phosphate traction pack for electric three-wheelers. It ships as a complete kit — battery, 51V 25A charger, Anderson SB120 connector and an external SOC indicator — so a dealer can fit it as a drop-in lead-acid replacement. LFP chemistry gives long cycle life, steady voltage under load and no thermal runaway; the BMS monitors every cell and cuts load on any fault. Trontek is an established Indian manufacturer with 1 GWh capacity and in-house R&D and testing.',
    ],
    highlights: [
      'Lithium Ferro Phosphate cells — safest lithium chemistry for road use',
      'Intelligent BMS: over-charge, over-discharge, over-current, short-circuit and over-temperature protection with cell balancing',
      'External SOC indicator so the driver always sees real charge and temperature',
      'Anderson SB120 quick-connect output',
      'Bundled Trontek charger matched to the pack',
      'Withstands high vibration and shock; no maintenance',
    ],
    boxContents: [
      '51V 25A Trontek charger',
      'Anderson SB120 output connector',
      'external SOC (state-of-charge) indicator',
    ],
    careInstructions: null,
    // Stated in the product-details table and in FAQ 7.
    warrantyMonths: 36,
    warrantyCycles: 1200,
    warrantyText: '3 years or 1200 cycles, whichever is earlier',
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: HSN,
    taxRate: GST,
    facets: { batteryAh: 153, voltage: 51.2, technology: 'LiFePO4', warrantyMonths: 36 },
    badges: [],
    popularityRank: 10,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-TKLIEV51153')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Model', value: 'TK LiEV-51153' },
          { label: 'Nominal voltage', value: '51.2 V' },
          { label: 'Nominal capacity', value: '153 Ah' },
          { label: 'Battery pack energy', value: '7.834 kWh (7833.6 Wh)' },
          { label: 'Cell type', value: 'LFP 3.2 V prismatic' },
          { label: 'Charger', value: '51V 25A Trontek charger' },
          { label: 'Output connector', value: 'Anderson SB120' },
          { label: 'SOC indicator', value: 'External LCD (V / A / °C / SOC %)' },
          {
            label: 'BMS protections',
            value:
              'Over-charge, over-discharge, over-current, short-circuit, over-temperature, cell balancing',
          },
        ],
      },
      {
        title: 'Size',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '590 × 430 × 285 mm' },
          { label: 'In centimetres', value: '59.0 × 43.0 × 28.5 cm' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek LiEV LiFePO4 EV Battery 51V 153Ah (7.834 kWh)' },
          { label: 'Model name', value: 'TK LiEV-51153' },
          { label: 'Category', value: '3-Wheeler / E-Rickshaw Lithium Battery / EV Battery' },
          { label: 'Generic name', value: 'Lithium Iron Phosphate EV traction battery pack' },
          { label: 'Battery cell composition', value: 'Lithium Iron Phosphate (LiFePO4 / LFP)' },
          { label: 'Voltage', value: '51.2 V (nominal)' },
          { label: 'Capacity', value: '153 Ah (7.834 kWh)' },
          {
            label: 'Recommended uses',
            value:
              'Electric 3-wheelers — e-rickshaws, e-loaders and L5 cargo vehicles on a 48V system; OEM fitment or lead-acid replacement with compatible controller',
          },
          {
            label: 'Supplied with',
            value:
              '51V 25A Trontek charger; Anderson SB120 output connector; external SOC (state-of-charge) indicator',
          },
          { label: 'Connector', value: 'Anderson SB120' },
          { label: 'Charger', value: '51V 25A Trontek charger' },
          {
            label: 'SOC display',
            value:
              'External Trontek LCD indicator — voltage, current, temperature, SOC %, charging/protection status',
          },
          {
            label: 'Enclosure',
            value:
              'Powder-coated steel enclosure, orange top cover, dual carry handles, mounting feet',
          },
          { label: 'Colour', value: 'Black with orange top' },
          { label: 'Country of origin', value: 'India' },
          { label: 'Warranty', value: '3 years or 1200 cycles, whichever is earlier' },
          { label: 'HSN code', value: '8507 60 00' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which vehicles is this battery for?',
        answer:
          'Any 48V-system electric 3-wheeler — passenger e-rickshaw, e-loader or L5 cargo — whose controller accepts a 51.2V nominal LFP pack. Confirm connector (Anderson SB120) and charger compatibility with iTarang before purchase.',
      },
      {
        question: 'What range will I get?',
        answer:
          'The pack stores 7.834 kWh. E-rickshaws typically consume 45–65 Wh/km, so expect roughly 121–174 km per charge depending on passenger load, speed and terrain.',
      },
      {
        question: 'Is the charger included?',
        answer:
          'Yes — a 51V 25A Trontek charger is bundled. Use only this or another Trontek-approved LFP charger; a lead-acid charger will damage the pack and void the warranty.',
      },
      {
        question: 'What does the SOC indicator show?',
        answer:
          'Live voltage, current, temperature, charge percentage and charging/protection status, mounted on the dashboard so the driver never guesses remaining range.',
      },
      {
        question: 'Is it safe in summer and rain?',
        answer:
          'LFP does not thermally run away; the BMS throttles charging above safe temperature. The steel enclosure is splash-resistant but not submersible — keep the connector dry and do not drive through deep water.',
      },
      {
        question: 'What is the warranty?',
        answer:
          '3 years or 1200 cycles, whichever is earlier. Void if a non-approved charger is used or the pack is opened.',
      },
      {
        question: 'What happens at end of life?',
        answer:
          "Return it through iTarang's battery buyback programme; we pay for the old pack and recycle it under the Battery Waste Management Rules, 2022.",
      },
    ],
    sections: [
      {
        kind: 'compatibility',
        items: [
          'Connector: Anderson SB120',
          'Charger: 51V 25A Trontek charger',
          'Electric 3-wheelers — e-rickshaws, e-loaders and L5 cargo vehicles on a 48V system; OEM fitment or lead-acid replacement with compatible controller',
        ],
      },
      {
        kind: 'care',
        items: [
          'The steel enclosure is splash-resistant but not submersible — keep the connector dry and do not drive through deep water.',
        ],
      },
    ],
    media: mediaFor('LiEV_51V_153Ah_ERickshaw', 'Trontek LiEV 51V 153Ah (TK LiEV-51153)'),
  },

  /* -------------------- 3W · TK LiEV-61105 · 61V 105Ah */
  {
    productKey: 'trontek-liev-61105',
    slug: 'trontek-liev-61v-105ah-e-rickshaw',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek LiEV LiFePO4 EV Battery 61V 105Ah (6.384 kWh)',
    subtitle: 'Lithium Iron Phosphate EV traction battery pack',
    modelName: 'TK LiEV-61105',
    genericName: 'Lithium Iron Phosphate EV traction battery pack',
    productType: null,
    netQuantity: '1 Count',
    category: 'batteries',
    subcategory: 'ev-3-wheeler',
    art: 'battery',
    countryOfOrigin: 'India',
    description: [
      'The Trontek TK LiEV-61105 is a 60.8V 105Ah (6.384 kWh) lithium iron phosphate traction pack for electric three-wheelers. It ships as a complete kit — battery, 60V 20A charger, Anderson SB75 connector and an external SOC indicator — so a dealer can fit it as a drop-in lead-acid replacement. LFP chemistry gives long cycle life, steady voltage under load and no thermal runaway; the BMS monitors every cell and cuts load on any fault. Trontek is an established Indian manufacturer with 1 GWh capacity and in-house R&D and testing.',
    ],
    highlights: [
      'Lithium Ferro Phosphate cells — safest lithium chemistry for road use',
      'Intelligent BMS: over-charge, over-discharge, over-current, short-circuit and over-temperature protection with cell balancing',
      'External SOC indicator so the driver always sees real charge and temperature',
      'Anderson SB75 quick-connect output',
      'Bundled Trontek charger matched to the pack',
      'Withstands high vibration and shock; no maintenance',
    ],
    boxContents: [
      '60V 20A Trontek charger',
      'Anderson SB75 output connector',
      'external SOC (state-of-charge) indicator',
    ],
    careInstructions: null,
    // Stated in the product-details table and in FAQ 7.
    warrantyMonths: 36,
    warrantyCycles: 1200,
    warrantyText: '3 years or 1200 cycles, whichever is earlier',
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: HSN,
    taxRate: GST,
    facets: { batteryAh: 105, voltage: 60.8, technology: 'LiFePO4', warrantyMonths: 36 },
    badges: [],
    popularityRank: 11,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-TKLIEV61105')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Model', value: 'TK LiEV-61105' },
          { label: 'Nominal voltage', value: '60.8 V' },
          { label: 'Nominal capacity', value: '105 Ah' },
          { label: 'Battery pack energy', value: '6.384 kWh (6384 Wh)' },
          { label: 'Cell type', value: 'LFP 3.2 V prismatic' },
          { label: 'Charger', value: '60V 20A Trontek charger' },
          { label: 'Output connector', value: 'Anderson SB75' },
          { label: 'SOC indicator', value: 'External LCD (V / A / °C / SOC %)' },
          {
            label: 'BMS protections',
            value:
              'Over-charge, over-discharge, over-current, short-circuit, over-temperature, cell balancing',
          },
        ],
      },
      {
        title: 'Size',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '700 × 425 × 300 mm' },
          { label: 'In centimetres', value: '70.0 × 42.5 × 30.0 cm' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek LiEV LiFePO4 EV Battery 61V 105Ah (6.384 kWh)' },
          { label: 'Model name', value: 'TK LiEV-61105' },
          { label: 'Category', value: '3-Wheeler / E-Rickshaw Lithium Battery / EV Battery' },
          { label: 'Generic name', value: 'Lithium Iron Phosphate EV traction battery pack' },
          { label: 'Battery cell composition', value: 'Lithium Iron Phosphate (LiFePO4 / LFP)' },
          { label: 'Voltage', value: '60.8 V (nominal)' },
          { label: 'Capacity', value: '105 Ah (6.384 kWh)' },
          {
            label: 'Recommended uses',
            value:
              'Electric 3-wheelers — e-rickshaws, e-loaders and L5 cargo vehicles on a 60V system; OEM fitment or lead-acid replacement with compatible controller',
          },
          {
            label: 'Supplied with',
            value:
              '60V 20A Trontek charger; Anderson SB75 output connector; external SOC (state-of-charge) indicator',
          },
          { label: 'Connector', value: 'Anderson SB75' },
          { label: 'Charger', value: '60V 20A Trontek charger' },
          {
            label: 'SOC display',
            value:
              'External Trontek LCD indicator — voltage, current, temperature, SOC %, charging/protection status',
          },
          {
            label: 'Enclosure',
            value:
              'Powder-coated steel enclosure, orange top cover, dual carry handles, mounting feet',
          },
          { label: 'Colour', value: 'Black with orange top' },
          { label: 'Country of origin', value: 'India' },
          { label: 'Warranty', value: '3 years or 1200 cycles, whichever is earlier' },
          { label: 'HSN code', value: '8507 60 00' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which vehicles is this battery for?',
        answer:
          'Any 60V-system electric 3-wheeler — passenger e-rickshaw, e-loader or L5 cargo — whose controller accepts a 60.8V nominal LFP pack. Confirm connector (Anderson SB75) and charger compatibility with iTarang before purchase.',
      },
      {
        question: 'What range will I get?',
        answer:
          'The pack stores 6.384 kWh. E-rickshaws typically consume 45–65 Wh/km, so expect roughly 98–142 km per charge depending on passenger load, speed and terrain.',
      },
      {
        question: 'Is the charger included?',
        answer:
          'Yes — a 60V 20A Trontek charger is bundled. Use only this or another Trontek-approved LFP charger; a lead-acid charger will damage the pack and void the warranty.',
      },
      {
        question: 'What does the SOC indicator show?',
        answer:
          'Live voltage, current, temperature, charge percentage and charging/protection status, mounted on the dashboard so the driver never guesses remaining range.',
      },
      {
        question: 'Is it safe in summer and rain?',
        answer:
          'LFP does not thermally run away; the BMS throttles charging above safe temperature. The steel enclosure is splash-resistant but not submersible — keep the connector dry and do not drive through deep water.',
      },
      {
        question: 'What is the warranty?',
        answer:
          '3 years or 1200 cycles, whichever is earlier. Void if a non-approved charger is used or the pack is opened.',
      },
      {
        question: 'What happens at end of life?',
        answer:
          "Return it through iTarang's battery buyback programme; we pay for the old pack and recycle it under the Battery Waste Management Rules, 2022.",
      },
    ],
    sections: [
      {
        kind: 'compatibility',
        items: [
          'Connector: Anderson SB75',
          'Charger: 60V 20A Trontek charger',
          'Electric 3-wheelers — e-rickshaws, e-loaders and L5 cargo vehicles on a 60V system; OEM fitment or lead-acid replacement with compatible controller',
        ],
      },
      {
        kind: 'care',
        items: [
          'The steel enclosure is splash-resistant but not submersible — keep the connector dry and do not drive through deep water.',
        ],
      },
    ],
    media: mediaFor('LiEV_61V_105Ah_ERickshaw', 'Trontek LiEV 61V 105Ah (TK LiEV-61105)'),
  },

  /* -------------------- 3W · TK LiEV-61140 · 61V 140Ah */
  {
    productKey: 'trontek-liev-61140',
    slug: 'trontek-liev-61v-140ah-e-rickshaw',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek LiEV LiFePO4 EV Battery 61V 140Ah (8.512 kWh)',
    subtitle: 'Lithium Iron Phosphate EV traction battery pack',
    modelName: 'TK LiEV-61140',
    genericName: 'Lithium Iron Phosphate EV traction battery pack',
    productType: null,
    netQuantity: '1 Count',
    category: 'batteries',
    subcategory: 'ev-3-wheeler',
    art: 'battery',
    countryOfOrigin: 'India',
    description: [
      'The Trontek TK LiEV-61140 is a 60.8V 140Ah (8.512 kWh) lithium iron phosphate traction pack for electric three-wheelers. It ships as a complete kit — battery, 60V 20A charger, Anderson SB75 connector and an external SOC indicator — so a dealer can fit it as a drop-in lead-acid replacement. LFP chemistry gives long cycle life, steady voltage under load and no thermal runaway; the BMS monitors every cell and cuts load on any fault. Trontek is an established Indian manufacturer with 1 GWh capacity and in-house R&D and testing.',
    ],
    highlights: [
      'Lithium Ferro Phosphate cells — safest lithium chemistry for road use',
      'Intelligent BMS: over-charge, over-discharge, over-current, short-circuit and over-temperature protection with cell balancing',
      'External SOC indicator so the driver always sees real charge and temperature',
      'Anderson SB75 quick-connect output',
      'Bundled Trontek charger matched to the pack',
      'Withstands high vibration and shock; no maintenance',
    ],
    boxContents: [
      '60V 20A Trontek charger',
      'Anderson SB75 output connector',
      'external SOC (state-of-charge) indicator',
    ],
    careInstructions: null,
    // Stated in the product-details table and in FAQ 7.
    warrantyMonths: 36,
    warrantyCycles: 1200,
    warrantyText: '3 years or 1200 cycles, whichever is earlier',
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: HSN,
    taxRate: GST,
    facets: { batteryAh: 140, voltage: 60.8, technology: 'LiFePO4', warrantyMonths: 36 },
    badges: [],
    popularityRank: 12,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-TKLIEV61140')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Model', value: 'TK LiEV-61140' },
          { label: 'Nominal voltage', value: '60.8 V' },
          { label: 'Nominal capacity', value: '140 Ah' },
          { label: 'Battery pack energy', value: '8.512 kWh (8512 Wh)' },
          { label: 'Cell type', value: 'LFP 3.2 V prismatic' },
          { label: 'Charger', value: '60V 20A Trontek charger' },
          { label: 'Output connector', value: 'Anderson SB75' },
          { label: 'SOC indicator', value: 'External LCD (V / A / °C / SOC %)' },
          {
            label: 'BMS protections',
            value:
              'Over-charge, over-discharge, over-current, short-circuit, over-temperature, cell balancing',
          },
        ],
      },
      {
        title: 'Size',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '620 × 430 × 265 mm' },
          { label: 'In centimetres', value: '62.0 × 43.0 × 26.5 cm' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek LiEV LiFePO4 EV Battery 61V 140Ah (8.512 kWh)' },
          { label: 'Model name', value: 'TK LiEV-61140' },
          { label: 'Category', value: '3-Wheeler / E-Rickshaw Lithium Battery / EV Battery' },
          { label: 'Generic name', value: 'Lithium Iron Phosphate EV traction battery pack' },
          { label: 'Battery cell composition', value: 'Lithium Iron Phosphate (LiFePO4 / LFP)' },
          { label: 'Voltage', value: '60.8 V (nominal)' },
          { label: 'Capacity', value: '140 Ah (8.512 kWh)' },
          {
            label: 'Recommended uses',
            value:
              'Electric 3-wheelers — e-rickshaws, e-loaders and L5 cargo vehicles on a 60V system; OEM fitment or lead-acid replacement with compatible controller',
          },
          {
            label: 'Supplied with',
            value:
              '60V 20A Trontek charger; Anderson SB75 output connector; external SOC (state-of-charge) indicator',
          },
          { label: 'Connector', value: 'Anderson SB75' },
          { label: 'Charger', value: '60V 20A Trontek charger' },
          {
            label: 'SOC display',
            value:
              'External Trontek LCD indicator — voltage, current, temperature, SOC %, charging/protection status',
          },
          {
            label: 'Enclosure',
            value:
              'Powder-coated steel enclosure, orange top cover, dual carry handles, mounting feet',
          },
          { label: 'Colour', value: 'Black with orange top' },
          { label: 'Country of origin', value: 'India' },
          { label: 'Warranty', value: '3 years or 1200 cycles, whichever is earlier' },
          { label: 'HSN code', value: '8507 60 00' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which vehicles is this battery for?',
        answer:
          'Any 60V-system electric 3-wheeler — passenger e-rickshaw, e-loader or L5 cargo — whose controller accepts a 60.8V nominal LFP pack. Confirm connector (Anderson SB75) and charger compatibility with iTarang before purchase.',
      },
      {
        question: 'What range will I get?',
        answer:
          'The pack stores 8.512 kWh. E-rickshaws typically consume 45–65 Wh/km, so expect roughly 131–189 km per charge depending on passenger load, speed and terrain.',
      },
      {
        question: 'Is the charger included?',
        answer:
          'Yes — a 60V 20A Trontek charger is bundled. Use only this or another Trontek-approved LFP charger; a lead-acid charger will damage the pack and void the warranty.',
      },
      {
        question: 'What does the SOC indicator show?',
        answer:
          'Live voltage, current, temperature, charge percentage and charging/protection status, mounted on the dashboard so the driver never guesses remaining range.',
      },
      {
        question: 'Is it safe in summer and rain?',
        answer:
          'LFP does not thermally run away; the BMS throttles charging above safe temperature. The steel enclosure is splash-resistant but not submersible — keep the connector dry and do not drive through deep water.',
      },
      {
        question: 'What is the warranty?',
        answer:
          '3 years or 1200 cycles, whichever is earlier. Void if a non-approved charger is used or the pack is opened.',
      },
      {
        question: 'What happens at end of life?',
        answer:
          "Return it through iTarang's battery buyback programme; we pay for the old pack and recycle it under the Battery Waste Management Rules, 2022.",
      },
    ],
    sections: [
      {
        kind: 'compatibility',
        items: [
          'Connector: Anderson SB75',
          'Charger: 60V 20A Trontek charger',
          'Electric 3-wheelers — e-rickshaws, e-loaders and L5 cargo vehicles on a 60V system; OEM fitment or lead-acid replacement with compatible controller',
        ],
      },
      {
        kind: 'care',
        items: [
          'The steel enclosure is splash-resistant but not submersible — keep the connector dry and do not drive through deep water.',
        ],
      },
    ],
    media: mediaFor('LiEV_61V_140Ah_ERickshaw', 'Trontek LiEV 61V 140Ah (TK LiEV-61140)'),
  },

  /* -------------------- 3W · TK LiEV-61153 · 61V 153Ah */
  {
    productKey: 'trontek-liev-61153',
    slug: 'trontek-liev-61v-153ah-e-rickshaw',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek LiEV LiFePO4 EV Battery 61V 153Ah (9.302 kWh)',
    subtitle: 'Lithium Iron Phosphate EV traction battery pack',
    modelName: 'TK LiEV-61153',
    genericName: 'Lithium Iron Phosphate EV traction battery pack',
    productType: null,
    netQuantity: '1 Count',
    category: 'batteries',
    subcategory: 'ev-3-wheeler',
    art: 'battery',
    countryOfOrigin: 'India',
    description: [
      'The Trontek TK LiEV-61153 is a 60.8V 153Ah (9.302 kWh) lithium iron phosphate traction pack for electric three-wheelers. It ships as a complete kit — battery, 60V 20A charger, Anderson SB120 connector and an external SOC indicator — so a dealer can fit it as a drop-in lead-acid replacement. LFP chemistry gives long cycle life, steady voltage under load and no thermal runaway; the BMS monitors every cell and cuts load on any fault. Trontek is an established Indian manufacturer with 1 GWh capacity and in-house R&D and testing.',
    ],
    highlights: [
      'Lithium Ferro Phosphate cells — safest lithium chemistry for road use',
      'Intelligent BMS: over-charge, over-discharge, over-current, short-circuit and over-temperature protection with cell balancing',
      'External SOC indicator so the driver always sees real charge and temperature',
      'Anderson SB120 quick-connect output',
      'Bundled Trontek charger matched to the pack',
      'Withstands high vibration and shock; no maintenance',
    ],
    boxContents: [
      '60V 20A Trontek charger',
      'Anderson SB120 output connector',
      'external SOC (state-of-charge) indicator',
    ],
    careInstructions: null,
    // Stated in the product-details table and in FAQ 7.
    warrantyMonths: 36,
    warrantyCycles: 1200,
    warrantyText: '3 years or 1200 cycles, whichever is earlier',
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: HSN,
    taxRate: GST,
    facets: { batteryAh: 153, voltage: 60.8, technology: 'LiFePO4', warrantyMonths: 36 },
    badges: [],
    popularityRank: 13,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-TKLIEV61153')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Model', value: 'TK LiEV-61153' },
          { label: 'Nominal voltage', value: '60.8 V' },
          { label: 'Nominal capacity', value: '153 Ah' },
          { label: 'Battery pack energy', value: '9.302 kWh (9302.4 Wh)' },
          { label: 'Cell type', value: 'LFP 3.2 V prismatic' },
          { label: 'Charger', value: '60V 20A Trontek charger' },
          { label: 'Output connector', value: 'Anderson SB120' },
          { label: 'SOC indicator', value: 'External LCD (V / A / °C / SOC %)' },
          {
            label: 'BMS protections',
            value:
              'Over-charge, over-discharge, over-current, short-circuit, over-temperature, cell balancing',
          },
        ],
      },
      {
        title: 'Size',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '700 × 425 × 300 mm' },
          { label: 'In centimetres', value: '70.0 × 42.5 × 30.0 cm' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek LiEV LiFePO4 EV Battery 61V 153Ah (9.302 kWh)' },
          { label: 'Model name', value: 'TK LiEV-61153' },
          { label: 'Category', value: '3-Wheeler / E-Rickshaw Lithium Battery / EV Battery' },
          { label: 'Generic name', value: 'Lithium Iron Phosphate EV traction battery pack' },
          { label: 'Battery cell composition', value: 'Lithium Iron Phosphate (LiFePO4 / LFP)' },
          { label: 'Voltage', value: '60.8 V (nominal)' },
          { label: 'Capacity', value: '153 Ah (9.302 kWh)' },
          {
            label: 'Recommended uses',
            value:
              'Electric 3-wheelers — e-rickshaws, e-loaders and L5 cargo vehicles on a 60V system; OEM fitment or lead-acid replacement with compatible controller',
          },
          {
            label: 'Supplied with',
            value:
              '60V 20A Trontek charger; Anderson SB120 output connector; external SOC (state-of-charge) indicator',
          },
          { label: 'Connector', value: 'Anderson SB120' },
          { label: 'Charger', value: '60V 20A Trontek charger' },
          {
            label: 'SOC display',
            value:
              'External Trontek LCD indicator — voltage, current, temperature, SOC %, charging/protection status',
          },
          {
            label: 'Enclosure',
            value:
              'Powder-coated steel enclosure, orange top cover, dual carry handles, mounting feet',
          },
          { label: 'Colour', value: 'Black with orange top' },
          { label: 'Country of origin', value: 'India' },
          { label: 'Warranty', value: '3 years or 1200 cycles, whichever is earlier' },
          { label: 'HSN code', value: '8507 60 00' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which vehicles is this battery for?',
        answer:
          'Any 60V-system electric 3-wheeler — passenger e-rickshaw, e-loader or L5 cargo — whose controller accepts a 60.8V nominal LFP pack. Confirm connector (Anderson SB120) and charger compatibility with iTarang before purchase.',
      },
      {
        question: 'What range will I get?',
        answer:
          'The pack stores 9.302 kWh. E-rickshaws typically consume 45–65 Wh/km, so expect roughly 143–207 km per charge depending on passenger load, speed and terrain.',
      },
      {
        question: 'Is the charger included?',
        answer:
          'Yes — a 60V 20A Trontek charger is bundled. Use only this or another Trontek-approved LFP charger; a lead-acid charger will damage the pack and void the warranty.',
      },
      {
        question: 'What does the SOC indicator show?',
        answer:
          'Live voltage, current, temperature, charge percentage and charging/protection status, mounted on the dashboard so the driver never guesses remaining range.',
      },
      {
        question: 'Is it safe in summer and rain?',
        answer:
          'LFP does not thermally run away; the BMS throttles charging above safe temperature. The steel enclosure is splash-resistant but not submersible — keep the connector dry and do not drive through deep water.',
      },
      {
        question: 'What is the warranty?',
        answer:
          '3 years or 1200 cycles, whichever is earlier. Void if a non-approved charger is used or the pack is opened.',
      },
      {
        question: 'What happens at end of life?',
        answer:
          "Return it through iTarang's battery buyback programme; we pay for the old pack and recycle it under the Battery Waste Management Rules, 2022.",
      },
    ],
    sections: [
      {
        kind: 'compatibility',
        items: [
          'Connector: Anderson SB120',
          'Charger: 60V 20A Trontek charger',
          'Electric 3-wheelers — e-rickshaws, e-loaders and L5 cargo vehicles on a 60V system; OEM fitment or lead-acid replacement with compatible controller',
        ],
      },
      {
        kind: 'care',
        items: [
          'The steel enclosure is splash-resistant but not submersible — keep the connector dry and do not drive through deep water.',
        ],
      },
    ],
    media: mediaFor('LiEV_61V_153Ah_ERickshaw', 'Trontek LiEV 61V 153Ah (TK LiEV-61153)'),
  },

  /* -------------------- 3W · TK LiEV-64105 · 64V 105Ah */
  {
    productKey: 'trontek-liev-64105',
    slug: 'trontek-liev-64v-105ah-e-rickshaw',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek LiEV LiFePO4 EV Battery 64V 105Ah (6.72 kWh)',
    subtitle: 'Lithium Iron Phosphate EV traction battery pack',
    modelName: 'TK LiEV-64105',
    genericName: 'Lithium Iron Phosphate EV traction battery pack',
    productType: null,
    netQuantity: '1 Count',
    category: 'batteries',
    subcategory: 'ev-3-wheeler',
    art: 'battery',
    countryOfOrigin: 'India',
    description: [
      'The Trontek TK LiEV-64105 is a 64V 105Ah (6.720 kWh) lithium iron phosphate traction pack for electric three-wheelers. It ships as a complete kit — battery, 64V 20A charger, Anderson SB75 connector and an external SOC indicator — so a dealer can fit it as a drop-in lead-acid replacement. LFP chemistry gives long cycle life, steady voltage under load and no thermal runaway; the BMS monitors every cell and cuts load on any fault. Trontek is an established Indian manufacturer with 1 GWh capacity and in-house R&D and testing.',
    ],
    highlights: [
      'Lithium Ferro Phosphate cells — safest lithium chemistry for road use',
      'Intelligent BMS: over-charge, over-discharge, over-current, short-circuit and over-temperature protection with cell balancing',
      'External SOC indicator so the driver always sees real charge and temperature',
      'Anderson SB75 quick-connect output',
      'Bundled Trontek charger matched to the pack',
      'Withstands high vibration and shock; no maintenance',
    ],
    boxContents: [
      '64V 20A Trontek charger',
      'Anderson SB75 output connector',
      'external SOC (state-of-charge) indicator',
    ],
    careInstructions: null,
    // Stated in the product-details table and in FAQ 7.
    warrantyMonths: 36,
    warrantyCycles: 1200,
    warrantyText: '3 years or 1200 cycles, whichever is earlier',
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: HSN,
    taxRate: GST,
    facets: { batteryAh: 105, voltage: 64, technology: 'LiFePO4', warrantyMonths: 36 },
    badges: [],
    popularityRank: 14,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-TKLIEV64105')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Model', value: 'TK LiEV-64105' },
          { label: 'Nominal voltage', value: '64 V' },
          { label: 'Nominal capacity', value: '105 Ah' },
          { label: 'Battery pack energy', value: '6.720 kWh (6720 Wh)' },
          { label: 'Cell type', value: 'LFP 3.2 V prismatic' },
          { label: 'Charger', value: '64V 20A Trontek charger' },
          { label: 'Output connector', value: 'Anderson SB75' },
          { label: 'SOC indicator', value: 'External LCD (V / A / °C / SOC %)' },
          {
            label: 'BMS protections',
            value:
              'Over-charge, over-discharge, over-current, short-circuit, over-temperature, cell balancing',
          },
        ],
      },
      {
        title: 'Size',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '700 × 425 × 300 mm' },
          { label: 'In centimetres', value: '70.0 × 42.5 × 30.0 cm' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek LiEV LiFePO4 EV Battery 64V 105Ah (6.72 kWh)' },
          { label: 'Model name', value: 'TK LiEV-64105' },
          { label: 'Category', value: '3-Wheeler / E-Rickshaw Lithium Battery / EV Battery' },
          { label: 'Generic name', value: 'Lithium Iron Phosphate EV traction battery pack' },
          { label: 'Battery cell composition', value: 'Lithium Iron Phosphate (LiFePO4 / LFP)' },
          { label: 'Voltage', value: '64 V (nominal)' },
          { label: 'Capacity', value: '105 Ah (6.720 kWh)' },
          {
            label: 'Recommended uses',
            value:
              'Electric 3-wheelers — e-rickshaws, e-loaders and L5 cargo vehicles on a 64V system; OEM fitment or lead-acid replacement with compatible controller',
          },
          {
            label: 'Supplied with',
            value:
              '64V 20A Trontek charger; Anderson SB75 output connector; external SOC (state-of-charge) indicator',
          },
          { label: 'Connector', value: 'Anderson SB75' },
          { label: 'Charger', value: '64V 20A Trontek charger' },
          {
            label: 'SOC display',
            value:
              'External Trontek LCD indicator — voltage, current, temperature, SOC %, charging/protection status',
          },
          {
            label: 'Enclosure',
            value:
              'Powder-coated steel enclosure, orange top cover, dual carry handles, mounting feet',
          },
          { label: 'Colour', value: 'Black with orange top' },
          { label: 'Country of origin', value: 'India' },
          { label: 'Warranty', value: '3 years or 1200 cycles, whichever is earlier' },
          { label: 'HSN code', value: '8507 60 00' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which vehicles is this battery for?',
        answer:
          'Any 64V-system electric 3-wheeler — passenger e-rickshaw, e-loader or L5 cargo — whose controller accepts a 64V nominal LFP pack. Confirm connector (Anderson SB75) and charger compatibility with iTarang before purchase.',
      },
      {
        question: 'What range will I get?',
        answer:
          'The pack stores 6.720 kWh. E-rickshaws typically consume 45–65 Wh/km, so expect roughly 103–149 km per charge depending on passenger load, speed and terrain.',
      },
      {
        question: 'Is the charger included?',
        answer:
          'Yes — a 64V 20A Trontek charger is bundled. Use only this or another Trontek-approved LFP charger; a lead-acid charger will damage the pack and void the warranty.',
      },
      {
        question: 'What does the SOC indicator show?',
        answer:
          'Live voltage, current, temperature, charge percentage and charging/protection status, mounted on the dashboard so the driver never guesses remaining range.',
      },
      {
        question: 'Is it safe in summer and rain?',
        answer:
          'LFP does not thermally run away; the BMS throttles charging above safe temperature. The steel enclosure is splash-resistant but not submersible — keep the connector dry and do not drive through deep water.',
      },
      {
        question: 'What is the warranty?',
        answer:
          '3 years or 1200 cycles, whichever is earlier. Void if a non-approved charger is used or the pack is opened.',
      },
      {
        question: 'What happens at end of life?',
        answer:
          "Return it through iTarang's battery buyback programme; we pay for the old pack and recycle it under the Battery Waste Management Rules, 2022.",
      },
    ],
    sections: [
      {
        kind: 'compatibility',
        items: [
          'Connector: Anderson SB75',
          'Charger: 64V 20A Trontek charger',
          'Electric 3-wheelers — e-rickshaws, e-loaders and L5 cargo vehicles on a 64V system; OEM fitment or lead-acid replacement with compatible controller',
        ],
      },
      {
        kind: 'care',
        items: [
          'The steel enclosure is splash-resistant but not submersible — keep the connector dry and do not drive through deep water.',
        ],
      },
    ],
    media: mediaFor('LiEV_64V_105Ah_ERickshaw', 'Trontek LiEV 64V 105Ah (TK LiEV-64105)'),
  },

  /* -------------------- 3W · TK LiEV-64140 · 64V 140Ah */
  {
    productKey: 'trontek-liev-64140',
    slug: 'trontek-liev-64v-140ah-e-rickshaw',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek LiEV LiFePO4 EV Battery 64V 140Ah (8.96 kWh)',
    subtitle: 'Lithium Iron Phosphate EV traction battery pack',
    modelName: 'TK LiEV-64140',
    genericName: 'Lithium Iron Phosphate EV traction battery pack',
    productType: null,
    netQuantity: '1 Count',
    category: 'batteries',
    subcategory: 'ev-3-wheeler',
    art: 'battery',
    countryOfOrigin: 'India',
    description: [
      'The Trontek TK LiEV-64140 is a 64V 140Ah (8.960 kWh) lithium iron phosphate traction pack for electric three-wheelers. It ships as a complete kit — battery, 64V 20A charger, Anderson SB75 connector and an external SOC indicator — so a dealer can fit it as a drop-in lead-acid replacement. LFP chemistry gives long cycle life, steady voltage under load and no thermal runaway; the BMS monitors every cell and cuts load on any fault. Trontek is an established Indian manufacturer with 1 GWh capacity and in-house R&D and testing.',
    ],
    highlights: [
      'Lithium Ferro Phosphate cells — safest lithium chemistry for road use',
      'Intelligent BMS: over-charge, over-discharge, over-current, short-circuit and over-temperature protection with cell balancing',
      'External SOC indicator so the driver always sees real charge and temperature',
      'Anderson SB75 quick-connect output',
      'Bundled Trontek charger matched to the pack',
      'Withstands high vibration and shock; no maintenance',
    ],
    boxContents: [
      '64V 20A Trontek charger',
      'Anderson SB75 output connector',
      'external SOC (state-of-charge) indicator',
    ],
    careInstructions: null,
    // Stated in the product-details table and in FAQ 7.
    warrantyMonths: 36,
    warrantyCycles: 1200,
    warrantyText: '3 years or 1200 cycles, whichever is earlier',
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: HSN,
    taxRate: GST,
    facets: { batteryAh: 140, voltage: 64, technology: 'LiFePO4', warrantyMonths: 36 },
    badges: [],
    popularityRank: 15,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-TKLIEV64140')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Model', value: 'TK LiEV-64140' },
          { label: 'Nominal voltage', value: '64 V' },
          { label: 'Nominal capacity', value: '140 Ah' },
          { label: 'Battery pack energy', value: '8.960 kWh (8960 Wh)' },
          { label: 'Cell type', value: 'LFP 3.2 V prismatic' },
          { label: 'Charger', value: '64V 20A Trontek charger' },
          { label: 'Output connector', value: 'Anderson SB75' },
          { label: 'SOC indicator', value: 'External LCD (V / A / °C / SOC %)' },
          {
            label: 'BMS protections',
            value:
              'Over-charge, over-discharge, over-current, short-circuit, over-temperature, cell balancing',
          },
        ],
      },
      {
        title: 'Size',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '700 × 425 × 300 mm' },
          { label: 'In centimetres', value: '70.0 × 42.5 × 30.0 cm' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek LiEV LiFePO4 EV Battery 64V 140Ah (8.96 kWh)' },
          { label: 'Model name', value: 'TK LiEV-64140' },
          { label: 'Category', value: '3-Wheeler / E-Rickshaw Lithium Battery / EV Battery' },
          { label: 'Generic name', value: 'Lithium Iron Phosphate EV traction battery pack' },
          { label: 'Battery cell composition', value: 'Lithium Iron Phosphate (LiFePO4 / LFP)' },
          { label: 'Voltage', value: '64 V (nominal)' },
          { label: 'Capacity', value: '140 Ah (8.960 kWh)' },
          {
            label: 'Recommended uses',
            value:
              'Electric 3-wheelers — e-rickshaws, e-loaders and L5 cargo vehicles on a 64V system; OEM fitment or lead-acid replacement with compatible controller',
          },
          {
            label: 'Supplied with',
            value:
              '64V 20A Trontek charger; Anderson SB75 output connector; external SOC (state-of-charge) indicator',
          },
          { label: 'Connector', value: 'Anderson SB75' },
          { label: 'Charger', value: '64V 20A Trontek charger' },
          {
            label: 'SOC display',
            value:
              'External Trontek LCD indicator — voltage, current, temperature, SOC %, charging/protection status',
          },
          {
            label: 'Enclosure',
            value:
              'Powder-coated steel enclosure, orange top cover, dual carry handles, mounting feet',
          },
          { label: 'Colour', value: 'Black with orange top' },
          { label: 'Country of origin', value: 'India' },
          { label: 'Warranty', value: '3 years or 1200 cycles, whichever is earlier' },
          { label: 'HSN code', value: '8507 60 00' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which vehicles is this battery for?',
        answer:
          'Any 64V-system electric 3-wheeler — passenger e-rickshaw, e-loader or L5 cargo — whose controller accepts a 64V nominal LFP pack. Confirm connector (Anderson SB75) and charger compatibility with iTarang before purchase.',
      },
      {
        question: 'What range will I get?',
        answer:
          'The pack stores 8.960 kWh. E-rickshaws typically consume 45–65 Wh/km, so expect roughly 138–199 km per charge depending on passenger load, speed and terrain.',
      },
      {
        question: 'Is the charger included?',
        answer:
          'Yes — a 64V 20A Trontek charger is bundled. Use only this or another Trontek-approved LFP charger; a lead-acid charger will damage the pack and void the warranty.',
      },
      {
        question: 'What does the SOC indicator show?',
        answer:
          'Live voltage, current, temperature, charge percentage and charging/protection status, mounted on the dashboard so the driver never guesses remaining range.',
      },
      {
        question: 'Is it safe in summer and rain?',
        answer:
          'LFP does not thermally run away; the BMS throttles charging above safe temperature. The steel enclosure is splash-resistant but not submersible — keep the connector dry and do not drive through deep water.',
      },
      {
        question: 'What is the warranty?',
        answer:
          '3 years or 1200 cycles, whichever is earlier. Void if a non-approved charger is used or the pack is opened.',
      },
      {
        question: 'What happens at end of life?',
        answer:
          "Return it through iTarang's battery buyback programme; we pay for the old pack and recycle it under the Battery Waste Management Rules, 2022.",
      },
    ],
    sections: [
      {
        kind: 'compatibility',
        items: [
          'Connector: Anderson SB75',
          'Charger: 64V 20A Trontek charger',
          'Electric 3-wheelers — e-rickshaws, e-loaders and L5 cargo vehicles on a 64V system; OEM fitment or lead-acid replacement with compatible controller',
        ],
      },
      {
        kind: 'care',
        items: [
          'The steel enclosure is splash-resistant but not submersible — keep the connector dry and do not drive through deep water.',
        ],
      },
    ],
    media: mediaFor('LiEV_64V_140Ah_ERickshaw', 'Trontek LiEV 64V 140Ah (TK LiEV-64140)'),
  },

  /* -------------------- 3W · TK LiEV-64153 · 64V 153Ah */
  {
    productKey: 'trontek-liev-64153',
    slug: 'trontek-liev-64v-153ah-e-rickshaw',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek LiEV LiFePO4 EV Battery 64V 153Ah (9.792 kWh)',
    subtitle: 'Lithium Iron Phosphate EV traction battery pack',
    modelName: 'TK LiEV-64153',
    genericName: 'Lithium Iron Phosphate EV traction battery pack',
    productType: null,
    netQuantity: '1 Count',
    category: 'batteries',
    subcategory: 'ev-3-wheeler',
    art: 'battery',
    countryOfOrigin: 'India',
    description: [
      'The Trontek TK LiEV-64153 is a 64V 153Ah (9.792 kWh) lithium iron phosphate traction pack for electric three-wheelers. It ships as a complete kit — battery, 64V 20A charger, Anderson SB75 connector and an external SOC indicator — so a dealer can fit it as a drop-in lead-acid replacement. LFP chemistry gives long cycle life, steady voltage under load and no thermal runaway; the BMS monitors every cell and cuts load on any fault. Trontek is an established Indian manufacturer with 1 GWh capacity and in-house R&D and testing.',
    ],
    highlights: [
      'Lithium Ferro Phosphate cells — safest lithium chemistry for road use',
      'Intelligent BMS: over-charge, over-discharge, over-current, short-circuit and over-temperature protection with cell balancing',
      'External SOC indicator so the driver always sees real charge and temperature',
      'Anderson SB75 quick-connect output',
      'Bundled Trontek charger matched to the pack',
      'Withstands high vibration and shock; no maintenance',
    ],
    boxContents: [
      '64V 20A Trontek charger',
      'Anderson SB75 output connector',
      'external SOC (state-of-charge) indicator',
    ],
    careInstructions: null,
    // Stated in the product-details table and in FAQ 7.
    warrantyMonths: 36,
    warrantyCycles: 1200,
    warrantyText: '3 years or 1200 cycles, whichever is earlier',
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: HSN,
    taxRate: GST,
    facets: { batteryAh: 153, voltage: 64, technology: 'LiFePO4', warrantyMonths: 36 },
    badges: [],
    popularityRank: 16,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-TKLIEV64153')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Model', value: 'TK LiEV-64153' },
          { label: 'Nominal voltage', value: '64 V' },
          { label: 'Nominal capacity', value: '153 Ah' },
          { label: 'Battery pack energy', value: '9.792 kWh (9792 Wh)' },
          { label: 'Cell type', value: 'LFP 3.2 V prismatic' },
          { label: 'Charger', value: '64V 20A Trontek charger' },
          { label: 'Output connector', value: 'Anderson SB75' },
          { label: 'SOC indicator', value: 'External LCD (V / A / °C / SOC %)' },
          {
            label: 'BMS protections',
            value:
              'Over-charge, over-discharge, over-current, short-circuit, over-temperature, cell balancing',
          },
        ],
      },
      {
        title: 'Size',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '700 × 425 × 300 mm' },
          { label: 'In centimetres', value: '70.0 × 42.5 × 30.0 cm' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek LiEV LiFePO4 EV Battery 64V 153Ah (9.792 kWh)' },
          { label: 'Model name', value: 'TK LiEV-64153' },
          { label: 'Category', value: '3-Wheeler / E-Rickshaw Lithium Battery / EV Battery' },
          { label: 'Generic name', value: 'Lithium Iron Phosphate EV traction battery pack' },
          { label: 'Battery cell composition', value: 'Lithium Iron Phosphate (LiFePO4 / LFP)' },
          { label: 'Voltage', value: '64 V (nominal)' },
          { label: 'Capacity', value: '153 Ah (9.792 kWh)' },
          {
            label: 'Recommended uses',
            value:
              'Electric 3-wheelers — e-rickshaws, e-loaders and L5 cargo vehicles on a 64V system; OEM fitment or lead-acid replacement with compatible controller',
          },
          {
            label: 'Supplied with',
            value:
              '64V 20A Trontek charger; Anderson SB75 output connector; external SOC (state-of-charge) indicator',
          },
          { label: 'Connector', value: 'Anderson SB75' },
          { label: 'Charger', value: '64V 20A Trontek charger' },
          {
            label: 'SOC display',
            value:
              'External Trontek LCD indicator — voltage, current, temperature, SOC %, charging/protection status',
          },
          {
            label: 'Enclosure',
            value:
              'Powder-coated steel enclosure, orange top cover, dual carry handles, mounting feet',
          },
          { label: 'Colour', value: 'Black with orange top' },
          { label: 'Country of origin', value: 'India' },
          { label: 'Warranty', value: '3 years or 1200 cycles, whichever is earlier' },
          { label: 'HSN code', value: '8507 60 00' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which vehicles is this battery for?',
        answer:
          'Any 64V-system electric 3-wheeler — passenger e-rickshaw, e-loader or L5 cargo — whose controller accepts a 64V nominal LFP pack. Confirm connector (Anderson SB75) and charger compatibility with iTarang before purchase.',
      },
      {
        question: 'What range will I get?',
        answer:
          'The pack stores 9.792 kWh. E-rickshaws typically consume 45–65 Wh/km, so expect roughly 151–218 km per charge depending on passenger load, speed and terrain.',
      },
      {
        question: 'Is the charger included?',
        answer:
          'Yes — a 64V 20A Trontek charger is bundled. Use only this or another Trontek-approved LFP charger; a lead-acid charger will damage the pack and void the warranty.',
      },
      {
        question: 'What does the SOC indicator show?',
        answer:
          'Live voltage, current, temperature, charge percentage and charging/protection status, mounted on the dashboard so the driver never guesses remaining range.',
      },
      {
        question: 'Is it safe in summer and rain?',
        answer:
          'LFP does not thermally run away; the BMS throttles charging above safe temperature. The steel enclosure is splash-resistant but not submersible — keep the connector dry and do not drive through deep water.',
      },
      {
        question: 'What is the warranty?',
        answer:
          '3 years or 1200 cycles, whichever is earlier. Void if a non-approved charger is used or the pack is opened.',
      },
      {
        question: 'What happens at end of life?',
        answer:
          "Return it through iTarang's battery buyback programme; we pay for the old pack and recycle it under the Battery Waste Management Rules, 2022.",
      },
    ],
    sections: [
      {
        kind: 'compatibility',
        items: [
          'Connector: Anderson SB75',
          'Charger: 64V 20A Trontek charger',
          'Electric 3-wheelers — e-rickshaws, e-loaders and L5 cargo vehicles on a 64V system; OEM fitment or lead-acid replacement with compatible controller',
        ],
      },
      {
        kind: 'care',
        items: [
          'The steel enclosure is splash-resistant but not submersible — keep the connector dry and do not drive through deep water.',
        ],
      },
    ],
    media: mediaFor('LiEV_64V_153Ah_ERickshaw', 'Trontek LiEV 64V 153Ah (TK LiEV-64153)'),
  },

  /* ============================================================ ESS — TK-51.2 series */

  /* -------------------- ESS · TK-51100 · 51.2V 100Ah (5.1 kWh) */
  {
    productKey: 'trontek-ess-tk-51100',
    slug: 'trontek-ess-tk-51100-5-1kwh',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK-51.2 Series Energy Storage System 51.2V 100Ah (5.1 kWh)',
    subtitle: 'Lithium Iron Phosphate energy storage battery',
    modelName: 'TK-51100',
    genericName: 'Lithium Iron Phosphate energy storage battery',
    productType: null,
    netQuantity: '1 Count',
    category: 'batteries',
    subcategory: 'ess',
    art: 'battery',
    countryOfOrigin: 'India',
    description: [
      'The Trontek TK-51100 is a 5.1 kWh, 51.2V 100Ah lithium iron phosphate energy storage unit from the TK-51.2 series. Connect it to an existing photovoltaic system or a new hybrid inverter to act as a power source, store excess generation, support off-grid operation, minimise EB cost and meet peak demand. The intelligent BMS protects and monitors the pack; RS485/CAN communication lets the inverter read state of charge directly. Trontek is an established Indian manufacturer with 1 GWh capacity and in-house R&D and testing.',
    ],
    highlights: [
      'RS485 / CAN 2.0 communication with top inverter brands',
      '6000-cycle LFP cells at 80% DOD, 25°C',
      'Intelligent BMS with over-current, over-voltage, short-circuit, under-voltage and over-temperature protection',
      'Efficient cell balancing for long service life',
      'Plug & play installation; RTC operation insights; remote control capability',
      'Wall mounted',
    ],
    boxContents: [],
    careInstructions: null,
    // Stated in the product-details table and in FAQ 6.
    warrantyMonths: 60,
    warrantyCycles: 4000,
    warrantyText: '5 years or 4000 cycles, whichever is earlier (design life 10 years)',
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: HSN,
    taxRate: GST,
    facets: { batteryAh: 100, voltage: 51.2, technology: 'LiFePO4', warrantyMonths: 60 },
    badges: [],
    popularityRank: 17,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-TK51100')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Model', value: 'TK-51100' },
          { label: 'Capacity', value: '5.1 kWh' },
          { label: 'Nominal voltage', value: '51.2 V' },
          { label: 'Voltage range', value: '48.8 – 58.4 V' },
          { label: 'Rated capacity', value: '100 Ah' },
          { label: 'Cell type', value: 'LFP' },
          { label: 'Cycle life (80% DOD, 25°C)', value: '6000 cycles' },
          { label: 'Standard charge current', value: '40 A' },
          { label: 'Standard discharge current', value: '100 A' },
          { label: 'Max. charge current', value: '50 A' },
          { label: 'Max. discharge current', value: '100 A' },
          { label: 'Module configuration', value: '16S1P' },
          {
            label: 'Battery protection',
            value: 'Over-current / over-voltage / short-circuit / under-voltage / over-temperature',
          },
          { label: 'Charge temperature', value: '0°C to 55°C' },
          { label: 'Discharge temperature', value: '−20°C to 60°C' },
          { label: 'Operating temperature', value: '−20°C to 60°C' },
          { label: 'Storage temperature', value: '−15°C to 60°C' },
          { label: 'Humidity', value: '5% – 95% RH non-condensing' },
          { label: 'Communication interface', value: 'RS485 / CAN' },
          { label: 'IP protection', value: 'IP20' },
          { label: 'Installation', value: 'Wall mounted' },
          { label: 'Warranty / life span', value: '5 years / 10 years' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '520 × 175 × 520 mm' },
          { label: 'In centimetres', value: '52.0 × 17.5 × 52.0 cm' },
          { label: 'Net weight', value: '~49 kg' },
          { label: 'Shipping weight', value: '~53 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          {
            label: 'Product name',
            value: 'Trontek TK-51.2 Series Energy Storage System 51.2V 100Ah (5.1 kWh)',
          },
          { label: 'Model name', value: 'TK-51100' },
          { label: 'Category', value: 'Inverter / Home & Commercial Energy Storage Battery' },
          { label: 'Generic name', value: 'Lithium Iron Phosphate energy storage battery' },
          { label: 'Battery cell composition', value: 'Lithium Iron Phosphate (LiFePO4 / LFP)' },
          { label: 'Voltage', value: '51.2 V (nominal)' },
          { label: 'Capacity', value: '100 Ah (5.1 kWh)' },
          {
            label: 'Recommended uses',
            value:
              'Residential, commercial and light-industrial energy storage with hybrid / solar inverters: backup power, storing excess PV, off-grid, peak shaving, reducing EB cost',
          },
          {
            label: 'Inverter compatibility',
            value: '48V-class hybrid and lithium-ready inverters; RS485 / CAN 2.0 communication',
          },
          { label: 'Installation', value: 'Wall mounted' },
          { label: 'Cell configuration', value: '16S1P' },
          { label: 'Communication', value: 'RS485 / CAN' },
          { label: 'Protection class', value: 'IP20 (indoor)' },
          { label: 'Colour', value: 'White' },
          {
            label: 'Certification',
            value: 'TK-I-51200Pro: ANSI/CAN/UL 1973:2022 Ed.3 ETL Listed (Control No. 5030196)',
          },
          { label: 'Country of origin', value: 'India' },
          {
            label: 'Warranty',
            value: '5 years or 4000 cycles, whichever is earlier (design life 10 years)',
          },
          { label: 'HSN code', value: '8507 60 00' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Will this work with my existing inverter?',
        answer:
          'Yes, with any 48V-class hybrid or lithium-ready inverter supporting a 48.8–58.4V battery window; RS485/CAN lets compatible inverters read SOC directly. Lead-acid-only inverters need a lithium profile or replacement.',
      },
      {
        question: 'How long will it run my home?',
        answer:
          '5.1 kWh stored. Divide by your load — a 1 kW household load (fans, lights, fridge, Wi-Fi) runs roughly 5 hours on this unit.',
      },
      {
        question: 'Can I add more units later?',
        answer:
          'Yes — units of the same model can be paralleled through the BMS communication bus. Do not mix models or chemistries.',
      },
      {
        question: 'Is it safe indoors?',
        answer:
          'Yes. LFP is thermally stable and the BMS protects against every abuse condition. Install in a ventilated indoor space; the unit is IP20, not weatherproof.',
      },
      {
        question: 'Does it need maintenance?',
        answer:
          'No water topping, no acid, no terminal cleaning. Keep the vents clear and check the SOC display occasionally.',
      },
      {
        question: 'What is the warranty and life span?',
        answer:
          '5 years or 4000 cycles, whichever is earlier; 6000-cycle rated cells and 10-year design life.',
      },
      {
        question: 'What happens at end of life?',
        answer:
          "Fully recyclable. Return via iTarang's take-back programme under the Battery Waste Management Rules, 2022.",
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Standard charge current', value: '40 A' },
          { label: 'Max. charge current', value: '50 A' },
          { label: 'Voltage range', value: '48.8 – 58.4 V' },
          { label: 'Charge temperature', value: '0°C to 55°C' },
        ],
      },
      {
        kind: 'discharge',
        summary: '',
        points: [
          { label: 'Standard discharge current', value: '100 A' },
          { label: 'Max. discharge current', value: '100 A' },
          { label: 'Discharge temperature', value: '−20°C to 60°C' },
          { label: 'Cycle life (80% DOD, 25°C)', value: '6000 cycles' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '48V-class hybrid and lithium-ready inverters; RS485 / CAN 2.0 communication',
          'Installation: Wall mounted',
          'Protection class: IP20 (indoor)',
        ],
      },
      {
        kind: 'care',
        items: [
          'No water topping, no acid, no terminal cleaning. Keep the vents clear and check the SOC display occasionally.',
          'Install in a ventilated indoor space; the unit is IP20, not weatherproof.',
        ],
      },
    ],
    media: mediaFor('ESS_TK-51100_5.1kWh', 'Trontek TK-51100 ESS (5.1 kWh)'),
  },

  /* -------------------- ESS · TK-51200 · 51.2V 200Ah (10.24 kWh) */
  {
    productKey: 'trontek-ess-tk-51200',
    slug: 'trontek-ess-tk-51200-10-24kwh',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK-51.2 Series Energy Storage System 51.2V 200Ah (10.24 kWh)',
    subtitle: 'Lithium Iron Phosphate energy storage battery',
    modelName: 'TK-51200',
    genericName: 'Lithium Iron Phosphate energy storage battery',
    productType: null,
    netQuantity: '1 Count',
    category: 'batteries',
    subcategory: 'ess',
    art: 'battery',
    countryOfOrigin: 'India',
    description: [
      'The Trontek TK-51200 is a 10.24 kWh, 51.2V 200Ah lithium iron phosphate energy storage unit from the TK-51.2 series. Connect it to an existing photovoltaic system or a new hybrid inverter to act as a power source, store excess generation, support off-grid operation, minimise EB cost and meet peak demand. The intelligent BMS protects and monitors the pack; RS485/CAN communication lets the inverter read state of charge directly. Trontek is an established Indian manufacturer with 1 GWh capacity and in-house R&D and testing.',
    ],
    highlights: [
      'RS485 / CAN 2.0 communication with top inverter brands',
      '6000-cycle LFP cells at 80% DOD, 25°C',
      'Intelligent BMS with over-current, over-voltage, short-circuit, under-voltage and over-temperature protection',
      'Efficient cell balancing for long service life',
      'Plug & play installation; RTC operation insights; remote control capability',
      'Floor mounted (castor wheels)',
    ],
    boxContents: [],
    careInstructions: null,
    // Stated in the product-details table and in FAQ 6.
    warrantyMonths: 60,
    warrantyCycles: 4000,
    warrantyText: '5 years or 4000 cycles, whichever is earlier (design life 10 years)',
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: HSN,
    taxRate: GST,
    facets: { batteryAh: 200, voltage: 51.2, technology: 'LiFePO4', warrantyMonths: 60 },
    badges: [],
    popularityRank: 18,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-TK51200')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Model', value: 'TK-51200' },
          { label: 'Capacity', value: '10.24 kWh' },
          { label: 'Nominal voltage', value: '51.2 V' },
          { label: 'Voltage range', value: '48.8 – 58.4 V' },
          { label: 'Rated capacity', value: '200 Ah' },
          { label: 'Cell type', value: 'LFP' },
          { label: 'Cycle life (80% DOD, 25°C)', value: '6000 cycles' },
          { label: 'Standard charge current', value: '50 A' },
          { label: 'Standard discharge current', value: '100 A' },
          { label: 'Max. charge current', value: '150 A' },
          { label: 'Max. discharge current', value: '200 A' },
          { label: 'Module configuration', value: '16S1P' },
          {
            label: 'Battery protection',
            value: 'Over-current / over-voltage / short-circuit / under-voltage / over-temperature',
          },
          { label: 'Charge temperature', value: '0°C to 55°C' },
          { label: 'Discharge temperature', value: '−20°C to 60°C' },
          { label: 'Operating temperature', value: '−20°C to 60°C' },
          { label: 'Storage temperature', value: '−15°C to 60°C' },
          { label: 'Humidity', value: '5% – 95% RH non-condensing' },
          { label: 'Communication interface', value: 'RS485 / CAN' },
          { label: 'IP protection', value: 'IP20' },
          { label: 'Installation', value: 'Floor mounted (castor wheels)' },
          { label: 'Warranty / life span', value: '5 years / 10 years' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '540 × 272 × 700 mm' },
          { label: 'In centimetres', value: '54.0 × 27.2 × 70.0 cm' },
          { label: 'Net weight', value: '~110 kg' },
          { label: 'Shipping weight', value: '~114 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          {
            label: 'Product name',
            value: 'Trontek TK-51.2 Series Energy Storage System 51.2V 200Ah (10.24 kWh)',
          },
          { label: 'Model name', value: 'TK-51200' },
          { label: 'Category', value: 'Inverter / Home & Commercial Energy Storage Battery' },
          { label: 'Generic name', value: 'Lithium Iron Phosphate energy storage battery' },
          { label: 'Battery cell composition', value: 'Lithium Iron Phosphate (LiFePO4 / LFP)' },
          { label: 'Voltage', value: '51.2 V (nominal)' },
          { label: 'Capacity', value: '200 Ah (10.24 kWh)' },
          {
            label: 'Recommended uses',
            value:
              'Residential, commercial and light-industrial energy storage with hybrid / solar inverters: backup power, storing excess PV, off-grid, peak shaving, reducing EB cost',
          },
          {
            label: 'Inverter compatibility',
            value: '48V-class hybrid and lithium-ready inverters; RS485 / CAN 2.0 communication',
          },
          { label: 'Installation', value: 'Floor mounted (castor wheels)' },
          { label: 'Cell configuration', value: '16S1P' },
          { label: 'Communication', value: 'RS485 / CAN' },
          { label: 'Protection class', value: 'IP20 (indoor)' },
          { label: 'Colour', value: 'White' },
          {
            label: 'Certification',
            value: 'TK-I-51200Pro: ANSI/CAN/UL 1973:2022 Ed.3 ETL Listed (Control No. 5030196)',
          },
          { label: 'Country of origin', value: 'India' },
          {
            label: 'Warranty',
            value: '5 years or 4000 cycles, whichever is earlier (design life 10 years)',
          },
          { label: 'HSN code', value: '8507 60 00' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Will this work with my existing inverter?',
        answer:
          'Yes, with any 48V-class hybrid or lithium-ready inverter supporting a 48.8–58.4V battery window; RS485/CAN lets compatible inverters read SOC directly. Lead-acid-only inverters need a lithium profile or replacement.',
      },
      {
        question: 'How long will it run my home?',
        answer:
          '10.24 kWh stored. Divide by your load — a 1 kW household load (fans, lights, fridge, Wi-Fi) runs roughly 9 hours on this unit.',
      },
      {
        question: 'Can I add more units later?',
        answer:
          'Yes — units of the same model can be paralleled through the BMS communication bus. Do not mix models or chemistries.',
      },
      {
        question: 'Is it safe indoors?',
        answer:
          'Yes. LFP is thermally stable and the BMS protects against every abuse condition. Install in a ventilated indoor space; the unit is IP20, not weatherproof.',
      },
      {
        question: 'Does it need maintenance?',
        answer:
          'No water topping, no acid, no terminal cleaning. Keep the vents clear and check the SOC display occasionally.',
      },
      {
        question: 'What is the warranty and life span?',
        answer:
          '5 years or 4000 cycles, whichever is earlier; 6000-cycle rated cells and 10-year design life.',
      },
      {
        question: 'What happens at end of life?',
        answer:
          "Fully recyclable. Return via iTarang's take-back programme under the Battery Waste Management Rules, 2022.",
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Standard charge current', value: '50 A' },
          { label: 'Max. charge current', value: '150 A' },
          { label: 'Voltage range', value: '48.8 – 58.4 V' },
          { label: 'Charge temperature', value: '0°C to 55°C' },
        ],
      },
      {
        kind: 'discharge',
        summary: '',
        points: [
          { label: 'Standard discharge current', value: '100 A' },
          { label: 'Max. discharge current', value: '200 A' },
          { label: 'Discharge temperature', value: '−20°C to 60°C' },
          { label: 'Cycle life (80% DOD, 25°C)', value: '6000 cycles' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '48V-class hybrid and lithium-ready inverters; RS485 / CAN 2.0 communication',
          'Installation: Floor mounted (castor wheels)',
          'Protection class: IP20 (indoor)',
        ],
      },
      {
        kind: 'care',
        items: [
          'No water topping, no acid, no terminal cleaning. Keep the vents clear and check the SOC display occasionally.',
          'Install in a ventilated indoor space; the unit is IP20, not weatherproof.',
        ],
      },
    ],
    media: mediaFor('ESS_TK-51200_10.24kWh', 'Trontek TK-51200 ESS (10.24 kWh)'),
  },

  /* -------------------- ESS · TK-51314 · 51.2V 314Ah (16.08 kWh) */
  {
    productKey: 'trontek-ess-tk-51314',
    slug: 'trontek-ess-tk-51314-16-08kwh',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK-51.2 Series Energy Storage System 51.2V 314Ah (16.08 kWh)',
    subtitle: 'Lithium Iron Phosphate energy storage battery',
    modelName: 'TK-51314',
    genericName: 'Lithium Iron Phosphate energy storage battery',
    productType: null,
    netQuantity: '1 Count',
    category: 'batteries',
    subcategory: 'ess',
    art: 'battery',
    countryOfOrigin: 'India',
    description: [
      'The Trontek TK-51314 is a 16.08 kWh, 51.2V 314Ah lithium iron phosphate energy storage unit from the TK-51.2 series. Connect it to an existing photovoltaic system or a new hybrid inverter to act as a power source, store excess generation, support off-grid operation, minimise EB cost and meet peak demand. The intelligent BMS protects and monitors the pack; RS485/CAN communication lets the inverter read state of charge directly. Trontek is an established Indian manufacturer with 1 GWh capacity and in-house R&D and testing.',
    ],
    highlights: [
      'RS485 / CAN 2.0 communication with top inverter brands',
      '6000-cycle LFP cells at 80% DOD, 25°C',
      'Intelligent BMS with over-current, over-voltage, short-circuit, under-voltage and over-temperature protection',
      'Efficient cell balancing for long service life',
      'Plug & play installation; RTC operation insights; remote control capability',
      'Floor mounted (castor wheels)',
    ],
    boxContents: [],
    careInstructions: null,
    // Stated in the product-details table and in FAQ 6.
    warrantyMonths: 60,
    warrantyCycles: 4000,
    warrantyText: '5 years or 4000 cycles, whichever is earlier (design life 10 years)',
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: HSN,
    taxRate: GST,
    facets: { batteryAh: 314, voltage: 51.2, technology: 'LiFePO4', warrantyMonths: 60 },
    badges: [],
    popularityRank: 19,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-TK51314')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Model', value: 'TK-51314' },
          { label: 'Capacity', value: '16.08 kWh' },
          { label: 'Nominal voltage', value: '51.2 V' },
          { label: 'Voltage range', value: '48.8 – 58.4 V' },
          { label: 'Rated capacity', value: '314 Ah' },
          { label: 'Cell type', value: 'LFP' },
          { label: 'Cycle life (80% DOD, 25°C)', value: '6000 cycles' },
          { label: 'Standard charge current', value: '100 A' },
          { label: 'Standard discharge current', value: '100 A' },
          { label: 'Max. charge current', value: '150 A' },
          { label: 'Max. discharge current', value: '200 A' },
          { label: 'Module configuration', value: '16S1P' },
          {
            label: 'Battery protection',
            value: 'Over-current / over-voltage / short-circuit / under-voltage / over-temperature',
          },
          { label: 'Charge temperature', value: '0°C to 55°C' },
          { label: 'Discharge temperature', value: '−20°C to 60°C' },
          { label: 'Operating temperature', value: '−20°C to 60°C' },
          { label: 'Storage temperature', value: '−15°C to 60°C' },
          { label: 'Humidity', value: '5% – 95% RH non-condensing' },
          { label: 'Communication interface', value: 'RS485 / CAN' },
          { label: 'IP protection', value: 'IP20' },
          { label: 'Installation', value: 'Floor mounted (castor wheels)' },
          { label: 'Warranty / life span', value: '5 years / 10 years' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '700 × 272 × 700 mm' },
          { label: 'In centimetres', value: '70.0 × 27.2 × 70.0 cm' },
          { label: 'Net weight', value: '~120 kg' },
          { label: 'Shipping weight', value: '~124 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          {
            label: 'Product name',
            value: 'Trontek TK-51.2 Series Energy Storage System 51.2V 314Ah (16.08 kWh)',
          },
          { label: 'Model name', value: 'TK-51314' },
          { label: 'Category', value: 'Inverter / Home & Commercial Energy Storage Battery' },
          { label: 'Generic name', value: 'Lithium Iron Phosphate energy storage battery' },
          { label: 'Battery cell composition', value: 'Lithium Iron Phosphate (LiFePO4 / LFP)' },
          { label: 'Voltage', value: '51.2 V (nominal)' },
          { label: 'Capacity', value: '314 Ah (16.08 kWh)' },
          {
            label: 'Recommended uses',
            value:
              'Residential, commercial and light-industrial energy storage with hybrid / solar inverters: backup power, storing excess PV, off-grid, peak shaving, reducing EB cost',
          },
          {
            label: 'Inverter compatibility',
            value: '48V-class hybrid and lithium-ready inverters; RS485 / CAN 2.0 communication',
          },
          { label: 'Installation', value: 'Floor mounted (castor wheels)' },
          { label: 'Cell configuration', value: '16S1P' },
          { label: 'Communication', value: 'RS485 / CAN' },
          { label: 'Protection class', value: 'IP20 (indoor)' },
          { label: 'Colour', value: 'White' },
          {
            label: 'Certification',
            value: 'TK-I-51200Pro: ANSI/CAN/UL 1973:2022 Ed.3 ETL Listed (Control No. 5030196)',
          },
          { label: 'Country of origin', value: 'India' },
          {
            label: 'Warranty',
            value: '5 years or 4000 cycles, whichever is earlier (design life 10 years)',
          },
          { label: 'HSN code', value: '8507 60 00' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Will this work with my existing inverter?',
        answer:
          'Yes, with any 48V-class hybrid or lithium-ready inverter supporting a 48.8–58.4V battery window; RS485/CAN lets compatible inverters read SOC directly. Lead-acid-only inverters need a lithium profile or replacement.',
      },
      {
        question: 'How long will it run my home?',
        answer:
          '16.08 kWh stored. Divide by your load — a 1 kW household load (fans, lights, fridge, Wi-Fi) runs roughly 14 hours on this unit.',
      },
      {
        question: 'Can I add more units later?',
        answer:
          'Yes — units of the same model can be paralleled through the BMS communication bus. Do not mix models or chemistries.',
      },
      {
        question: 'Is it safe indoors?',
        answer:
          'Yes. LFP is thermally stable and the BMS protects against every abuse condition. Install in a ventilated indoor space; the unit is IP20, not weatherproof.',
      },
      {
        question: 'Does it need maintenance?',
        answer:
          'No water topping, no acid, no terminal cleaning. Keep the vents clear and check the SOC display occasionally.',
      },
      {
        question: 'What is the warranty and life span?',
        answer:
          '5 years or 4000 cycles, whichever is earlier; 6000-cycle rated cells and 10-year design life.',
      },
      {
        question: 'What happens at end of life?',
        answer:
          "Fully recyclable. Return via iTarang's take-back programme under the Battery Waste Management Rules, 2022.",
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Standard charge current', value: '100 A' },
          { label: 'Max. charge current', value: '150 A' },
          { label: 'Voltage range', value: '48.8 – 58.4 V' },
          { label: 'Charge temperature', value: '0°C to 55°C' },
        ],
      },
      {
        kind: 'discharge',
        summary: '',
        points: [
          { label: 'Standard discharge current', value: '100 A' },
          { label: 'Max. discharge current', value: '200 A' },
          { label: 'Discharge temperature', value: '−20°C to 60°C' },
          { label: 'Cycle life (80% DOD, 25°C)', value: '6000 cycles' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '48V-class hybrid and lithium-ready inverters; RS485 / CAN 2.0 communication',
          'Installation: Floor mounted (castor wheels)',
          'Protection class: IP20 (indoor)',
        ],
      },
      {
        kind: 'care',
        items: [
          'No water topping, no acid, no terminal cleaning. Keep the vents clear and check the SOC display occasionally.',
          'Install in a ventilated indoor space; the unit is IP20, not weatherproof.',
        ],
      },
    ],
    media: mediaFor('ESS_TK-51314_16.08kWh', 'Trontek TK-51314 ESS (16.08 kWh)'),
  },

  /* -------------------- ESS · TK-51560 · 51.2V 560Ah (28.67 kWh) */
  {
    productKey: 'trontek-ess-tk-51560',
    slug: 'trontek-ess-tk-51560-28-67kwh',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK-51.2 Series Energy Storage System 51.2V 560Ah (28.67 kWh)',
    subtitle: 'Lithium Iron Phosphate energy storage battery',
    modelName: 'TK-51560',
    genericName: 'Lithium Iron Phosphate energy storage battery',
    productType: null,
    netQuantity: '1 Count',
    category: 'batteries',
    subcategory: 'ess',
    art: 'battery',
    countryOfOrigin: 'India',
    description: [
      'The Trontek TK-51560 is a 28.67 kWh, 51.2V 560Ah lithium iron phosphate energy storage unit from the TK-51.2 series. Connect it to an existing photovoltaic system or a new hybrid inverter to act as a power source, store excess generation, support off-grid operation, minimise EB cost and meet peak demand. The intelligent BMS protects and monitors the pack; RS485/CAN communication lets the inverter read state of charge directly. Trontek is an established Indian manufacturer with 1 GWh capacity and in-house R&D and testing.',
    ],
    highlights: [
      'RS485 / CAN 2.0 communication with top inverter brands',
      '6000-cycle LFP cells at 80% DOD, 25°C',
      'Intelligent BMS with over-current, over-voltage, short-circuit, under-voltage and over-temperature protection',
      'Efficient cell balancing for long service life',
      'Plug & play installation; RTC operation insights; remote control capability',
      'Floor mounted (castor wheels)',
    ],
    boxContents: [],
    careInstructions: null,
    // Stated in the product-details table and in FAQ 6.
    warrantyMonths: 60,
    warrantyCycles: 4000,
    warrantyText: '5 years or 4000 cycles, whichever is earlier (design life 10 years)',
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: HSN,
    taxRate: GST,
    facets: { batteryAh: 560, voltage: 51.2, technology: 'LiFePO4', warrantyMonths: 60 },
    badges: [],
    popularityRank: 20,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-TK51560')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Model', value: 'TK-51560' },
          { label: 'Capacity', value: '28.67 kWh' },
          { label: 'Nominal voltage', value: '51.2 V' },
          { label: 'Voltage range', value: '48.8 – 58.4 V' },
          { label: 'Rated capacity', value: '560 Ah' },
          { label: 'Cell type', value: 'LFP' },
          { label: 'Cycle life (80% DOD, 25°C)', value: '6000 cycles' },
          { label: 'Standard charge current', value: '150 A' },
          { label: 'Standard discharge current', value: '150 A' },
          { label: 'Max. charge current', value: '300 A' },
          { label: 'Max. discharge current', value: '300 A' },
          { label: 'Module configuration', value: '16S2P' },
          {
            label: 'Battery protection',
            value: 'Over-current / over-voltage / short-circuit / under-voltage / over-temperature',
          },
          { label: 'Charge temperature', value: '0°C to 55°C' },
          { label: 'Discharge temperature', value: '−20°C to 60°C' },
          { label: 'Operating temperature', value: '−20°C to 60°C' },
          { label: 'Storage temperature', value: '−15°C to 60°C' },
          { label: 'Humidity', value: '5% – 95% RH non-condensing' },
          { label: 'Communication interface', value: 'RS485 / CAN' },
          { label: 'IP protection', value: 'IP20' },
          { label: 'Installation', value: 'Floor mounted (castor wheels)' },
          { label: 'Warranty / life span', value: '5 years / 10 years' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '534 × 432 × 1030 mm' },
          { label: 'In centimetres', value: '53.4 × 43.2 × 103.0 cm' },
          { label: 'Net weight', value: '~150 kg' },
          { label: 'Shipping weight', value: '~154 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          {
            label: 'Product name',
            value: 'Trontek TK-51.2 Series Energy Storage System 51.2V 560Ah (28.67 kWh)',
          },
          { label: 'Model name', value: 'TK-51560' },
          { label: 'Category', value: 'Inverter / Home & Commercial Energy Storage Battery' },
          { label: 'Generic name', value: 'Lithium Iron Phosphate energy storage battery' },
          { label: 'Battery cell composition', value: 'Lithium Iron Phosphate (LiFePO4 / LFP)' },
          { label: 'Voltage', value: '51.2 V (nominal)' },
          { label: 'Capacity', value: '560 Ah (28.67 kWh)' },
          {
            label: 'Recommended uses',
            value:
              'Residential, commercial and light-industrial energy storage with hybrid / solar inverters: backup power, storing excess PV, off-grid, peak shaving, reducing EB cost',
          },
          {
            label: 'Inverter compatibility',
            value: '48V-class hybrid and lithium-ready inverters; RS485 / CAN 2.0 communication',
          },
          { label: 'Installation', value: 'Floor mounted (castor wheels)' },
          { label: 'Cell configuration', value: '16S2P' },
          { label: 'Communication', value: 'RS485 / CAN' },
          { label: 'Protection class', value: 'IP20 (indoor)' },
          { label: 'Colour', value: 'White' },
          {
            label: 'Certification',
            value: 'TK-I-51200Pro: ANSI/CAN/UL 1973:2022 Ed.3 ETL Listed (Control No. 5030196)',
          },
          { label: 'Country of origin', value: 'India' },
          {
            label: 'Warranty',
            value: '5 years or 4000 cycles, whichever is earlier (design life 10 years)',
          },
          { label: 'HSN code', value: '8507 60 00' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Will this work with my existing inverter?',
        answer:
          'Yes, with any 48V-class hybrid or lithium-ready inverter supporting a 48.8–58.4V battery window; RS485/CAN lets compatible inverters read SOC directly. Lead-acid-only inverters need a lithium profile or replacement.',
      },
      {
        question: 'How long will it run my home?',
        answer:
          '28.67 kWh stored. Divide by your load — a 1 kW household load (fans, lights, fridge, Wi-Fi) runs roughly 26 hours on this unit.',
      },
      {
        question: 'Can I add more units later?',
        answer:
          'Yes — units of the same model can be paralleled through the BMS communication bus. Do not mix models or chemistries.',
      },
      {
        question: 'Is it safe indoors?',
        answer:
          'Yes. LFP is thermally stable and the BMS protects against every abuse condition. Install in a ventilated indoor space; the unit is IP20, not weatherproof.',
      },
      {
        question: 'Does it need maintenance?',
        answer:
          'No water topping, no acid, no terminal cleaning. Keep the vents clear and check the SOC display occasionally.',
      },
      {
        question: 'What is the warranty and life span?',
        answer:
          '5 years or 4000 cycles, whichever is earlier; 6000-cycle rated cells and 10-year design life.',
      },
      {
        question: 'What happens at end of life?',
        answer:
          "Fully recyclable. Return via iTarang's take-back programme under the Battery Waste Management Rules, 2022.",
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Standard charge current', value: '150 A' },
          { label: 'Max. charge current', value: '300 A' },
          { label: 'Voltage range', value: '48.8 – 58.4 V' },
          { label: 'Charge temperature', value: '0°C to 55°C' },
        ],
      },
      {
        kind: 'discharge',
        summary: '',
        points: [
          { label: 'Standard discharge current', value: '150 A' },
          { label: 'Max. discharge current', value: '300 A' },
          { label: 'Discharge temperature', value: '−20°C to 60°C' },
          { label: 'Cycle life (80% DOD, 25°C)', value: '6000 cycles' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '48V-class hybrid and lithium-ready inverters; RS485 / CAN 2.0 communication',
          'Installation: Floor mounted (castor wheels)',
          'Protection class: IP20 (indoor)',
        ],
      },
      {
        kind: 'care',
        items: [
          'No water topping, no acid, no terminal cleaning. Keep the vents clear and check the SOC display occasionally.',
          'Install in a ventilated indoor space; the unit is IP20, not weatherproof.',
        ],
      },
    ],
    media: mediaFor('ESS_TK-51560_28.67kWh', 'Trontek TK-51560 ESS (28.67 kWh)'),
  },

  /* ============================================================ BESS — EKON C&I cubes */

  /* -------------------- BESS · HESS-261kWh-125kW */
  {
    productKey: 'trontek-bess-hess-261kwh-125kw',
    slug: 'trontek-ekon-bess-hess-261kwh-125kw',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek EKON C&I Battery Energy Storage Cube 261 kWh / 125 kW C&I Energy Storage Cube',
    subtitle: 'Lithium Iron Phosphate battery energy storage system with integrated PCS',
    modelName: 'HESS-261kWh-125kW',
    genericName: 'Lithium Iron Phosphate battery energy storage system with integrated PCS',
    productType: null,
    netQuantity: '1 Count',
    category: 'batteries',
    subcategory: 'ess',
    art: 'battery',
    countryOfOrigin: 'India',
    description: [
      'The Trontek EKON HESS-261kWh-125kW is a 261 kWh / 125 kW commercial & industrial energy storage cube — LFP 314Ah cells, integrated power conversion and liquid cooling in one IP54 cabinet. It delivers peak shaving, solar self-consumption and backup power for factories, commercial buildings, EV charging hubs and telecom sites, with cloud monitoring and AI-assisted operation and maintenance. Supplied, installed and commissioned as a project; customised capacity available on request.',
    ],
    highlights: [
      'All-in-one design — battery, PCS and liquid cooling in one cabinet; ~10% smaller footprint',
      'System efficiency >90%',
      'Selectable grid-connected / off-grid modes with black-start capability',
      'Cloud intelligence data link, automatic master-slave operation, AI-assisted O&M',
      'AC-side coupling, no DC arcing; plug & play installation',
      'Pack-level aerosol fire protection; IP54 outdoor cabinet',
    ],
    boxContents: [],
    careInstructions: null,
    // "[as per supply contract — confirm with Trontek]".
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: true,
    returnWindowDays: null,
    hsnCode: HSN,
    taxRate: GST,
    facets: { batteryAh: 314, voltage: 832, technology: 'LiFePO4' },
    badges: [],
    popularityRank: 21,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-HESS261KWH125KW')],
    specGroups: [
      {
        title: 'AC side',
        specs: [
          { label: 'Model name', value: 'HESS-261kWh-125kW' },
          { label: 'Rated power', value: '125 kW' },
          { label: 'AC voltage / output', value: '400 VAC, 3-phase 4-wire, 50 Hz' },
          { label: 'Power factor', value: '0.99' },
          { label: 'Overload capacity', value: '110% load' },
          { label: 'THD', value: '3%' },
          { label: 'Rated output power', value: '125 kW' },
        ],
      },
      {
        title: 'DC side',
        specs: [
          { label: 'Cell type & rating', value: 'LFP 3.2 V / 314 Ah' },
          { label: 'System configuration', value: '260S1P (5 × 52S1P modules)' },
          { label: 'System nominal voltage', value: '832 V' },
          { label: 'Voltage range', value: '754 – 936 V' },
          { label: 'Rated current', value: '198 A' },
          { label: 'System rated energy', value: '261 kWh' },
        ],
      },
      {
        title: 'System',
        specs: [
          { label: 'System efficiency', value: '>90%' },
          { label: 'Operating temperature', value: '−30°C to 55°C' },
          { label: 'Relative humidity', value: '5% – 95% non-condensing' },
          { label: 'Max. altitude', value: '≤ 2000 m' },
          { label: 'Degree of protection', value: 'IP54' },
          { label: 'Cooling', value: 'Liquid cooling' },
          { label: 'Fire suppression', value: 'Aerosol firefighting' },
          { label: 'Compliance', value: 'IEC 62619, IEC 62477-1, IEC 62933, UN38.3, IEC 60529' },
          { label: 'Communication', value: 'RS485 / Ethernet / CAN' },
          { label: 'Weight', value: '2600 ± 100 kg' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '1100 × 1320 × 2560 mm' },
          { label: 'In centimetres', value: '110.0 × 132.0 × 256.0 cm' },
          { label: 'Net weight', value: '~2600 kg' },
          { label: 'Shipping weight', value: '~2604 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          {
            label: 'Product name',
            value:
              'Trontek EKON C&I Battery Energy Storage Cube 261 kWh / 125 kW C&I Energy Storage Cube',
          },
          { label: 'Model name', value: 'HESS-261kWh-125kW' },
          {
            label: 'Category',
            value: 'Commercial & Industrial Battery Energy Storage System (BESS)',
          },
          {
            label: 'Generic name',
            value: 'Lithium Iron Phosphate battery energy storage system with integrated PCS',
          },
          { label: 'Battery cell composition', value: 'Lithium Iron Phosphate (LiFePO4 / LFP)' },
          { label: 'Voltage', value: '832 V (nominal)' },
          { label: 'Capacity', value: '314 Ah (261 kWh)' },
          {
            label: 'Recommended uses',
            value:
              'Commercial & industrial peak shaving, demand-charge reduction, solar self-consumption, backup power, EV charging hub support, grid-connected and off-grid modes with black start',
          },
          { label: 'Rated power', value: '125 kW' },
          { label: 'AC output', value: '400 VAC, 3-phase 4-wire, 50 Hz' },
          { label: 'Cooling', value: 'Liquid cooling, no-condensation design' },
          { label: 'Fire suppression', value: 'Aerosol firefighting, pack-level' },
          { label: 'Protection class', value: 'IP54 (outdoor rated)' },
          { label: 'Compliance', value: 'IEC 62619, IEC 62477-1, IEC 62933, UN38.3, IEC 60529' },
          {
            label: 'Communication',
            value: 'RS485 / Ethernet / CAN; cloud web real-time monitoring',
          },
          { label: 'Colour', value: 'White' },
          { label: 'Country of origin', value: 'India' },
          {
            label: 'Price',
            value: 'On request — project quotation including installation and commissioning',
          },
          { label: 'HSN code', value: '8507 60 00 (battery) / 8504 40 (PCS)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'What size facility is this for?',
        answer:
          '261 kWh at 125 kW suits a commercial or industrial site with a sanctioned load in the 250–625 kW range wanting 2 hours of peak shaving or backup; larger needs are met by paralleling cubes or the 5 MWh containerised bank.',
      },
      {
        question: 'Does it include the inverter (PCS)?',
        answer:
          'Yes — PCS is integrated in the cabinet with 400 VAC, 3-phase 4-wire, 50 Hz output.',
      },
      {
        question: 'Can it run off-grid?',
        answer: 'Yes — selectable grid-connected and off-grid modes with black-start capability.',
      },
      {
        question: 'What about fire safety?',
        answer:
          'LFP chemistry, pack-level aerosol fire suppression, liquid cooling with no-condensation design, and compliance with IEC 62619 / 62477-1 / 62933 and UN38.3.',
      },
      {
        question: 'Can it be installed outdoors?',
        answer: 'Yes — IP54 cabinet rated for −30°C to 55°C and altitudes up to 2000 m.',
      },
      {
        question: 'How is it monitored?',
        answer:
          'RS485 / Ethernet / CAN interfaces with cloud real-time monitoring, remote diagnostics and AI-assisted operation and maintenance.',
      },
      {
        question: 'What is the warranty?',
        answer:
          'Defined in the supply and commissioning contract; standard Trontek C&I terms apply. Confirm with iTarang.',
      },
    ],
    sections: [
      {
        kind: 'compatibility',
        items: [
          'AC output: 400 VAC, 3-phase 4-wire, 50 Hz',
          'Communication: RS485 / Ethernet / CAN; cloud web real-time monitoring',
          'Protection class: IP54 (outdoor rated)',
        ],
      },
    ],
    media: mediaFor('BESS_HESS-261kWh-125kW', 'Trontek EKON HESS-261kWh-125kW'),
  },

  /* -------------------- BESS · HESS-418kWh-215kW */
  {
    productKey: 'trontek-bess-hess-418kwh-215kw',
    slug: 'trontek-ekon-bess-hess-418kwh-215kw',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek EKON C&I Battery Energy Storage Cube 418 kWh / 215 kW C&I Energy Storage Cube',
    subtitle: 'Lithium Iron Phosphate battery energy storage system with integrated PCS',
    modelName: 'HESS-418kWh-215kW',
    genericName: 'Lithium Iron Phosphate battery energy storage system with integrated PCS',
    productType: null,
    netQuantity: '1 Count',
    category: 'batteries',
    subcategory: 'ess',
    art: 'battery',
    countryOfOrigin: 'India',
    description: [
      'The Trontek EKON HESS-418kWh-215kW is a 418 kWh / 215 kW commercial & industrial energy storage cube — LFP 314Ah cells, integrated power conversion and liquid cooling in one IP54 cabinet. It delivers peak shaving, solar self-consumption and backup power for factories, commercial buildings, EV charging hubs and telecom sites, with cloud monitoring and AI-assisted operation and maintenance. Supplied, installed and commissioned as a project; customised capacity available on request.',
    ],
    highlights: [
      'All-in-one design — battery, PCS and liquid cooling in one cabinet; ~10% smaller footprint',
      'System efficiency >90%',
      'Selectable grid-connected / off-grid modes with black-start capability',
      'Cloud intelligence data link, automatic master-slave operation, AI-assisted O&M',
      'AC-side coupling, no DC arcing; plug & play installation',
      'Pack-level aerosol fire protection; IP54 outdoor cabinet',
    ],
    boxContents: [],
    careInstructions: null,
    // "[as per supply contract — confirm with Trontek]".
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: true,
    returnWindowDays: null,
    hsnCode: HSN,
    taxRate: GST,
    facets: { batteryAh: 314, voltage: 1331.2, technology: 'LiFePO4' },
    badges: [],
    popularityRank: 22,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-HESS418KWH215KW')],
    specGroups: [
      {
        title: 'AC side',
        specs: [
          { label: 'Model name', value: 'HESS-418kWh-215kW' },
          { label: 'Rated power', value: '215 kW' },
          { label: 'AC voltage / output', value: '800 VAC, 3-phase 3-wire, 50 Hz' },
          { label: 'Power factor', value: '(−1, 1)' },
          { label: 'Overload capacity', value: '110% load, 10 min' },
          { label: 'THD', value: '3%' },
          { label: 'Rated output power', value: '215 kW' },
        ],
      },
      {
        title: 'DC side',
        specs: [
          { label: 'Cell type & rating', value: 'LFP 3.2 V / 314 Ah' },
          { label: 'System configuration', value: '416S1P (8 × 52S1P modules, 52.249 kWh each)' },
          { label: 'System nominal voltage', value: '1331.2 V' },
          { label: 'Voltage range', value: '1248 – 1456 V' },
          { label: 'Rated current', value: '157 A' },
          { label: 'System rated energy', value: '418 kWh' },
        ],
      },
      {
        title: 'System',
        specs: [
          { label: 'System efficiency', value: '>90%' },
          { label: 'Operating temperature', value: '−30°C to 55°C' },
          { label: 'Relative humidity', value: '5% – 95% non-condensing' },
          { label: 'Max. altitude', value: '≤ 2000 m' },
          { label: 'Degree of protection', value: 'IP54' },
          { label: 'Cooling', value: 'Liquid cooling' },
          { label: 'Fire suppression', value: 'Aerosol firefighting' },
          { label: 'Compliance', value: 'IEC 62619, IEC 62477-1, IEC 62933, UN38.3, IEC 60529' },
          { label: 'Communication', value: 'RS485 / Ethernet / CAN' },
          { label: 'Weight', value: '3800 ± 100 kg' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '1400 × 1350 × 2350 mm' },
          { label: 'In centimetres', value: '140.0 × 135.0 × 235.0 cm' },
          { label: 'Net weight', value: '~3800 kg' },
          { label: 'Shipping weight', value: '~3804 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          {
            label: 'Product name',
            value:
              'Trontek EKON C&I Battery Energy Storage Cube 418 kWh / 215 kW C&I Energy Storage Cube',
          },
          { label: 'Model name', value: 'HESS-418kWh-215kW' },
          {
            label: 'Category',
            value: 'Commercial & Industrial Battery Energy Storage System (BESS)',
          },
          {
            label: 'Generic name',
            value: 'Lithium Iron Phosphate battery energy storage system with integrated PCS',
          },
          { label: 'Battery cell composition', value: 'Lithium Iron Phosphate (LiFePO4 / LFP)' },
          { label: 'Voltage', value: '1331.2 V (nominal)' },
          { label: 'Capacity', value: '314 Ah (418 kWh)' },
          {
            label: 'Recommended uses',
            value:
              'Commercial & industrial peak shaving, demand-charge reduction, solar self-consumption, backup power, EV charging hub support, grid-connected and off-grid modes with black start',
          },
          { label: 'Rated power', value: '215 kW' },
          { label: 'AC output', value: '800 VAC, 3-phase 3-wire, 50 Hz' },
          { label: 'Cooling', value: 'Liquid cooling, no-condensation design' },
          { label: 'Fire suppression', value: 'Aerosol firefighting, pack-level' },
          { label: 'Protection class', value: 'IP54 (outdoor rated)' },
          { label: 'Compliance', value: 'IEC 62619, IEC 62477-1, IEC 62933, UN38.3, IEC 60529' },
          {
            label: 'Communication',
            value: 'RS485 / Ethernet / CAN; cloud web real-time monitoring',
          },
          { label: 'Colour', value: 'White' },
          { label: 'Country of origin', value: 'India' },
          {
            label: 'Price',
            value: 'On request — project quotation including installation and commissioning',
          },
          { label: 'HSN code', value: '8507 60 00 (battery) / 8504 40 (PCS)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'What size facility is this for?',
        answer:
          '418 kWh at 215 kW suits a commercial or industrial site with a sanctioned load in the 430–1075 kW range wanting 2 hours of peak shaving or backup; larger needs are met by paralleling cubes or the 5 MWh containerised bank.',
      },
      {
        question: 'Does it include the inverter (PCS)?',
        answer: 'The 418 kWh cube is quoted without PCS; PCS is added per project.',
      },
      {
        question: 'Can it run off-grid?',
        answer: 'Yes — selectable grid-connected and off-grid modes with black-start capability.',
      },
      {
        question: 'What about fire safety?',
        answer:
          'LFP chemistry, pack-level aerosol fire suppression, liquid cooling with no-condensation design, and compliance with IEC 62619 / 62477-1 / 62933 and UN38.3.',
      },
      {
        question: 'Can it be installed outdoors?',
        answer: 'Yes — IP54 cabinet rated for −30°C to 55°C and altitudes up to 2000 m.',
      },
      {
        question: 'How is it monitored?',
        answer:
          'RS485 / Ethernet / CAN interfaces with cloud real-time monitoring, remote diagnostics and AI-assisted operation and maintenance.',
      },
      {
        question: 'What is the warranty?',
        answer:
          'Defined in the supply and commissioning contract; standard Trontek C&I terms apply. Confirm with iTarang.',
      },
    ],
    sections: [
      {
        kind: 'compatibility',
        items: [
          'AC output: 800 VAC, 3-phase 3-wire, 50 Hz',
          'Communication: RS485 / Ethernet / CAN; cloud web real-time monitoring',
          'Protection class: IP54 (outdoor rated)',
        ],
      },
    ],
    media: mediaFor('BESS_HESS-418kWh-215kW', 'Trontek EKON HESS-418kWh-215kW'),
  },

  /* ============================================================ Chargers */

  /* -------------------- Charger · TK500W · TK 51-10 */
  {
    productKey: 'trontek-charger-tk51-10',
    slug: 'trontek-tk500w-charger-tk51-10',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK500W Lithium EV Battery Charger TK 51-10',
    subtitle: 'Lithium-ion battery charger',
    modelName: 'TK 51-10',
    genericName: 'Lithium-ion battery charger',
    productType: 'On-board / off-board charger, CC-CV, active PFC + LLC',
    netQuantity: '1 Count',
    category: 'chargers',
    subcategory: 'ev-chargers',
    art: 'inverter',
    countryOfOrigin: 'India',
    description: [
      "The Trontek TK 51-10 is a 500 W lithium EV battery charger from the TK500W series, rated for 48V packs with a maximum output of 58.4 V at 10 A. Active PFC and LLC design deliver ≥94% efficiency and ≥0.99 power factor from a 220 VAC ±15% supply, with fast active and passive self-protection on voltage and current. The die-cast, glue-sealed shell and potted cooling fan give an IP66 unit built for on-board or off-board use in Indian conditions. CAN bus lets the charger talk to compatible battery BMS for controlled charging, and it shuts down automatically when the pack is full. Made at Trontek's New Delhi facility.",
    ],
    highlights: [
      'Active PFC and LLC topology — rapid fault response, software and hardware self-protection on voltage and current',
      'Advanced charging strategy acts as a safeguard for the battery system',
      'Integrated die-cast aluminium shell, sealed with special glue; IP66 rated',
      'Long-life potted active cooling fan; proven for 10+ years across wet, hot, cold and high-altitude environments',
      'CAN bus interface and tri-colour status indicator',
      'Burnout, reverse-connection, no-load and short-circuit protection; automatic shut-off when fully charged',
      'Certifications shown: UL, CE, IEC, KC, RCM, TÜV, IP66',
    ],
    boxContents: [],
    careInstructions: null,
    // "[insert Trontek charger warranty]".
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: CHARGER_HSN,
    taxRate: GST,
    facets: { voltage: 48 },
    badges: [],
    popularityRank: 23,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-CHG-TK5110')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Series', value: 'TK500W' },
          { label: 'Model', value: 'TK 51-10' },
          { label: 'Rated battery pack voltage', value: '48 V' },
          { label: 'Max. output voltage', value: '58.4 V' },
          { label: 'Max. output current', value: '10 A' },
          { label: 'Rated power', value: '500 W' },
          { label: 'AC input voltage range', value: '220 VAC ±15%' },
          { label: 'AC input max. current', value: '≤ 3 A' },
          { label: 'Power factor', value: '≥ 0.99' },
          { label: 'Efficiency', value: '≥ 94%' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
          { label: 'Communication', value: 'CAN bus compatible' },
          { label: 'Indication', value: 'Tri-colour LED; common-fault LED' },
          {
            label: 'Over-temperature',
            value:
              'Power derates above limit; stops and goes to standby above 65°C ambient, resumes when cool',
          },
          {
            label: 'Protections',
            value:
              'Burnout (over-temperature), reverse battery connection, no-load (no output without battery), output short circuit, auto shut-off at full charge',
          },
          { label: 'Enclosure', value: 'Integrated die-cast, glue-sealed; IP66' },
          { label: 'Cooling', value: 'Active fan (potted, long-life)' },
          { label: 'Height', value: '68 ±2 mm' },
          { label: 'Width', value: '122 ±2 mm' },
          { label: 'Length', value: '187 ±2 mm' },
          { label: 'Other models in series', value: 'TK 64-07, TK 51-10N, TK 60-07, TK 72-07' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '187 × 122 × 68 mm (±2 mm)' },
          { label: 'In centimetres', value: '18.7 × 12.2 × 6.8 cm' },
          { label: 'Net weight', value: '~1.65 kg' },
          { label: 'Shipping weight', value: '~5.65 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek TK500W Lithium EV Battery Charger TK 51-10' },
          { label: 'Model name', value: 'TK 51-10' },
          { label: 'Series', value: 'TK500W series (500 W)' },
          {
            label: 'Category',
            value: 'EV Battery Charger / Lithium Battery Charger (2W / 3W / Light EV)',
          },
          { label: 'Generic name', value: 'Lithium-ion battery charger' },
          { label: 'Type', value: 'On-board / off-board charger, CC-CV, active PFC + LLC' },
          { label: 'Suitable for battery pack', value: '48V lithium (LFP / Li-ion) packs' },
          { label: 'Max. output voltage', value: '58.4 V' },
          { label: 'Max. output current', value: '10 A' },
          { label: 'Input', value: '220 VAC ±15%, ≤ 3 A' },
          {
            label: 'Interface',
            value: 'CAN bus compatible; tri-colour LED status; common-fault LED indication',
          },
          {
            label: 'Applications',
            value:
              'E-rickshaws, e-loaders, e-scooters, golf cars, AGVs, material handling, floor care, mobile elevated platforms, ATV/UTV, aquatic and outdoor power supply',
          },
          { label: 'Colour', value: 'Orange / grey die-cast' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8504 40 (static converters / battery chargers)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which batteries can I charge with this?',
        answer:
          'Any 48V lithium pack (LFP or NMC) whose BMS accepts a 58.4 V charge voltage and ≥ 10 A charge current. Check the battery datasheet — for LFP packs, 48V nominal usually means 16S / 51.2V, charged at 58.4V. Do not use on lead-acid batteries.',
      },
      {
        question: 'How long will a full charge take?',
        answer:
          'Roughly battery Ah ÷ 10 A plus about 30 minutes for the CV tail. Example: a 105 Ah pack ≈ 11 hours; a 30 Ah pack ≈ 3.5 hours.',
      },
      {
        question: 'Can I leave it connected overnight?',
        answer:
          'Yes. The charger switches off automatically when the pack is full and has no-load protection, so it does not trickle or overcharge.',
      },
      {
        question: 'Is it safe to use outdoors or in the rain?',
        answer:
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
      },
      {
        question: 'What does the LED indicate?',
        answer:
          'Tri-colour status: charging, fully charged, and fault. A common-fault indication flags reverse connection, short circuit or over-temperature — fix the fault and reconnect the battery to resume.',
      },
      {
        question: 'What happens if I connect the battery backwards?',
        answer:
          'Reverse-connection protection disconnects the output; neither charger nor battery is damaged. Reconnect correctly to charge.',
      },
      {
        question: 'Does it work with CAN-enabled batteries?',
        answer:
          'Yes — the CAN bus interface lets a compatible BMS control charge voltage and current. Non-CAN packs charge on the fixed CC-CV profile.',
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Rated battery pack voltage', value: '48 V' },
          { label: 'Max. output voltage', value: '58.4 V' },
          { label: 'Max. output current', value: '10 A' },
          { label: 'Rated power', value: '500 W' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '48V lithium (LFP / Li-ion) packs',
          'Interface: CAN bus compatible; tri-colour LED status; common-fault LED indication',
          'Input: 220 VAC ±15%, ≤ 3 A',
        ],
      },
      {
        kind: 'care',
        items: [
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
        ],
      },
    ],
    media: mediaFor('Charger_TK500W_TK51-10', 'Trontek TK500W charger (TK 51-10)'),
  },

  /* -------------------- Charger · TK500W · TK 51-10N */
  {
    productKey: 'trontek-charger-tk51-10n',
    slug: 'trontek-tk500w-charger-tk51-10n',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK500W Lithium EV Battery Charger TK 51-10N',
    subtitle: 'Lithium-ion battery charger',
    modelName: 'TK 51-10N',
    genericName: 'Lithium-ion battery charger',
    productType: 'On-board / off-board charger, CC-CV, active PFC + LLC',
    netQuantity: '1 Count',
    category: 'chargers',
    subcategory: 'ev-chargers',
    art: 'inverter',
    countryOfOrigin: 'India',
    description: [
      "The Trontek TK 51-10N is a 500 W lithium EV battery charger from the TK500W series, rated for 48V packs with a maximum output of 58.8 V at 10 A. Active PFC and LLC design deliver ≥94% efficiency and ≥0.99 power factor from a 220 VAC ±15% supply, with fast active and passive self-protection on voltage and current. The die-cast, glue-sealed shell and potted cooling fan give an IP66 unit built for on-board or off-board use in Indian conditions. CAN bus lets the charger talk to compatible battery BMS for controlled charging, and it shuts down automatically when the pack is full. Made at Trontek's New Delhi facility.",
    ],
    highlights: [
      'Active PFC and LLC topology — rapid fault response, software and hardware self-protection on voltage and current',
      'Advanced charging strategy acts as a safeguard for the battery system',
      'Integrated die-cast aluminium shell, sealed with special glue; IP66 rated',
      'Long-life potted active cooling fan; proven for 10+ years across wet, hot, cold and high-altitude environments',
      'CAN bus interface and tri-colour status indicator',
      'Burnout, reverse-connection, no-load and short-circuit protection; automatic shut-off when fully charged',
      'Certifications shown: UL, CE, IEC, KC, RCM, TÜV, IP66',
    ],
    boxContents: [],
    careInstructions: null,
    // "[insert Trontek charger warranty]".
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: CHARGER_HSN,
    taxRate: GST,
    facets: { voltage: 48 },
    badges: [],
    popularityRank: 24,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-CHG-TK5110N')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Series', value: 'TK500W' },
          { label: 'Model', value: 'TK 51-10N' },
          { label: 'Rated battery pack voltage', value: '48 V' },
          { label: 'Max. output voltage', value: '58.8 V' },
          { label: 'Max. output current', value: '10 A' },
          { label: 'Rated power', value: '500 W' },
          { label: 'AC input voltage range', value: '220 VAC ±15%' },
          { label: 'AC input max. current', value: '≤ 3 A' },
          { label: 'Power factor', value: '≥ 0.99' },
          { label: 'Efficiency', value: '≥ 94%' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
          { label: 'Communication', value: 'CAN bus compatible' },
          { label: 'Indication', value: 'Tri-colour LED; common-fault LED' },
          {
            label: 'Over-temperature',
            value:
              'Power derates above limit; stops and goes to standby above 65°C ambient, resumes when cool',
          },
          {
            label: 'Protections',
            value:
              'Burnout (over-temperature), reverse battery connection, no-load (no output without battery), output short circuit, auto shut-off at full charge',
          },
          { label: 'Enclosure', value: 'Integrated die-cast, glue-sealed; IP66' },
          { label: 'Cooling', value: 'Active fan (potted, long-life)' },
          { label: 'Height', value: '68 ±2 mm' },
          { label: 'Width', value: '122 ±2 mm' },
          { label: 'Length', value: '187 ±2 mm' },
          { label: 'Other models in series', value: 'TK 51-10, TK 64-07, TK 60-07, TK 72-07' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '187 × 122 × 68 mm (±2 mm)' },
          { label: 'In centimetres', value: '18.7 × 12.2 × 6.8 cm' },
          { label: 'Net weight', value: '~1.65 kg' },
          { label: 'Shipping weight', value: '~5.65 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek TK500W Lithium EV Battery Charger TK 51-10N' },
          { label: 'Model name', value: 'TK 51-10N' },
          { label: 'Series', value: 'TK500W series (500 W)' },
          {
            label: 'Category',
            value: 'EV Battery Charger / Lithium Battery Charger (2W / 3W / Light EV)',
          },
          { label: 'Generic name', value: 'Lithium-ion battery charger' },
          { label: 'Type', value: 'On-board / off-board charger, CC-CV, active PFC + LLC' },
          { label: 'Suitable for battery pack', value: '48V lithium (LFP / Li-ion) packs' },
          { label: 'Max. output voltage', value: '58.8 V' },
          { label: 'Max. output current', value: '10 A' },
          { label: 'Input', value: '220 VAC ±15%, ≤ 3 A' },
          {
            label: 'Interface',
            value: 'CAN bus compatible; tri-colour LED status; common-fault LED indication',
          },
          {
            label: 'Applications',
            value:
              'E-rickshaws, e-loaders, e-scooters, golf cars, AGVs, material handling, floor care, mobile elevated platforms, ATV/UTV, aquatic and outdoor power supply',
          },
          { label: 'Colour', value: 'Orange / grey die-cast' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8504 40 (static converters / battery chargers)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which batteries can I charge with this?',
        answer:
          'Any 48V lithium pack (LFP or NMC) whose BMS accepts a 58.8 V charge voltage and ≥ 10 A charge current. Check the battery datasheet — for LFP packs, 48V nominal usually means 16S / 51.2V, charged at 58.4V. Do not use on lead-acid batteries.',
      },
      {
        question: 'How long will a full charge take?',
        answer:
          'Roughly battery Ah ÷ 10 A plus about 30 minutes for the CV tail. Example: a 105 Ah pack ≈ 11 hours; a 30 Ah pack ≈ 3.5 hours.',
      },
      {
        question: 'Can I leave it connected overnight?',
        answer:
          'Yes. The charger switches off automatically when the pack is full and has no-load protection, so it does not trickle or overcharge.',
      },
      {
        question: 'Is it safe to use outdoors or in the rain?',
        answer:
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
      },
      {
        question: 'What does the LED indicate?',
        answer:
          'Tri-colour status: charging, fully charged, and fault. A common-fault indication flags reverse connection, short circuit or over-temperature — fix the fault and reconnect the battery to resume.',
      },
      {
        question: 'What happens if I connect the battery backwards?',
        answer:
          'Reverse-connection protection disconnects the output; neither charger nor battery is damaged. Reconnect correctly to charge.',
      },
      {
        question: 'Does it work with CAN-enabled batteries?',
        answer:
          'Yes — the CAN bus interface lets a compatible BMS control charge voltage and current. Non-CAN packs charge on the fixed CC-CV profile.',
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Rated battery pack voltage', value: '48 V' },
          { label: 'Max. output voltage', value: '58.8 V' },
          { label: 'Max. output current', value: '10 A' },
          { label: 'Rated power', value: '500 W' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '48V lithium (LFP / Li-ion) packs',
          'Interface: CAN bus compatible; tri-colour LED status; common-fault LED indication',
          'Input: 220 VAC ±15%, ≤ 3 A',
        ],
      },
      {
        kind: 'care',
        items: [
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
        ],
      },
    ],
    media: mediaFor('Charger_TK500W_TK51-10N', 'Trontek TK500W charger (TK 51-10N)'),
  },

  /* -------------------- Charger · TK500W · TK 60-07 */
  {
    productKey: 'trontek-charger-tk60-07',
    slug: 'trontek-tk500w-charger-tk60-07',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK500W Lithium EV Battery Charger TK 60-07',
    subtitle: 'Lithium-ion battery charger',
    modelName: 'TK 60-07',
    genericName: 'Lithium-ion battery charger',
    productType: 'On-board / off-board charger, CC-CV, active PFC + LLC',
    netQuantity: '1 Count',
    category: 'chargers',
    subcategory: 'ev-chargers',
    art: 'inverter',
    countryOfOrigin: 'India',
    description: [
      "The Trontek TK 60-07 is a 500 W lithium EV battery charger from the TK500W series, rated for 60V packs with a maximum output of 67.2 V at 7 A. Active PFC and LLC design deliver ≥94% efficiency and ≥0.99 power factor from a 220 VAC ±15% supply, with fast active and passive self-protection on voltage and current. The die-cast, glue-sealed shell and potted cooling fan give an IP66 unit built for on-board or off-board use in Indian conditions. CAN bus lets the charger talk to compatible battery BMS for controlled charging, and it shuts down automatically when the pack is full. Made at Trontek's New Delhi facility.",
    ],
    highlights: [
      'Active PFC and LLC topology — rapid fault response, software and hardware self-protection on voltage and current',
      'Advanced charging strategy acts as a safeguard for the battery system',
      'Integrated die-cast aluminium shell, sealed with special glue; IP66 rated',
      'Long-life potted active cooling fan; proven for 10+ years across wet, hot, cold and high-altitude environments',
      'CAN bus interface and tri-colour status indicator',
      'Burnout, reverse-connection, no-load and short-circuit protection; automatic shut-off when fully charged',
      'Certifications shown: UL, CE, IEC, KC, RCM, TÜV, IP66',
    ],
    boxContents: [],
    careInstructions: null,
    // "[insert Trontek charger warranty]".
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: CHARGER_HSN,
    taxRate: GST,
    facets: { voltage: 60 },
    badges: [],
    popularityRank: 25,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-CHG-TK6007')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Series', value: 'TK500W' },
          { label: 'Model', value: 'TK 60-07' },
          { label: 'Rated battery pack voltage', value: '60 V' },
          { label: 'Max. output voltage', value: '67.2 V' },
          { label: 'Max. output current', value: '7 A' },
          { label: 'Rated power', value: '500 W' },
          { label: 'AC input voltage range', value: '220 VAC ±15%' },
          { label: 'AC input max. current', value: '≤ 3 A' },
          { label: 'Power factor', value: '≥ 0.99' },
          { label: 'Efficiency', value: '≥ 94%' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
          { label: 'Communication', value: 'CAN bus compatible' },
          { label: 'Indication', value: 'Tri-colour LED; common-fault LED' },
          {
            label: 'Over-temperature',
            value:
              'Power derates above limit; stops and goes to standby above 65°C ambient, resumes when cool',
          },
          {
            label: 'Protections',
            value:
              'Burnout (over-temperature), reverse battery connection, no-load (no output without battery), output short circuit, auto shut-off at full charge',
          },
          { label: 'Enclosure', value: 'Integrated die-cast, glue-sealed; IP66' },
          { label: 'Cooling', value: 'Active fan (potted, long-life)' },
          { label: 'Height', value: '68 ±2 mm' },
          { label: 'Width', value: '122 ±2 mm' },
          { label: 'Length', value: '187 ±2 mm' },
          { label: 'Other models in series', value: 'TK 51-10, TK 64-07, TK 51-10N, TK 72-07' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '187 × 122 × 68 mm (±2 mm)' },
          { label: 'In centimetres', value: '18.7 × 12.2 × 6.8 cm' },
          { label: 'Net weight', value: '~1.65 kg' },
          { label: 'Shipping weight', value: '~5.65 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek TK500W Lithium EV Battery Charger TK 60-07' },
          { label: 'Model name', value: 'TK 60-07' },
          { label: 'Series', value: 'TK500W series (500 W)' },
          {
            label: 'Category',
            value: 'EV Battery Charger / Lithium Battery Charger (2W / 3W / Light EV)',
          },
          { label: 'Generic name', value: 'Lithium-ion battery charger' },
          { label: 'Type', value: 'On-board / off-board charger, CC-CV, active PFC + LLC' },
          { label: 'Suitable for battery pack', value: '60V lithium (LFP / Li-ion) packs' },
          { label: 'Max. output voltage', value: '67.2 V' },
          { label: 'Max. output current', value: '7 A' },
          { label: 'Input', value: '220 VAC ±15%, ≤ 3 A' },
          {
            label: 'Interface',
            value: 'CAN bus compatible; tri-colour LED status; common-fault LED indication',
          },
          {
            label: 'Applications',
            value:
              'E-rickshaws, e-loaders, e-scooters, golf cars, AGVs, material handling, floor care, mobile elevated platforms, ATV/UTV, aquatic and outdoor power supply',
          },
          { label: 'Colour', value: 'Orange / grey die-cast' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8504 40 (static converters / battery chargers)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which batteries can I charge with this?',
        answer:
          'Any 60V lithium pack (LFP or NMC) whose BMS accepts a 67.2 V charge voltage and ≥ 7 A charge current. Check the battery datasheet — for LFP packs, 60V nominal usually means 19S / 60.8V, charged at 69.35V. Do not use on lead-acid batteries.',
      },
      {
        question: 'How long will a full charge take?',
        answer:
          'Roughly battery Ah ÷ 7 A plus about 30 minutes for the CV tail. Example: a 105 Ah pack ≈ 15.5 hours; a 30 Ah pack ≈ 4.8 hours.',
      },
      {
        question: 'Can I leave it connected overnight?',
        answer:
          'Yes. The charger switches off automatically when the pack is full and has no-load protection, so it does not trickle or overcharge.',
      },
      {
        question: 'Is it safe to use outdoors or in the rain?',
        answer:
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
      },
      {
        question: 'What does the LED indicate?',
        answer:
          'Tri-colour status: charging, fully charged, and fault. A common-fault indication flags reverse connection, short circuit or over-temperature — fix the fault and reconnect the battery to resume.',
      },
      {
        question: 'What happens if I connect the battery backwards?',
        answer:
          'Reverse-connection protection disconnects the output; neither charger nor battery is damaged. Reconnect correctly to charge.',
      },
      {
        question: 'Does it work with CAN-enabled batteries?',
        answer:
          'Yes — the CAN bus interface lets a compatible BMS control charge voltage and current. Non-CAN packs charge on the fixed CC-CV profile.',
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Rated battery pack voltage', value: '60 V' },
          { label: 'Max. output voltage', value: '67.2 V' },
          { label: 'Max. output current', value: '7 A' },
          { label: 'Rated power', value: '500 W' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '60V lithium (LFP / Li-ion) packs',
          'Interface: CAN bus compatible; tri-colour LED status; common-fault LED indication',
          'Input: 220 VAC ±15%, ≤ 3 A',
        ],
      },
      {
        kind: 'care',
        items: [
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
        ],
      },
    ],
    media: mediaFor('Charger_TK500W_TK60-07', 'Trontek TK500W charger (TK 60-07)'),
  },

  /* -------------------- Charger · TK500W · TK 64-07 */
  {
    productKey: 'trontek-charger-tk64-07',
    slug: 'trontek-tk500w-charger-tk64-07',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK500W Lithium EV Battery Charger TK 64-07',
    subtitle: 'Lithium-ion battery charger',
    modelName: 'TK 64-07',
    genericName: 'Lithium-ion battery charger',
    productType: 'On-board / off-board charger, CC-CV, active PFC + LLC',
    netQuantity: '1 Count',
    category: 'chargers',
    subcategory: 'ev-chargers',
    art: 'inverter',
    countryOfOrigin: 'India',
    description: [
      "The Trontek TK 64-07 is a 500 W lithium EV battery charger from the TK500W series, rated for 60V packs with a maximum output of 73 V at 7 A. Active PFC and LLC design deliver ≥94% efficiency and ≥0.99 power factor from a 220 VAC ±15% supply, with fast active and passive self-protection on voltage and current. The die-cast, glue-sealed shell and potted cooling fan give an IP66 unit built for on-board or off-board use in Indian conditions. CAN bus lets the charger talk to compatible battery BMS for controlled charging, and it shuts down automatically when the pack is full. Made at Trontek's New Delhi facility.",
    ],
    highlights: [
      'Active PFC and LLC topology — rapid fault response, software and hardware self-protection on voltage and current',
      'Advanced charging strategy acts as a safeguard for the battery system',
      'Integrated die-cast aluminium shell, sealed with special glue; IP66 rated',
      'Long-life potted active cooling fan; proven for 10+ years across wet, hot, cold and high-altitude environments',
      'CAN bus interface and tri-colour status indicator',
      'Burnout, reverse-connection, no-load and short-circuit protection; automatic shut-off when fully charged',
      'Certifications shown: UL, CE, IEC, KC, RCM, TÜV, IP66',
    ],
    boxContents: [],
    careInstructions: null,
    // "[insert Trontek charger warranty]".
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: CHARGER_HSN,
    taxRate: GST,
    facets: { voltage: 60 },
    badges: [],
    popularityRank: 26,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-CHG-TK6407')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Series', value: 'TK500W' },
          { label: 'Model', value: 'TK 64-07' },
          { label: 'Rated battery pack voltage', value: '60 V' },
          { label: 'Max. output voltage', value: '73 V' },
          { label: 'Max. output current', value: '7 A' },
          { label: 'Rated power', value: '500 W' },
          { label: 'AC input voltage range', value: '220 VAC ±15%' },
          { label: 'AC input max. current', value: '≤ 3 A' },
          { label: 'Power factor', value: '≥ 0.99' },
          { label: 'Efficiency', value: '≥ 94%' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
          { label: 'Communication', value: 'CAN bus compatible' },
          { label: 'Indication', value: 'Tri-colour LED; common-fault LED' },
          {
            label: 'Over-temperature',
            value:
              'Power derates above limit; stops and goes to standby above 65°C ambient, resumes when cool',
          },
          {
            label: 'Protections',
            value:
              'Burnout (over-temperature), reverse battery connection, no-load (no output without battery), output short circuit, auto shut-off at full charge',
          },
          { label: 'Enclosure', value: 'Integrated die-cast, glue-sealed; IP66' },
          { label: 'Cooling', value: 'Active fan (potted, long-life)' },
          { label: 'Height', value: '68 ±2 mm' },
          { label: 'Width', value: '122 ±2 mm' },
          { label: 'Length', value: '187 ±2 mm' },
          { label: 'Other models in series', value: 'TK 51-10, TK 51-10N, TK 60-07, TK 72-07' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '187 × 122 × 68 mm (±2 mm)' },
          { label: 'In centimetres', value: '18.7 × 12.2 × 6.8 cm' },
          { label: 'Net weight', value: '~1.65 kg' },
          { label: 'Shipping weight', value: '~5.65 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek TK500W Lithium EV Battery Charger TK 64-07' },
          { label: 'Model name', value: 'TK 64-07' },
          { label: 'Series', value: 'TK500W series (500 W)' },
          {
            label: 'Category',
            value: 'EV Battery Charger / Lithium Battery Charger (2W / 3W / Light EV)',
          },
          { label: 'Generic name', value: 'Lithium-ion battery charger' },
          { label: 'Type', value: 'On-board / off-board charger, CC-CV, active PFC + LLC' },
          { label: 'Suitable for battery pack', value: '60V lithium (LFP / Li-ion) packs' },
          { label: 'Max. output voltage', value: '73 V' },
          { label: 'Max. output current', value: '7 A' },
          { label: 'Input', value: '220 VAC ±15%, ≤ 3 A' },
          {
            label: 'Interface',
            value: 'CAN bus compatible; tri-colour LED status; common-fault LED indication',
          },
          {
            label: 'Applications',
            value:
              'E-rickshaws, e-loaders, e-scooters, golf cars, AGVs, material handling, floor care, mobile elevated platforms, ATV/UTV, aquatic and outdoor power supply',
          },
          { label: 'Colour', value: 'Orange / grey die-cast' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8504 40 (static converters / battery chargers)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which batteries can I charge with this?',
        answer:
          'Any 60V lithium pack (LFP or NMC) whose BMS accepts a 73 V charge voltage and ≥ 7 A charge current. Check the battery datasheet — for LFP packs, 60V nominal usually means 19S / 60.8V, charged at 69.35V. Do not use on lead-acid batteries.',
      },
      {
        question: 'How long will a full charge take?',
        answer:
          'Roughly battery Ah ÷ 7 A plus about 30 minutes for the CV tail. Example: a 105 Ah pack ≈ 15.5 hours; a 30 Ah pack ≈ 4.8 hours.',
      },
      {
        question: 'Can I leave it connected overnight?',
        answer:
          'Yes. The charger switches off automatically when the pack is full and has no-load protection, so it does not trickle or overcharge.',
      },
      {
        question: 'Is it safe to use outdoors or in the rain?',
        answer:
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
      },
      {
        question: 'What does the LED indicate?',
        answer:
          'Tri-colour status: charging, fully charged, and fault. A common-fault indication flags reverse connection, short circuit or over-temperature — fix the fault and reconnect the battery to resume.',
      },
      {
        question: 'What happens if I connect the battery backwards?',
        answer:
          'Reverse-connection protection disconnects the output; neither charger nor battery is damaged. Reconnect correctly to charge.',
      },
      {
        question: 'Does it work with CAN-enabled batteries?',
        answer:
          'Yes — the CAN bus interface lets a compatible BMS control charge voltage and current. Non-CAN packs charge on the fixed CC-CV profile.',
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Rated battery pack voltage', value: '60 V' },
          { label: 'Max. output voltage', value: '73 V' },
          { label: 'Max. output current', value: '7 A' },
          { label: 'Rated power', value: '500 W' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '60V lithium (LFP / Li-ion) packs',
          'Interface: CAN bus compatible; tri-colour LED status; common-fault LED indication',
          'Input: 220 VAC ±15%, ≤ 3 A',
        ],
      },
      {
        kind: 'care',
        items: [
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
        ],
      },
    ],
    media: mediaFor('Charger_TK500W_TK64-07', 'Trontek TK500W charger (TK 64-07)'),
  },

  /* -------------------- Charger · TK500W · TK 72-07 */
  {
    productKey: 'trontek-charger-tk72-07',
    slug: 'trontek-tk500w-charger-tk72-07',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK500W Lithium EV Battery Charger TK 72-07',
    subtitle: 'Lithium-ion battery charger',
    modelName: 'TK 72-07',
    genericName: 'Lithium-ion battery charger',
    productType: 'On-board / off-board charger, CC-CV, active PFC + LLC',
    netQuantity: '1 Count',
    category: 'chargers',
    subcategory: 'ev-chargers',
    art: 'inverter',
    countryOfOrigin: 'India',
    description: [
      "The Trontek TK 72-07 is a 500 W lithium EV battery charger from the TK500W series, rated for 72V packs with a maximum output of 84 V at 6 A. Active PFC and LLC design deliver ≥94% efficiency and ≥0.99 power factor from a 220 VAC ±15% supply, with fast active and passive self-protection on voltage and current. The die-cast, glue-sealed shell and potted cooling fan give an IP66 unit built for on-board or off-board use in Indian conditions. CAN bus lets the charger talk to compatible battery BMS for controlled charging, and it shuts down automatically when the pack is full. Made at Trontek's New Delhi facility.",
    ],
    highlights: [
      'Active PFC and LLC topology — rapid fault response, software and hardware self-protection on voltage and current',
      'Advanced charging strategy acts as a safeguard for the battery system',
      'Integrated die-cast aluminium shell, sealed with special glue; IP66 rated',
      'Long-life potted active cooling fan; proven for 10+ years across wet, hot, cold and high-altitude environments',
      'CAN bus interface and tri-colour status indicator',
      'Burnout, reverse-connection, no-load and short-circuit protection; automatic shut-off when fully charged',
      'Certifications shown: UL, CE, IEC, KC, RCM, TÜV, IP66',
    ],
    boxContents: [],
    careInstructions: null,
    // "[insert Trontek charger warranty]".
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: CHARGER_HSN,
    taxRate: GST,
    facets: { voltage: 72 },
    badges: [],
    popularityRank: 27,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-CHG-TK7207')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Series', value: 'TK500W' },
          { label: 'Model', value: 'TK 72-07' },
          { label: 'Rated battery pack voltage', value: '72 V' },
          { label: 'Max. output voltage', value: '84 V' },
          { label: 'Max. output current', value: '6 A' },
          { label: 'Rated power', value: '500 W' },
          { label: 'AC input voltage range', value: '220 VAC ±15%' },
          { label: 'AC input max. current', value: '≤ 3 A' },
          { label: 'Power factor', value: '≥ 0.99' },
          { label: 'Efficiency', value: '≥ 94%' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
          { label: 'Communication', value: 'CAN bus compatible' },
          { label: 'Indication', value: 'Tri-colour LED; common-fault LED' },
          {
            label: 'Over-temperature',
            value:
              'Power derates above limit; stops and goes to standby above 65°C ambient, resumes when cool',
          },
          {
            label: 'Protections',
            value:
              'Burnout (over-temperature), reverse battery connection, no-load (no output without battery), output short circuit, auto shut-off at full charge',
          },
          { label: 'Enclosure', value: 'Integrated die-cast, glue-sealed; IP66' },
          { label: 'Cooling', value: 'Active fan (potted, long-life)' },
          { label: 'Height', value: '68 ±2 mm' },
          { label: 'Width', value: '122 ±2 mm' },
          { label: 'Length', value: '187 ±2 mm' },
          { label: 'Other models in series', value: 'TK 51-10, TK 64-07, TK 51-10N, TK 60-07' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '187 × 122 × 68 mm (±2 mm)' },
          { label: 'In centimetres', value: '18.7 × 12.2 × 6.8 cm' },
          { label: 'Net weight', value: '~1.65 kg' },
          { label: 'Shipping weight', value: '~5.65 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek TK500W Lithium EV Battery Charger TK 72-07' },
          { label: 'Model name', value: 'TK 72-07' },
          { label: 'Series', value: 'TK500W series (500 W)' },
          {
            label: 'Category',
            value: 'EV Battery Charger / Lithium Battery Charger (2W / 3W / Light EV)',
          },
          { label: 'Generic name', value: 'Lithium-ion battery charger' },
          { label: 'Type', value: 'On-board / off-board charger, CC-CV, active PFC + LLC' },
          { label: 'Suitable for battery pack', value: '72V lithium (LFP / Li-ion) packs' },
          { label: 'Max. output voltage', value: '84 V' },
          { label: 'Max. output current', value: '6 A' },
          { label: 'Input', value: '220 VAC ±15%, ≤ 3 A' },
          {
            label: 'Interface',
            value: 'CAN bus compatible; tri-colour LED status; common-fault LED indication',
          },
          {
            label: 'Applications',
            value:
              'E-rickshaws, e-loaders, e-scooters, golf cars, AGVs, material handling, floor care, mobile elevated platforms, ATV/UTV, aquatic and outdoor power supply',
          },
          { label: 'Colour', value: 'Orange / grey die-cast' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8504 40 (static converters / battery chargers)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which batteries can I charge with this?',
        answer:
          'Any 72V lithium pack (LFP or NMC) whose BMS accepts a 84 V charge voltage and ≥ 6 A charge current. Check the battery datasheet — for LFP packs, 72V nominal usually means 23S / 73.6V, charged at 83.95V. Do not use on lead-acid batteries.',
      },
      {
        question: 'How long will a full charge take?',
        answer:
          'Roughly battery Ah ÷ 6 A plus about 30 minutes for the CV tail. Example: a 105 Ah pack ≈ 18 hours; a 30 Ah pack ≈ 5.5 hours.',
      },
      {
        question: 'Can I leave it connected overnight?',
        answer:
          'Yes. The charger switches off automatically when the pack is full and has no-load protection, so it does not trickle or overcharge.',
      },
      {
        question: 'Is it safe to use outdoors or in the rain?',
        answer:
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
      },
      {
        question: 'What does the LED indicate?',
        answer:
          'Tri-colour status: charging, fully charged, and fault. A common-fault indication flags reverse connection, short circuit or over-temperature — fix the fault and reconnect the battery to resume.',
      },
      {
        question: 'What happens if I connect the battery backwards?',
        answer:
          'Reverse-connection protection disconnects the output; neither charger nor battery is damaged. Reconnect correctly to charge.',
      },
      {
        question: 'Does it work with CAN-enabled batteries?',
        answer:
          'Yes — the CAN bus interface lets a compatible BMS control charge voltage and current. Non-CAN packs charge on the fixed CC-CV profile.',
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Rated battery pack voltage', value: '72 V' },
          { label: 'Max. output voltage', value: '84 V' },
          { label: 'Max. output current', value: '6 A' },
          { label: 'Rated power', value: '500 W' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '72V lithium (LFP / Li-ion) packs',
          'Interface: CAN bus compatible; tri-colour LED status; common-fault LED indication',
          'Input: 220 VAC ±15%, ≤ 3 A',
        ],
      },
      {
        kind: 'care',
        items: [
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
        ],
      },
    ],
    media: mediaFor('Charger_TK500W_TK72-07', 'Trontek TK500W charger (TK 72-07)'),
  },

  /* -------------------- Charger · TK840W · TK 51-16 */
  {
    productKey: 'trontek-charger-tk51-16',
    slug: 'trontek-tk840w-charger-tk51-16',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK840W Lithium EV Battery Charger TK 51-16',
    subtitle: 'Lithium-ion battery charger',
    modelName: 'TK 51-16',
    genericName: 'Lithium-ion battery charger',
    productType: 'On-board / off-board charger, CC-CV, active PFC + LLC',
    netQuantity: '1 Count',
    category: 'chargers',
    subcategory: 'ev-chargers',
    art: 'inverter',
    countryOfOrigin: 'India',
    description: [
      "The Trontek TK 51-16 is a 840 W lithium EV battery charger from the TK840W series, rated for 48V packs with a maximum output of 58.4 V at 16 A. Active PFC and LLC design deliver ≥94% efficiency and ≥0.99 power factor from a 220 VAC ±15% supply, with fast active and passive self-protection on voltage and current. The die-cast, glue-sealed shell and potted cooling fan give an IP66 unit built for on-board or off-board use in Indian conditions. CAN bus lets the charger talk to compatible battery BMS for controlled charging, and it shuts down automatically when the pack is full. Made at Trontek's New Delhi facility.",
    ],
    highlights: [
      'Active PFC and LLC topology — rapid fault response, software and hardware self-protection on voltage and current',
      'Advanced charging strategy acts as a safeguard for the battery system',
      'Integrated die-cast aluminium shell, sealed with special glue; IP66 rated',
      'Long-life potted active cooling fan; proven for 10+ years across wet, hot, cold and high-altitude environments',
      'CAN bus interface and tri-colour status indicator',
      'Burnout, reverse-connection, no-load and short-circuit protection; automatic shut-off when fully charged',
      'Certifications shown: UL, CE, IEC, KC, RCM, TÜV, IP66',
    ],
    boxContents: [],
    careInstructions: null,
    // "[insert Trontek charger warranty]".
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: CHARGER_HSN,
    taxRate: GST,
    facets: { voltage: 48 },
    badges: [],
    popularityRank: 28,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-CHG-TK5116')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Series', value: 'TK840W' },
          { label: 'Model', value: 'TK 51-16' },
          { label: 'Rated battery pack voltage', value: '48 V' },
          { label: 'Max. output voltage', value: '58.4 V' },
          { label: 'Max. output current', value: '16 A' },
          { label: 'Rated power', value: '840 W' },
          { label: 'AC input voltage range', value: '220 VAC ±15%' },
          { label: 'AC input max. current', value: '≤ 5 A' },
          { label: 'Power factor', value: '≥ 0.99' },
          { label: 'Efficiency', value: '≥ 94%' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
          { label: 'Communication', value: 'CAN bus compatible' },
          { label: 'Indication', value: 'Tri-colour LED; common-fault LED' },
          {
            label: 'Over-temperature',
            value:
              'Power derates above limit; stops and goes to standby above 65°C ambient, resumes when cool',
          },
          {
            label: 'Protections',
            value:
              'Burnout (over-temperature), reverse battery connection, no-load (no output without battery), output short circuit, auto shut-off at full charge',
          },
          { label: 'Enclosure', value: 'Integrated die-cast, glue-sealed; IP66' },
          { label: 'Cooling', value: 'Active fan (potted, long-life)' },
          { label: 'Height', value: '62 ±2 mm' },
          { label: 'Width', value: '126 ±2 mm' },
          { label: 'Length', value: '156 ±2 mm' },
          { label: 'Other models in series', value: 'TK 61-12, TK 64-11, TK 72-10, TK 73-10' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '156 × 126 × 62 mm (±2 mm)' },
          { label: 'In centimetres', value: '15.6 × 12.6 × 6.2 cm' },
          { label: 'Net weight', value: '~2 kg' },
          { label: 'Shipping weight', value: '~6.00 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek TK840W Lithium EV Battery Charger TK 51-16' },
          { label: 'Model name', value: 'TK 51-16' },
          { label: 'Series', value: 'TK840W series (840 W)' },
          {
            label: 'Category',
            value: 'EV Battery Charger / Lithium Battery Charger (2W / 3W / Light EV)',
          },
          { label: 'Generic name', value: 'Lithium-ion battery charger' },
          { label: 'Type', value: 'On-board / off-board charger, CC-CV, active PFC + LLC' },
          { label: 'Suitable for battery pack', value: '48V lithium (LFP / Li-ion) packs' },
          { label: 'Max. output voltage', value: '58.4 V' },
          { label: 'Max. output current', value: '16 A' },
          { label: 'Input', value: '220 VAC ±15%, ≤ 5 A' },
          {
            label: 'Interface',
            value: 'CAN bus compatible; tri-colour LED status; common-fault LED indication',
          },
          {
            label: 'Applications',
            value:
              'E-rickshaws, e-loaders, e-scooters, golf cars, AGVs, material handling, floor care, mobile elevated platforms, ATV/UTV, aquatic and outdoor power supply',
          },
          { label: 'Colour', value: 'Orange / grey die-cast' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8504 40 (static converters / battery chargers)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which batteries can I charge with this?',
        answer:
          'Any 48V lithium pack (LFP or NMC) whose BMS accepts a 58.4 V charge voltage and ≥ 16 A charge current. Check the battery datasheet — for LFP packs, 48V nominal usually means 16S / 51.2V, charged at 58.4V. Do not use on lead-acid batteries.',
      },
      {
        question: 'How long will a full charge take?',
        answer:
          'Roughly battery Ah ÷ 16 A plus about 30 minutes for the CV tail. Example: a 105 Ah pack ≈ 7.1 hours; a 30 Ah pack ≈ 2.4 hours.',
      },
      {
        question: 'Can I leave it connected overnight?',
        answer:
          'Yes. The charger switches off automatically when the pack is full and has no-load protection, so it does not trickle or overcharge.',
      },
      {
        question: 'Is it safe to use outdoors or in the rain?',
        answer:
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
      },
      {
        question: 'What does the LED indicate?',
        answer:
          'Tri-colour status: charging, fully charged, and fault. A common-fault indication flags reverse connection, short circuit or over-temperature — fix the fault and reconnect the battery to resume.',
      },
      {
        question: 'What happens if I connect the battery backwards?',
        answer:
          'Reverse-connection protection disconnects the output; neither charger nor battery is damaged. Reconnect correctly to charge.',
      },
      {
        question: 'Does it work with CAN-enabled batteries?',
        answer:
          'Yes — the CAN bus interface lets a compatible BMS control charge voltage and current. Non-CAN packs charge on the fixed CC-CV profile.',
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Rated battery pack voltage', value: '48 V' },
          { label: 'Max. output voltage', value: '58.4 V' },
          { label: 'Max. output current', value: '16 A' },
          { label: 'Rated power', value: '840 W' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '48V lithium (LFP / Li-ion) packs',
          'Interface: CAN bus compatible; tri-colour LED status; common-fault LED indication',
          'Input: 220 VAC ±15%, ≤ 5 A',
        ],
      },
      {
        kind: 'care',
        items: [
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
        ],
      },
    ],
    media: mediaFor('Charger_TK840W_TK51-16', 'Trontek TK840W charger (TK 51-16)'),
  },

  /* -------------------- Charger · TK840W · TK 61-12 */
  {
    productKey: 'trontek-charger-tk61-12',
    slug: 'trontek-tk840w-charger-tk61-12',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK840W Lithium EV Battery Charger TK 61-12',
    subtitle: 'Lithium-ion battery charger',
    modelName: 'TK 61-12',
    genericName: 'Lithium-ion battery charger',
    productType: 'On-board / off-board charger, CC-CV, active PFC + LLC',
    netQuantity: '1 Count',
    category: 'chargers',
    subcategory: 'ev-chargers',
    art: 'inverter',
    countryOfOrigin: 'India',
    description: [
      "The Trontek TK 61-12 is a 840 W lithium EV battery charger from the TK840W series, rated for 60V packs with a maximum output of 69.35 V at 12 A. Active PFC and LLC design deliver ≥94% efficiency and ≥0.99 power factor from a 220 VAC ±15% supply, with fast active and passive self-protection on voltage and current. The die-cast, glue-sealed shell and potted cooling fan give an IP66 unit built for on-board or off-board use in Indian conditions. CAN bus lets the charger talk to compatible battery BMS for controlled charging, and it shuts down automatically when the pack is full. Made at Trontek's New Delhi facility.",
    ],
    highlights: [
      'Active PFC and LLC topology — rapid fault response, software and hardware self-protection on voltage and current',
      'Advanced charging strategy acts as a safeguard for the battery system',
      'Integrated die-cast aluminium shell, sealed with special glue; IP66 rated',
      'Long-life potted active cooling fan; proven for 10+ years across wet, hot, cold and high-altitude environments',
      'CAN bus interface and tri-colour status indicator',
      'Burnout, reverse-connection, no-load and short-circuit protection; automatic shut-off when fully charged',
      'Certifications shown: UL, CE, IEC, KC, RCM, TÜV, IP66',
    ],
    boxContents: [],
    careInstructions: null,
    // "[insert Trontek charger warranty]".
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: CHARGER_HSN,
    taxRate: GST,
    facets: { voltage: 60 },
    badges: [],
    popularityRank: 29,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-CHG-TK6112')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Series', value: 'TK840W' },
          { label: 'Model', value: 'TK 61-12' },
          { label: 'Rated battery pack voltage', value: '60 V' },
          { label: 'Max. output voltage', value: '69.35 V' },
          { label: 'Max. output current', value: '12 A' },
          { label: 'Rated power', value: '840 W' },
          { label: 'AC input voltage range', value: '220 VAC ±15%' },
          { label: 'AC input max. current', value: '≤ 5 A' },
          { label: 'Power factor', value: '≥ 0.99' },
          { label: 'Efficiency', value: '≥ 94%' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
          { label: 'Communication', value: 'CAN bus compatible' },
          { label: 'Indication', value: 'Tri-colour LED; common-fault LED' },
          {
            label: 'Over-temperature',
            value:
              'Power derates above limit; stops and goes to standby above 65°C ambient, resumes when cool',
          },
          {
            label: 'Protections',
            value:
              'Burnout (over-temperature), reverse battery connection, no-load (no output without battery), output short circuit, auto shut-off at full charge',
          },
          { label: 'Enclosure', value: 'Integrated die-cast, glue-sealed; IP66' },
          { label: 'Cooling', value: 'Active fan (potted, long-life)' },
          { label: 'Height', value: '62 ±2 mm' },
          { label: 'Width', value: '126 ±2 mm' },
          { label: 'Length', value: '156 ±2 mm' },
          { label: 'Other models in series', value: 'TK 51-16, TK 64-11, TK 72-10, TK 73-10' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '156 × 126 × 62 mm (±2 mm)' },
          { label: 'In centimetres', value: '15.6 × 12.6 × 6.2 cm' },
          { label: 'Net weight', value: '~2 kg' },
          { label: 'Shipping weight', value: '~6.00 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek TK840W Lithium EV Battery Charger TK 61-12' },
          { label: 'Model name', value: 'TK 61-12' },
          { label: 'Series', value: 'TK840W series (840 W)' },
          {
            label: 'Category',
            value: 'EV Battery Charger / Lithium Battery Charger (2W / 3W / Light EV)',
          },
          { label: 'Generic name', value: 'Lithium-ion battery charger' },
          { label: 'Type', value: 'On-board / off-board charger, CC-CV, active PFC + LLC' },
          { label: 'Suitable for battery pack', value: '60V lithium (LFP / Li-ion) packs' },
          { label: 'Max. output voltage', value: '69.35 V' },
          { label: 'Max. output current', value: '12 A' },
          { label: 'Input', value: '220 VAC ±15%, ≤ 5 A' },
          {
            label: 'Interface',
            value: 'CAN bus compatible; tri-colour LED status; common-fault LED indication',
          },
          {
            label: 'Applications',
            value:
              'E-rickshaws, e-loaders, e-scooters, golf cars, AGVs, material handling, floor care, mobile elevated platforms, ATV/UTV, aquatic and outdoor power supply',
          },
          { label: 'Colour', value: 'Orange / grey die-cast' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8504 40 (static converters / battery chargers)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which batteries can I charge with this?',
        answer:
          'Any 60V lithium pack (LFP or NMC) whose BMS accepts a 69.35 V charge voltage and ≥ 12 A charge current. Check the battery datasheet — for LFP packs, 60V nominal usually means 19S / 60.8V, charged at 69.35V. Do not use on lead-acid batteries.',
      },
      {
        question: 'How long will a full charge take?',
        answer:
          'Roughly battery Ah ÷ 12 A plus about 30 minutes for the CV tail. Example: a 105 Ah pack ≈ 9.3 hours; a 30 Ah pack ≈ 3 hours.',
      },
      {
        question: 'Can I leave it connected overnight?',
        answer:
          'Yes. The charger switches off automatically when the pack is full and has no-load protection, so it does not trickle or overcharge.',
      },
      {
        question: 'Is it safe to use outdoors or in the rain?',
        answer:
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
      },
      {
        question: 'What does the LED indicate?',
        answer:
          'Tri-colour status: charging, fully charged, and fault. A common-fault indication flags reverse connection, short circuit or over-temperature — fix the fault and reconnect the battery to resume.',
      },
      {
        question: 'What happens if I connect the battery backwards?',
        answer:
          'Reverse-connection protection disconnects the output; neither charger nor battery is damaged. Reconnect correctly to charge.',
      },
      {
        question: 'Does it work with CAN-enabled batteries?',
        answer:
          'Yes — the CAN bus interface lets a compatible BMS control charge voltage and current. Non-CAN packs charge on the fixed CC-CV profile.',
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Rated battery pack voltage', value: '60 V' },
          { label: 'Max. output voltage', value: '69.35 V' },
          { label: 'Max. output current', value: '12 A' },
          { label: 'Rated power', value: '840 W' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '60V lithium (LFP / Li-ion) packs',
          'Interface: CAN bus compatible; tri-colour LED status; common-fault LED indication',
          'Input: 220 VAC ±15%, ≤ 5 A',
        ],
      },
      {
        kind: 'care',
        items: [
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
        ],
      },
    ],
    media: mediaFor('Charger_TK840W_TK61-12', 'Trontek TK840W charger (TK 61-12)'),
  },

  /* -------------------- Charger · TK840W · TK 64-11 */
  {
    productKey: 'trontek-charger-tk64-11',
    slug: 'trontek-tk840w-charger-tk64-11',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK840W Lithium EV Battery Charger TK 64-11',
    subtitle: 'Lithium-ion battery charger',
    modelName: 'TK 64-11',
    genericName: 'Lithium-ion battery charger',
    productType: 'On-board / off-board charger, CC-CV, active PFC + LLC',
    netQuantity: '1 Count',
    category: 'chargers',
    subcategory: 'ev-chargers',
    art: 'inverter',
    countryOfOrigin: 'India',
    description: [
      "The Trontek TK 64-11 is a 840 W lithium EV battery charger from the TK840W series, rated for 60V packs with a maximum output of 73 V at 11 A. Active PFC and LLC design deliver ≥94% efficiency and ≥0.99 power factor from a 220 VAC ±15% supply, with fast active and passive self-protection on voltage and current. The die-cast, glue-sealed shell and potted cooling fan give an IP66 unit built for on-board or off-board use in Indian conditions. CAN bus lets the charger talk to compatible battery BMS for controlled charging, and it shuts down automatically when the pack is full. Made at Trontek's New Delhi facility.",
    ],
    highlights: [
      'Active PFC and LLC topology — rapid fault response, software and hardware self-protection on voltage and current',
      'Advanced charging strategy acts as a safeguard for the battery system',
      'Integrated die-cast aluminium shell, sealed with special glue; IP66 rated',
      'Long-life potted active cooling fan; proven for 10+ years across wet, hot, cold and high-altitude environments',
      'CAN bus interface and tri-colour status indicator',
      'Burnout, reverse-connection, no-load and short-circuit protection; automatic shut-off when fully charged',
      'Certifications shown: UL, CE, IEC, KC, RCM, TÜV, IP66',
    ],
    boxContents: [],
    careInstructions: null,
    // "[insert Trontek charger warranty]".
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: CHARGER_HSN,
    taxRate: GST,
    facets: { voltage: 60 },
    badges: [],
    popularityRank: 30,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-CHG-TK6411')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Series', value: 'TK840W' },
          { label: 'Model', value: 'TK 64-11' },
          { label: 'Rated battery pack voltage', value: '60 V' },
          { label: 'Max. output voltage', value: '73 V' },
          { label: 'Max. output current', value: '11 A' },
          { label: 'Rated power', value: '840 W' },
          { label: 'AC input voltage range', value: '220 VAC ±15%' },
          { label: 'AC input max. current', value: '≤ 5 A' },
          { label: 'Power factor', value: '≥ 0.99' },
          { label: 'Efficiency', value: '≥ 94%' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
          { label: 'Communication', value: 'CAN bus compatible' },
          { label: 'Indication', value: 'Tri-colour LED; common-fault LED' },
          {
            label: 'Over-temperature',
            value:
              'Power derates above limit; stops and goes to standby above 65°C ambient, resumes when cool',
          },
          {
            label: 'Protections',
            value:
              'Burnout (over-temperature), reverse battery connection, no-load (no output without battery), output short circuit, auto shut-off at full charge',
          },
          { label: 'Enclosure', value: 'Integrated die-cast, glue-sealed; IP66' },
          { label: 'Cooling', value: 'Active fan (potted, long-life)' },
          { label: 'Height', value: '62 ±2 mm' },
          { label: 'Width', value: '126 ±2 mm' },
          { label: 'Length', value: '156 ±2 mm' },
          { label: 'Other models in series', value: 'TK 51-16, TK 61-12, TK 72-10, TK 73-10' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '156 × 126 × 62 mm (±2 mm)' },
          { label: 'In centimetres', value: '15.6 × 12.6 × 6.2 cm' },
          { label: 'Net weight', value: '~2 kg' },
          { label: 'Shipping weight', value: '~6.00 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek TK840W Lithium EV Battery Charger TK 64-11' },
          { label: 'Model name', value: 'TK 64-11' },
          { label: 'Series', value: 'TK840W series (840 W)' },
          {
            label: 'Category',
            value: 'EV Battery Charger / Lithium Battery Charger (2W / 3W / Light EV)',
          },
          { label: 'Generic name', value: 'Lithium-ion battery charger' },
          { label: 'Type', value: 'On-board / off-board charger, CC-CV, active PFC + LLC' },
          { label: 'Suitable for battery pack', value: '60V lithium (LFP / Li-ion) packs' },
          { label: 'Max. output voltage', value: '73 V' },
          { label: 'Max. output current', value: '11 A' },
          { label: 'Input', value: '220 VAC ±15%, ≤ 5 A' },
          {
            label: 'Interface',
            value: 'CAN bus compatible; tri-colour LED status; common-fault LED indication',
          },
          {
            label: 'Applications',
            value:
              'E-rickshaws, e-loaders, e-scooters, golf cars, AGVs, material handling, floor care, mobile elevated platforms, ATV/UTV, aquatic and outdoor power supply',
          },
          { label: 'Colour', value: 'Orange / grey die-cast' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8504 40 (static converters / battery chargers)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which batteries can I charge with this?',
        answer:
          'Any 60V lithium pack (LFP or NMC) whose BMS accepts a 73 V charge voltage and ≥ 11 A charge current. Check the battery datasheet — for LFP packs, 60V nominal usually means 19S / 60.8V, charged at 69.35V. Do not use on lead-acid batteries.',
      },
      {
        question: 'How long will a full charge take?',
        answer:
          'Roughly battery Ah ÷ 11 A plus about 30 minutes for the CV tail. Example: a 105 Ah pack ≈ 10 hours; a 30 Ah pack ≈ 3.2 hours.',
      },
      {
        question: 'Can I leave it connected overnight?',
        answer:
          'Yes. The charger switches off automatically when the pack is full and has no-load protection, so it does not trickle or overcharge.',
      },
      {
        question: 'Is it safe to use outdoors or in the rain?',
        answer:
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
      },
      {
        question: 'What does the LED indicate?',
        answer:
          'Tri-colour status: charging, fully charged, and fault. A common-fault indication flags reverse connection, short circuit or over-temperature — fix the fault and reconnect the battery to resume.',
      },
      {
        question: 'What happens if I connect the battery backwards?',
        answer:
          'Reverse-connection protection disconnects the output; neither charger nor battery is damaged. Reconnect correctly to charge.',
      },
      {
        question: 'Does it work with CAN-enabled batteries?',
        answer:
          'Yes — the CAN bus interface lets a compatible BMS control charge voltage and current. Non-CAN packs charge on the fixed CC-CV profile.',
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Rated battery pack voltage', value: '60 V' },
          { label: 'Max. output voltage', value: '73 V' },
          { label: 'Max. output current', value: '11 A' },
          { label: 'Rated power', value: '840 W' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '60V lithium (LFP / Li-ion) packs',
          'Interface: CAN bus compatible; tri-colour LED status; common-fault LED indication',
          'Input: 220 VAC ±15%, ≤ 5 A',
        ],
      },
      {
        kind: 'care',
        items: [
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
        ],
      },
    ],
    media: mediaFor('Charger_TK840W_TK64-11', 'Trontek TK840W charger (TK 64-11)'),
  },

  /* -------------------- Charger · TK840W · TK 72-10 */
  {
    productKey: 'trontek-charger-tk72-10',
    slug: 'trontek-tk840w-charger-tk72-10',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK840W Lithium EV Battery Charger TK 72-10',
    subtitle: 'Lithium-ion battery charger',
    modelName: 'TK 72-10',
    genericName: 'Lithium-ion battery charger',
    productType: 'On-board / off-board charger, CC-CV, active PFC + LLC',
    netQuantity: '1 Count',
    category: 'chargers',
    subcategory: 'ev-chargers',
    art: 'inverter',
    countryOfOrigin: 'India',
    description: [
      "The Trontek TK 72-10 is a 840 W lithium EV battery charger from the TK840W series, rated for 72V packs with a maximum output of 84 V at 10 A. Active PFC and LLC design deliver ≥94% efficiency and ≥0.99 power factor from a 220 VAC ±15% supply, with fast active and passive self-protection on voltage and current. The die-cast, glue-sealed shell and potted cooling fan give an IP66 unit built for on-board or off-board use in Indian conditions. CAN bus lets the charger talk to compatible battery BMS for controlled charging, and it shuts down automatically when the pack is full. Made at Trontek's New Delhi facility.",
    ],
    highlights: [
      'Active PFC and LLC topology — rapid fault response, software and hardware self-protection on voltage and current',
      'Advanced charging strategy acts as a safeguard for the battery system',
      'Integrated die-cast aluminium shell, sealed with special glue; IP66 rated',
      'Long-life potted active cooling fan; proven for 10+ years across wet, hot, cold and high-altitude environments',
      'CAN bus interface and tri-colour status indicator',
      'Burnout, reverse-connection, no-load and short-circuit protection; automatic shut-off when fully charged',
      'Certifications shown: UL, CE, IEC, KC, RCM, TÜV, IP66',
    ],
    boxContents: [],
    careInstructions: null,
    // "[insert Trontek charger warranty]".
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: CHARGER_HSN,
    taxRate: GST,
    facets: { voltage: 72 },
    badges: [],
    popularityRank: 31,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-CHG-TK7210')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Series', value: 'TK840W' },
          { label: 'Model', value: 'TK 72-10' },
          { label: 'Rated battery pack voltage', value: '72 V' },
          { label: 'Max. output voltage', value: '84 V' },
          { label: 'Max. output current', value: '10 A' },
          { label: 'Rated power', value: '840 W' },
          { label: 'AC input voltage range', value: '220 VAC ±15%' },
          { label: 'AC input max. current', value: '≤ 5 A' },
          { label: 'Power factor', value: '≥ 0.99' },
          { label: 'Efficiency', value: '≥ 94%' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
          { label: 'Communication', value: 'CAN bus compatible' },
          { label: 'Indication', value: 'Tri-colour LED; common-fault LED' },
          {
            label: 'Over-temperature',
            value:
              'Power derates above limit; stops and goes to standby above 65°C ambient, resumes when cool',
          },
          {
            label: 'Protections',
            value:
              'Burnout (over-temperature), reverse battery connection, no-load (no output without battery), output short circuit, auto shut-off at full charge',
          },
          { label: 'Enclosure', value: 'Integrated die-cast, glue-sealed; IP66' },
          { label: 'Cooling', value: 'Active fan (potted, long-life)' },
          { label: 'Height', value: '62 ±2 mm' },
          { label: 'Width', value: '126 ±2 mm' },
          { label: 'Length', value: '156 ±2 mm' },
          { label: 'Other models in series', value: 'TK 51-16, TK 61-12, TK 64-11, TK 73-10' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '156 × 126 × 62 mm (±2 mm)' },
          { label: 'In centimetres', value: '15.6 × 12.6 × 6.2 cm' },
          { label: 'Net weight', value: '~2 kg' },
          { label: 'Shipping weight', value: '~6.00 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek TK840W Lithium EV Battery Charger TK 72-10' },
          { label: 'Model name', value: 'TK 72-10' },
          { label: 'Series', value: 'TK840W series (840 W)' },
          {
            label: 'Category',
            value: 'EV Battery Charger / Lithium Battery Charger (2W / 3W / Light EV)',
          },
          { label: 'Generic name', value: 'Lithium-ion battery charger' },
          { label: 'Type', value: 'On-board / off-board charger, CC-CV, active PFC + LLC' },
          { label: 'Suitable for battery pack', value: '72V lithium (LFP / Li-ion) packs' },
          { label: 'Max. output voltage', value: '84 V' },
          { label: 'Max. output current', value: '10 A' },
          { label: 'Input', value: '220 VAC ±15%, ≤ 5 A' },
          {
            label: 'Interface',
            value: 'CAN bus compatible; tri-colour LED status; common-fault LED indication',
          },
          {
            label: 'Applications',
            value:
              'E-rickshaws, e-loaders, e-scooters, golf cars, AGVs, material handling, floor care, mobile elevated platforms, ATV/UTV, aquatic and outdoor power supply',
          },
          { label: 'Colour', value: 'Orange / grey die-cast' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8504 40 (static converters / battery chargers)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which batteries can I charge with this?',
        answer:
          'Any 72V lithium pack (LFP or NMC) whose BMS accepts a 84 V charge voltage and ≥ 10 A charge current. Check the battery datasheet — for LFP packs, 72V nominal usually means 23S / 73.6V, charged at 83.95V. Do not use on lead-acid batteries.',
      },
      {
        question: 'How long will a full charge take?',
        answer:
          'Roughly battery Ah ÷ 10 A plus about 30 minutes for the CV tail. Example: a 105 Ah pack ≈ 11 hours; a 30 Ah pack ≈ 3.5 hours.',
      },
      {
        question: 'Can I leave it connected overnight?',
        answer:
          'Yes. The charger switches off automatically when the pack is full and has no-load protection, so it does not trickle or overcharge.',
      },
      {
        question: 'Is it safe to use outdoors or in the rain?',
        answer:
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
      },
      {
        question: 'What does the LED indicate?',
        answer:
          'Tri-colour status: charging, fully charged, and fault. A common-fault indication flags reverse connection, short circuit or over-temperature — fix the fault and reconnect the battery to resume.',
      },
      {
        question: 'What happens if I connect the battery backwards?',
        answer:
          'Reverse-connection protection disconnects the output; neither charger nor battery is damaged. Reconnect correctly to charge.',
      },
      {
        question: 'Does it work with CAN-enabled batteries?',
        answer:
          'Yes — the CAN bus interface lets a compatible BMS control charge voltage and current. Non-CAN packs charge on the fixed CC-CV profile.',
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Rated battery pack voltage', value: '72 V' },
          { label: 'Max. output voltage', value: '84 V' },
          { label: 'Max. output current', value: '10 A' },
          { label: 'Rated power', value: '840 W' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '72V lithium (LFP / Li-ion) packs',
          'Interface: CAN bus compatible; tri-colour LED status; common-fault LED indication',
          'Input: 220 VAC ±15%, ≤ 5 A',
        ],
      },
      {
        kind: 'care',
        items: [
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
        ],
      },
    ],
    media: mediaFor('Charger_TK840W_TK72-10', 'Trontek TK840W charger (TK 72-10)'),
  },

  /* -------------------- Charger · TK840W · TK 73-10 */
  {
    productKey: 'trontek-charger-tk73-10',
    slug: 'trontek-tk840w-charger-tk73-10',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK840W Lithium EV Battery Charger TK 73-10',
    subtitle: 'Lithium-ion battery charger',
    modelName: 'TK 73-10',
    genericName: 'Lithium-ion battery charger',
    productType: 'On-board / off-board charger, CC-CV, active PFC + LLC',
    netQuantity: '1 Count',
    category: 'chargers',
    subcategory: 'ev-chargers',
    art: 'inverter',
    countryOfOrigin: 'India',
    description: [
      "The Trontek TK 73-10 is a 840 W lithium EV battery charger from the TK840W series, rated for 72V packs with a maximum output of 83.9 V at 10 A. Active PFC and LLC design deliver ≥94% efficiency and ≥0.99 power factor from a 220 VAC ±15% supply, with fast active and passive self-protection on voltage and current. The die-cast, glue-sealed shell and potted cooling fan give an IP66 unit built for on-board or off-board use in Indian conditions. CAN bus lets the charger talk to compatible battery BMS for controlled charging, and it shuts down automatically when the pack is full. Made at Trontek's New Delhi facility.",
    ],
    highlights: [
      'Active PFC and LLC topology — rapid fault response, software and hardware self-protection on voltage and current',
      'Advanced charging strategy acts as a safeguard for the battery system',
      'Integrated die-cast aluminium shell, sealed with special glue; IP66 rated',
      'Long-life potted active cooling fan; proven for 10+ years across wet, hot, cold and high-altitude environments',
      'CAN bus interface and tri-colour status indicator',
      'Burnout, reverse-connection, no-load and short-circuit protection; automatic shut-off when fully charged',
      'Certifications shown: UL, CE, IEC, KC, RCM, TÜV, IP66',
    ],
    boxContents: [],
    careInstructions: null,
    // "[insert Trontek charger warranty]".
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: CHARGER_HSN,
    taxRate: GST,
    facets: { voltage: 72 },
    badges: [],
    popularityRank: 32,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-CHG-TK7310')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Series', value: 'TK840W' },
          { label: 'Model', value: 'TK 73-10' },
          { label: 'Rated battery pack voltage', value: '72 V' },
          { label: 'Max. output voltage', value: '83.9 V' },
          { label: 'Max. output current', value: '10 A' },
          { label: 'Rated power', value: '840 W' },
          { label: 'AC input voltage range', value: '220 VAC ±15%' },
          { label: 'AC input max. current', value: '≤ 5 A' },
          { label: 'Power factor', value: '≥ 0.99' },
          { label: 'Efficiency', value: '≥ 94%' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
          { label: 'Communication', value: 'CAN bus compatible' },
          { label: 'Indication', value: 'Tri-colour LED; common-fault LED' },
          {
            label: 'Over-temperature',
            value:
              'Power derates above limit; stops and goes to standby above 65°C ambient, resumes when cool',
          },
          {
            label: 'Protections',
            value:
              'Burnout (over-temperature), reverse battery connection, no-load (no output without battery), output short circuit, auto shut-off at full charge',
          },
          { label: 'Enclosure', value: 'Integrated die-cast, glue-sealed; IP66' },
          { label: 'Cooling', value: 'Active fan (potted, long-life)' },
          { label: 'Height', value: '62 ±2 mm' },
          { label: 'Width', value: '126 ±2 mm' },
          { label: 'Length', value: '156 ±2 mm' },
          { label: 'Other models in series', value: 'TK 51-16, TK 61-12, TK 64-11, TK 72-10' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '156 × 126 × 62 mm (±2 mm)' },
          { label: 'In centimetres', value: '15.6 × 12.6 × 6.2 cm' },
          { label: 'Net weight', value: '~2 kg' },
          { label: 'Shipping weight', value: '~6.00 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek TK840W Lithium EV Battery Charger TK 73-10' },
          { label: 'Model name', value: 'TK 73-10' },
          { label: 'Series', value: 'TK840W series (840 W)' },
          {
            label: 'Category',
            value: 'EV Battery Charger / Lithium Battery Charger (2W / 3W / Light EV)',
          },
          { label: 'Generic name', value: 'Lithium-ion battery charger' },
          { label: 'Type', value: 'On-board / off-board charger, CC-CV, active PFC + LLC' },
          { label: 'Suitable for battery pack', value: '72V lithium (LFP / Li-ion) packs' },
          { label: 'Max. output voltage', value: '83.9 V' },
          { label: 'Max. output current', value: '10 A' },
          { label: 'Input', value: '220 VAC ±15%, ≤ 5 A' },
          {
            label: 'Interface',
            value: 'CAN bus compatible; tri-colour LED status; common-fault LED indication',
          },
          {
            label: 'Applications',
            value:
              'E-rickshaws, e-loaders, e-scooters, golf cars, AGVs, material handling, floor care, mobile elevated platforms, ATV/UTV, aquatic and outdoor power supply',
          },
          { label: 'Colour', value: 'Orange / grey die-cast' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8504 40 (static converters / battery chargers)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which batteries can I charge with this?',
        answer:
          'Any 72V lithium pack (LFP or NMC) whose BMS accepts a 83.9 V charge voltage and ≥ 10 A charge current. Check the battery datasheet — for LFP packs, 72V nominal usually means 23S / 73.6V, charged at 83.95V. Do not use on lead-acid batteries.',
      },
      {
        question: 'How long will a full charge take?',
        answer:
          'Roughly battery Ah ÷ 10 A plus about 30 minutes for the CV tail. Example: a 105 Ah pack ≈ 11 hours; a 30 Ah pack ≈ 3.5 hours.',
      },
      {
        question: 'Can I leave it connected overnight?',
        answer:
          'Yes. The charger switches off automatically when the pack is full and has no-load protection, so it does not trickle or overcharge.',
      },
      {
        question: 'Is it safe to use outdoors or in the rain?',
        answer:
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
      },
      {
        question: 'What does the LED indicate?',
        answer:
          'Tri-colour status: charging, fully charged, and fault. A common-fault indication flags reverse connection, short circuit or over-temperature — fix the fault and reconnect the battery to resume.',
      },
      {
        question: 'What happens if I connect the battery backwards?',
        answer:
          'Reverse-connection protection disconnects the output; neither charger nor battery is damaged. Reconnect correctly to charge.',
      },
      {
        question: 'Does it work with CAN-enabled batteries?',
        answer:
          'Yes — the CAN bus interface lets a compatible BMS control charge voltage and current. Non-CAN packs charge on the fixed CC-CV profile.',
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Rated battery pack voltage', value: '72 V' },
          { label: 'Max. output voltage', value: '83.9 V' },
          { label: 'Max. output current', value: '10 A' },
          { label: 'Rated power', value: '840 W' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '72V lithium (LFP / Li-ion) packs',
          'Interface: CAN bus compatible; tri-colour LED status; common-fault LED indication',
          'Input: 220 VAC ±15%, ≤ 5 A',
        ],
      },
      {
        kind: 'care',
        items: [
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
        ],
      },
    ],
    media: mediaFor('Charger_TK840W_TK73-10', 'Trontek TK840W charger (TK 73-10)'),
  },

  // Section 2 prints the width as "125 ±2 mm *", footnoted "Catalogue prints width as 25 mm —
  // clearly a typo; 125 mm assumed, confirm with Trontek". The marker is dropped; 125 mm is what
  // section 6 states too.
  /* -------------------- Charger · TK1350W · TK 51-26 */
  {
    productKey: 'trontek-charger-tk51-26',
    slug: 'trontek-tk1350w-charger-tk51-26',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK1350W Lithium EV Battery Charger TK 51-26',
    subtitle: 'Lithium-ion battery charger',
    modelName: 'TK 51-26',
    genericName: 'Lithium-ion battery charger',
    productType: 'On-board / off-board charger, CC-CV, active PFC + LLC',
    netQuantity: '1 Count',
    category: 'chargers',
    subcategory: 'ev-chargers',
    art: 'inverter',
    countryOfOrigin: 'India',
    description: [
      "The Trontek TK 51-26 is a 1350 W lithium EV battery charger from the TK1350W series, rated for 48V packs with a maximum output of 58.4 V at 25 A. Active PFC and LLC design deliver ≥94% efficiency and ≥0.99 power factor from a 220 VAC ±15% supply, with fast active and passive self-protection on voltage and current. The die-cast, glue-sealed shell and potted cooling fan give an IP66 unit built for on-board or off-board use in Indian conditions. CAN bus lets the charger talk to compatible battery BMS for controlled charging, and it shuts down automatically when the pack is full. Made at Trontek's New Delhi facility.",
    ],
    highlights: [
      'Active PFC and LLC topology — rapid fault response, software and hardware self-protection on voltage and current',
      'Advanced charging strategy acts as a safeguard for the battery system',
      'Integrated die-cast aluminium shell, sealed with special glue; IP66 rated',
      'Long-life potted active cooling fan; proven for 10+ years across wet, hot, cold and high-altitude environments',
      'CAN bus interface and tri-colour status indicator',
      'Burnout, reverse-connection, no-load and short-circuit protection; automatic shut-off when fully charged',
      'Certifications shown: UL, CE, IEC, KC, RCM, TÜV, IP66',
    ],
    boxContents: [],
    careInstructions: null,
    // "[insert Trontek charger warranty]".
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: CHARGER_HSN,
    taxRate: GST,
    facets: { voltage: 48 },
    badges: [],
    popularityRank: 33,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-CHG-TK5126')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Series', value: 'TK1350W' },
          { label: 'Model', value: 'TK 51-26' },
          { label: 'Rated battery pack voltage', value: '48 V' },
          { label: 'Max. output voltage', value: '58.4 V' },
          { label: 'Max. output current', value: '25 A' },
          { label: 'Rated power', value: '1350 W' },
          { label: 'AC input voltage range', value: '220 VAC ±15%' },
          { label: 'AC input max. current', value: '≤ 7.5 A' },
          { label: 'Power factor', value: '≥ 0.99' },
          { label: 'Efficiency', value: '≥ 94%' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
          { label: 'Communication', value: 'CAN bus compatible' },
          { label: 'Indication', value: 'Tri-colour LED; common-fault LED' },
          {
            label: 'Over-temperature',
            value:
              'Power derates above limit; stops and goes to standby above 65°C ambient, resumes when cool',
          },
          {
            label: 'Protections',
            value:
              'Burnout (over-temperature), reverse battery connection, no-load (no output without battery), output short circuit, auto shut-off at full charge',
          },
          { label: 'Enclosure', value: 'Integrated die-cast, glue-sealed; IP66' },
          { label: 'Cooling', value: 'Active fan (potted, long-life)' },
          { label: 'Height', value: '72 ±2 mm' },
          { label: 'Width', value: '125 ±2 mm' },
          { label: 'Length', value: '228 ±2 mm' },
          { label: 'Other models in series', value: 'TK 61-20, TK 73-16' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '228 × 125 × 72 mm (±2 mm)' },
          { label: 'In centimetres', value: '22.8 × 12.5 × 7.2 cm' },
          { label: 'Net weight', value: '~2.7 kg' },
          { label: 'Shipping weight', value: '~6.70 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek TK1350W Lithium EV Battery Charger TK 51-26' },
          { label: 'Model name', value: 'TK 51-26' },
          { label: 'Series', value: 'TK1350W series (1350 W)' },
          {
            label: 'Category',
            value: 'EV Battery Charger / Lithium Battery Charger (2W / 3W / Light EV)',
          },
          { label: 'Generic name', value: 'Lithium-ion battery charger' },
          { label: 'Type', value: 'On-board / off-board charger, CC-CV, active PFC + LLC' },
          { label: 'Suitable for battery pack', value: '48V lithium (LFP / Li-ion) packs' },
          { label: 'Max. output voltage', value: '58.4 V' },
          { label: 'Max. output current', value: '25 A' },
          { label: 'Input', value: '220 VAC ±15%, ≤ 7.5 A' },
          {
            label: 'Interface',
            value: 'CAN bus compatible; tri-colour LED status; common-fault LED indication',
          },
          {
            label: 'Applications',
            value:
              'E-rickshaws, e-loaders, e-scooters, golf cars, AGVs, material handling, floor care, mobile elevated platforms, ATV/UTV, aquatic and outdoor power supply',
          },
          { label: 'Colour', value: 'Orange / grey die-cast' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8504 40 (static converters / battery chargers)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which batteries can I charge with this?',
        answer:
          'Any 48V lithium pack (LFP or NMC) whose BMS accepts a 58.4 V charge voltage and ≥ 25 A charge current. Check the battery datasheet — for LFP packs, 48V nominal usually means 16S / 51.2V, charged at 58.4V. Do not use on lead-acid batteries.',
      },
      {
        question: 'How long will a full charge take?',
        answer:
          'Roughly battery Ah ÷ 25 A plus about 30 minutes for the CV tail. Example: a 105 Ah pack ≈ 4.7 hours; a 30 Ah pack ≈ 1.7 hours.',
      },
      {
        question: 'Can I leave it connected overnight?',
        answer:
          'Yes. The charger switches off automatically when the pack is full and has no-load protection, so it does not trickle or overcharge.',
      },
      {
        question: 'Is it safe to use outdoors or in the rain?',
        answer:
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
      },
      {
        question: 'What does the LED indicate?',
        answer:
          'Tri-colour status: charging, fully charged, and fault. A common-fault indication flags reverse connection, short circuit or over-temperature — fix the fault and reconnect the battery to resume.',
      },
      {
        question: 'What happens if I connect the battery backwards?',
        answer:
          'Reverse-connection protection disconnects the output; neither charger nor battery is damaged. Reconnect correctly to charge.',
      },
      {
        question: 'Does it work with CAN-enabled batteries?',
        answer:
          'Yes — the CAN bus interface lets a compatible BMS control charge voltage and current. Non-CAN packs charge on the fixed CC-CV profile.',
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Rated battery pack voltage', value: '48 V' },
          { label: 'Max. output voltage', value: '58.4 V' },
          { label: 'Max. output current', value: '25 A' },
          { label: 'Rated power', value: '1350 W' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '48V lithium (LFP / Li-ion) packs',
          'Interface: CAN bus compatible; tri-colour LED status; common-fault LED indication',
          'Input: 220 VAC ±15%, ≤ 7.5 A',
        ],
      },
      {
        kind: 'care',
        items: [
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
        ],
      },
    ],
    media: mediaFor('Charger_TK1350W_TK51-26', 'Trontek TK1350W charger (TK 51-26)'),
  },

  // Section 2 prints the width as "125 ±2 mm *", footnoted "Catalogue prints width as 25 mm —
  // clearly a typo; 125 mm assumed, confirm with Trontek". The marker is dropped; 125 mm is what
  // section 6 states too.
  /* -------------------- Charger · TK1350W · TK 61-20 */
  {
    productKey: 'trontek-charger-tk61-20',
    slug: 'trontek-tk1350w-charger-tk61-20',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK1350W Lithium EV Battery Charger TK 61-20',
    subtitle: 'Lithium-ion battery charger',
    modelName: 'TK 61-20',
    genericName: 'Lithium-ion battery charger',
    productType: 'On-board / off-board charger, CC-CV, active PFC + LLC',
    netQuantity: '1 Count',
    category: 'chargers',
    subcategory: 'ev-chargers',
    art: 'inverter',
    countryOfOrigin: 'India',
    description: [
      "The Trontek TK 61-20 is a 1350 W lithium EV battery charger from the TK1350W series, rated for 60V packs with a maximum output of 69.35 V at 20 A. Active PFC and LLC design deliver ≥94% efficiency and ≥0.99 power factor from a 220 VAC ±15% supply, with fast active and passive self-protection on voltage and current. The die-cast, glue-sealed shell and potted cooling fan give an IP66 unit built for on-board or off-board use in Indian conditions. CAN bus lets the charger talk to compatible battery BMS for controlled charging, and it shuts down automatically when the pack is full. Made at Trontek's New Delhi facility.",
    ],
    highlights: [
      'Active PFC and LLC topology — rapid fault response, software and hardware self-protection on voltage and current',
      'Advanced charging strategy acts as a safeguard for the battery system',
      'Integrated die-cast aluminium shell, sealed with special glue; IP66 rated',
      'Long-life potted active cooling fan; proven for 10+ years across wet, hot, cold and high-altitude environments',
      'CAN bus interface and tri-colour status indicator',
      'Burnout, reverse-connection, no-load and short-circuit protection; automatic shut-off when fully charged',
      'Certifications shown: UL, CE, IEC, KC, RCM, TÜV, IP66',
    ],
    boxContents: [],
    careInstructions: null,
    // "[insert Trontek charger warranty]".
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: CHARGER_HSN,
    taxRate: GST,
    facets: { voltage: 60 },
    badges: [],
    popularityRank: 34,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-CHG-TK6120')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Series', value: 'TK1350W' },
          { label: 'Model', value: 'TK 61-20' },
          { label: 'Rated battery pack voltage', value: '60 V' },
          { label: 'Max. output voltage', value: '69.35 V' },
          { label: 'Max. output current', value: '20 A' },
          { label: 'Rated power', value: '1350 W' },
          { label: 'AC input voltage range', value: '220 VAC ±15%' },
          { label: 'AC input max. current', value: '≤ 7.5 A' },
          { label: 'Power factor', value: '≥ 0.99' },
          { label: 'Efficiency', value: '≥ 94%' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
          { label: 'Communication', value: 'CAN bus compatible' },
          { label: 'Indication', value: 'Tri-colour LED; common-fault LED' },
          {
            label: 'Over-temperature',
            value:
              'Power derates above limit; stops and goes to standby above 65°C ambient, resumes when cool',
          },
          {
            label: 'Protections',
            value:
              'Burnout (over-temperature), reverse battery connection, no-load (no output without battery), output short circuit, auto shut-off at full charge',
          },
          { label: 'Enclosure', value: 'Integrated die-cast, glue-sealed; IP66' },
          { label: 'Cooling', value: 'Active fan (potted, long-life)' },
          { label: 'Height', value: '72 ±2 mm' },
          { label: 'Width', value: '125 ±2 mm' },
          { label: 'Length', value: '228 ±2 mm' },
          { label: 'Other models in series', value: 'TK 51-26, TK 73-16' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '228 × 125 × 72 mm (±2 mm)' },
          { label: 'In centimetres', value: '22.8 × 12.5 × 7.2 cm' },
          { label: 'Net weight', value: '~2.7 kg' },
          { label: 'Shipping weight', value: '~6.70 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek TK1350W Lithium EV Battery Charger TK 61-20' },
          { label: 'Model name', value: 'TK 61-20' },
          { label: 'Series', value: 'TK1350W series (1350 W)' },
          {
            label: 'Category',
            value: 'EV Battery Charger / Lithium Battery Charger (2W / 3W / Light EV)',
          },
          { label: 'Generic name', value: 'Lithium-ion battery charger' },
          { label: 'Type', value: 'On-board / off-board charger, CC-CV, active PFC + LLC' },
          { label: 'Suitable for battery pack', value: '60V lithium (LFP / Li-ion) packs' },
          { label: 'Max. output voltage', value: '69.35 V' },
          { label: 'Max. output current', value: '20 A' },
          { label: 'Input', value: '220 VAC ±15%, ≤ 7.5 A' },
          {
            label: 'Interface',
            value: 'CAN bus compatible; tri-colour LED status; common-fault LED indication',
          },
          {
            label: 'Applications',
            value:
              'E-rickshaws, e-loaders, e-scooters, golf cars, AGVs, material handling, floor care, mobile elevated platforms, ATV/UTV, aquatic and outdoor power supply',
          },
          { label: 'Colour', value: 'Orange / grey die-cast' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8504 40 (static converters / battery chargers)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which batteries can I charge with this?',
        answer:
          'Any 60V lithium pack (LFP or NMC) whose BMS accepts a 69.35 V charge voltage and ≥ 20 A charge current. Check the battery datasheet — for LFP packs, 60V nominal usually means 19S / 60.8V, charged at 69.35V. Do not use on lead-acid batteries.',
      },
      {
        question: 'How long will a full charge take?',
        answer:
          'Roughly battery Ah ÷ 20 A plus about 30 minutes for the CV tail. Example: a 105 Ah pack ≈ 5.8 hours; a 30 Ah pack ≈ 2 hours.',
      },
      {
        question: 'Can I leave it connected overnight?',
        answer:
          'Yes. The charger switches off automatically when the pack is full and has no-load protection, so it does not trickle or overcharge.',
      },
      {
        question: 'Is it safe to use outdoors or in the rain?',
        answer:
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
      },
      {
        question: 'What does the LED indicate?',
        answer:
          'Tri-colour status: charging, fully charged, and fault. A common-fault indication flags reverse connection, short circuit or over-temperature — fix the fault and reconnect the battery to resume.',
      },
      {
        question: 'What happens if I connect the battery backwards?',
        answer:
          'Reverse-connection protection disconnects the output; neither charger nor battery is damaged. Reconnect correctly to charge.',
      },
      {
        question: 'Does it work with CAN-enabled batteries?',
        answer:
          'Yes — the CAN bus interface lets a compatible BMS control charge voltage and current. Non-CAN packs charge on the fixed CC-CV profile.',
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Rated battery pack voltage', value: '60 V' },
          { label: 'Max. output voltage', value: '69.35 V' },
          { label: 'Max. output current', value: '20 A' },
          { label: 'Rated power', value: '1350 W' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '60V lithium (LFP / Li-ion) packs',
          'Interface: CAN bus compatible; tri-colour LED status; common-fault LED indication',
          'Input: 220 VAC ±15%, ≤ 7.5 A',
        ],
      },
      {
        kind: 'care',
        items: [
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
        ],
      },
    ],
    media: mediaFor('Charger_TK1350W_TK61-20', 'Trontek TK1350W charger (TK 61-20)'),
  },

  // Section 2 prints the width as "125 ±2 mm *", footnoted "Catalogue prints width as 25 mm —
  // clearly a typo; 125 mm assumed, confirm with Trontek". The marker is dropped; 125 mm is what
  // section 6 states too.
  /* -------------------- Charger · TK1350W · TK 73-16 */
  {
    productKey: 'trontek-charger-tk73-16',
    slug: 'trontek-tk1350w-charger-tk73-16',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK1350W Lithium EV Battery Charger TK 73-16',
    subtitle: 'Lithium-ion battery charger',
    modelName: 'TK 73-16',
    genericName: 'Lithium-ion battery charger',
    productType: 'On-board / off-board charger, CC-CV, active PFC + LLC',
    netQuantity: '1 Count',
    category: 'chargers',
    subcategory: 'ev-chargers',
    art: 'inverter',
    countryOfOrigin: 'India',
    description: [
      "The Trontek TK 73-16 is a 1350 W lithium EV battery charger from the TK1350W series, rated for 72V packs with a maximum output of 83.95 V at 16 A. Active PFC and LLC design deliver ≥94% efficiency and ≥0.99 power factor from a 220 VAC ±15% supply, with fast active and passive self-protection on voltage and current. The die-cast, glue-sealed shell and potted cooling fan give an IP66 unit built for on-board or off-board use in Indian conditions. CAN bus lets the charger talk to compatible battery BMS for controlled charging, and it shuts down automatically when the pack is full. Made at Trontek's New Delhi facility.",
    ],
    highlights: [
      'Active PFC and LLC topology — rapid fault response, software and hardware self-protection on voltage and current',
      'Advanced charging strategy acts as a safeguard for the battery system',
      'Integrated die-cast aluminium shell, sealed with special glue; IP66 rated',
      'Long-life potted active cooling fan; proven for 10+ years across wet, hot, cold and high-altitude environments',
      'CAN bus interface and tri-colour status indicator',
      'Burnout, reverse-connection, no-load and short-circuit protection; automatic shut-off when fully charged',
      'Certifications shown: UL, CE, IEC, KC, RCM, TÜV, IP66',
    ],
    boxContents: [],
    careInstructions: null,
    // "[insert Trontek charger warranty]".
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: CHARGER_HSN,
    taxRate: GST,
    facets: { voltage: 72 },
    badges: [],
    popularityRank: 35,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-CHG-TK7316')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Series', value: 'TK1350W' },
          { label: 'Model', value: 'TK 73-16' },
          { label: 'Rated battery pack voltage', value: '72 V' },
          { label: 'Max. output voltage', value: '83.95 V' },
          { label: 'Max. output current', value: '16 A' },
          { label: 'Rated power', value: '1350 W' },
          { label: 'AC input voltage range', value: '220 VAC ±15%' },
          { label: 'AC input max. current', value: '≤ 7.5 A' },
          { label: 'Power factor', value: '≥ 0.99' },
          { label: 'Efficiency', value: '≥ 94%' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
          { label: 'Communication', value: 'CAN bus compatible' },
          { label: 'Indication', value: 'Tri-colour LED; common-fault LED' },
          {
            label: 'Over-temperature',
            value:
              'Power derates above limit; stops and goes to standby above 65°C ambient, resumes when cool',
          },
          {
            label: 'Protections',
            value:
              'Burnout (over-temperature), reverse battery connection, no-load (no output without battery), output short circuit, auto shut-off at full charge',
          },
          { label: 'Enclosure', value: 'Integrated die-cast, glue-sealed; IP66' },
          { label: 'Cooling', value: 'Active fan (potted, long-life)' },
          { label: 'Height', value: '72 ±2 mm' },
          { label: 'Width', value: '125 ±2 mm' },
          { label: 'Length', value: '228 ±2 mm' },
          { label: 'Other models in series', value: 'TK 51-26, TK 61-20' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '228 × 125 × 72 mm (±2 mm)' },
          { label: 'In centimetres', value: '22.8 × 12.5 × 7.2 cm' },
          { label: 'Net weight', value: '~2.7 kg' },
          { label: 'Shipping weight', value: '~6.70 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek TK1350W Lithium EV Battery Charger TK 73-16' },
          { label: 'Model name', value: 'TK 73-16' },
          { label: 'Series', value: 'TK1350W series (1350 W)' },
          {
            label: 'Category',
            value: 'EV Battery Charger / Lithium Battery Charger (2W / 3W / Light EV)',
          },
          { label: 'Generic name', value: 'Lithium-ion battery charger' },
          { label: 'Type', value: 'On-board / off-board charger, CC-CV, active PFC + LLC' },
          { label: 'Suitable for battery pack', value: '72V lithium (LFP / Li-ion) packs' },
          { label: 'Max. output voltage', value: '83.95 V' },
          { label: 'Max. output current', value: '16 A' },
          { label: 'Input', value: '220 VAC ±15%, ≤ 7.5 A' },
          {
            label: 'Interface',
            value: 'CAN bus compatible; tri-colour LED status; common-fault LED indication',
          },
          {
            label: 'Applications',
            value:
              'E-rickshaws, e-loaders, e-scooters, golf cars, AGVs, material handling, floor care, mobile elevated platforms, ATV/UTV, aquatic and outdoor power supply',
          },
          { label: 'Colour', value: 'Orange / grey die-cast' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8504 40 (static converters / battery chargers)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which batteries can I charge with this?',
        answer:
          'Any 72V lithium pack (LFP or NMC) whose BMS accepts a 83.95 V charge voltage and ≥ 16 A charge current. Check the battery datasheet — for LFP packs, 72V nominal usually means 23S / 73.6V, charged at 83.95V. Do not use on lead-acid batteries.',
      },
      {
        question: 'How long will a full charge take?',
        answer:
          'Roughly battery Ah ÷ 16 A plus about 30 minutes for the CV tail. Example: a 105 Ah pack ≈ 7.1 hours; a 30 Ah pack ≈ 2.4 hours.',
      },
      {
        question: 'Can I leave it connected overnight?',
        answer:
          'Yes. The charger switches off automatically when the pack is full and has no-load protection, so it does not trickle or overcharge.',
      },
      {
        question: 'Is it safe to use outdoors or in the rain?',
        answer:
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
      },
      {
        question: 'What does the LED indicate?',
        answer:
          'Tri-colour status: charging, fully charged, and fault. A common-fault indication flags reverse connection, short circuit or over-temperature — fix the fault and reconnect the battery to resume.',
      },
      {
        question: 'What happens if I connect the battery backwards?',
        answer:
          'Reverse-connection protection disconnects the output; neither charger nor battery is damaged. Reconnect correctly to charge.',
      },
      {
        question: 'Does it work with CAN-enabled batteries?',
        answer:
          'Yes — the CAN bus interface lets a compatible BMS control charge voltage and current. Non-CAN packs charge on the fixed CC-CV profile.',
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Rated battery pack voltage', value: '72 V' },
          { label: 'Max. output voltage', value: '83.95 V' },
          { label: 'Max. output current', value: '16 A' },
          { label: 'Rated power', value: '1350 W' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '72V lithium (LFP / Li-ion) packs',
          'Interface: CAN bus compatible; tri-colour LED status; common-fault LED indication',
          'Input: 220 VAC ±15%, ≤ 7.5 A',
        ],
      },
      {
        kind: 'care',
        items: [
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
        ],
      },
    ],
    media: mediaFor('Charger_TK1350W_TK73-16', 'Trontek TK1350W charger (TK 73-16)'),
  },

  /* -------------------- Charger · TK2000W · TK 48-35 */
  {
    productKey: 'trontek-charger-tk48-35',
    slug: 'trontek-tk2000w-charger-tk48-35',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK2000W Lithium EV Battery Charger TK 48-35',
    subtitle: 'Lithium-ion battery charger',
    modelName: 'TK 48-35',
    genericName: 'Lithium-ion battery charger',
    productType: 'On-board / off-board charger, CC-CV, active PFC + LLC',
    netQuantity: '1 Count',
    category: 'chargers',
    subcategory: 'ev-chargers',
    art: 'inverter',
    countryOfOrigin: 'India',
    description: [
      "The Trontek TK 48-35 is a 2000 W lithium EV battery charger from the TK2000W series, rated for 48V packs with a maximum output of 60 V at 35 A. Active PFC and LLC design deliver ≥94% efficiency and ≥0.99 power factor from a 220 VAC ±15% supply, with fast active and passive self-protection on voltage and current. The die-cast, glue-sealed shell and potted cooling fan give an IP66 unit built for on-board or off-board use in Indian conditions. CAN bus lets the charger talk to compatible battery BMS for controlled charging, and it shuts down automatically when the pack is full. Made at Trontek's New Delhi facility.",
    ],
    highlights: [
      'Active PFC and LLC topology — rapid fault response, software and hardware self-protection on voltage and current',
      'Advanced charging strategy acts as a safeguard for the battery system',
      'Integrated die-cast aluminium shell, sealed with special glue; IP66 rated',
      'Long-life potted active cooling fan; proven for 10+ years across wet, hot, cold and high-altitude environments',
      'CAN bus interface and tri-colour status indicator',
      'Burnout, reverse-connection, no-load and short-circuit protection; automatic shut-off when fully charged',
      'Certifications shown: UL, CE, IEC, KC, RCM, TÜV, IP66',
    ],
    boxContents: [],
    careInstructions: null,
    // "[insert Trontek charger warranty]".
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: CHARGER_HSN,
    taxRate: GST,
    facets: { voltage: 48 },
    badges: [],
    popularityRank: 36,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-CHG-TK4835')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Series', value: 'TK2000W' },
          { label: 'Model', value: 'TK 48-35' },
          { label: 'Rated battery pack voltage', value: '48 V' },
          { label: 'Max. output voltage', value: '60 V' },
          { label: 'Max. output current', value: '35 A' },
          { label: 'Rated power', value: '2000 W' },
          { label: 'AC input voltage range', value: '220 VAC ±15%' },
          { label: 'AC input max. current', value: '≤ 7.5 A' },
          { label: 'Power factor', value: '≥ 0.99' },
          { label: 'Efficiency', value: '≥ 94%' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
          { label: 'Communication', value: 'CAN bus compatible' },
          { label: 'Indication', value: 'Tri-colour LED; common-fault LED' },
          {
            label: 'Over-temperature',
            value:
              'Power derates above limit; stops and goes to standby above 65°C ambient, resumes when cool',
          },
          {
            label: 'Protections',
            value:
              'Burnout (over-temperature), reverse battery connection, no-load (no output without battery), output short circuit, auto shut-off at full charge',
          },
          { label: 'Enclosure', value: 'Integrated die-cast, glue-sealed; IP66' },
          { label: 'Cooling', value: 'Active fan (potted, long-life)' },
          { label: 'Height', value: '90 ±2 mm' },
          { label: 'Width', value: '160 ±2 mm' },
          { label: 'Length', value: '253 ±2 mm' },
          { label: 'Other models in series', value: 'TK 61-30, TK 72-25' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '253 × 160 × 90 mm (±2 mm)' },
          { label: 'In centimetres', value: '25.3 × 16.0 × 9.0 cm' },
          { label: 'Net weight', value: '~3.7 kg' },
          { label: 'Shipping weight', value: '~7.70 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek TK2000W Lithium EV Battery Charger TK 48-35' },
          { label: 'Model name', value: 'TK 48-35' },
          { label: 'Series', value: 'TK2000W series (2000 W)' },
          {
            label: 'Category',
            value: 'EV Battery Charger / Lithium Battery Charger (2W / 3W / Light EV)',
          },
          { label: 'Generic name', value: 'Lithium-ion battery charger' },
          { label: 'Type', value: 'On-board / off-board charger, CC-CV, active PFC + LLC' },
          { label: 'Suitable for battery pack', value: '48V lithium (LFP / Li-ion) packs' },
          { label: 'Max. output voltage', value: '60 V' },
          { label: 'Max. output current', value: '35 A' },
          { label: 'Input', value: '220 VAC ±15%, ≤ 7.5 A' },
          {
            label: 'Interface',
            value: 'CAN bus compatible; tri-colour LED status; common-fault LED indication',
          },
          {
            label: 'Applications',
            value:
              'E-rickshaws, e-loaders, e-scooters, golf cars, AGVs, material handling, floor care, mobile elevated platforms, ATV/UTV, aquatic and outdoor power supply',
          },
          { label: 'Colour', value: 'Grey die-cast' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8504 40 (static converters / battery chargers)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which batteries can I charge with this?',
        answer:
          'Any 48V lithium pack (LFP or NMC) whose BMS accepts a 60 V charge voltage and ≥ 35 A charge current. Check the battery datasheet — for LFP packs, 48V nominal usually means 16S / 51.2V, charged at 58.4V. Do not use on lead-acid batteries.',
      },
      {
        question: 'How long will a full charge take?',
        answer:
          'Roughly battery Ah ÷ 35 A plus about 30 minutes for the CV tail. Example: a 105 Ah pack ≈ 3.5 hours; a 30 Ah pack ≈ 1.4 hours.',
      },
      {
        question: 'Can I leave it connected overnight?',
        answer:
          'Yes. The charger switches off automatically when the pack is full and has no-load protection, so it does not trickle or overcharge.',
      },
      {
        question: 'Is it safe to use outdoors or in the rain?',
        answer:
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
      },
      {
        question: 'What does the LED indicate?',
        answer:
          'Tri-colour status: charging, fully charged, and fault. A common-fault indication flags reverse connection, short circuit or over-temperature — fix the fault and reconnect the battery to resume.',
      },
      {
        question: 'What happens if I connect the battery backwards?',
        answer:
          'Reverse-connection protection disconnects the output; neither charger nor battery is damaged. Reconnect correctly to charge.',
      },
      {
        question: 'Does it work with CAN-enabled batteries?',
        answer:
          'Yes — the CAN bus interface lets a compatible BMS control charge voltage and current. Non-CAN packs charge on the fixed CC-CV profile.',
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Rated battery pack voltage', value: '48 V' },
          { label: 'Max. output voltage', value: '60 V' },
          { label: 'Max. output current', value: '35 A' },
          { label: 'Rated power', value: '2000 W' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '48V lithium (LFP / Li-ion) packs',
          'Interface: CAN bus compatible; tri-colour LED status; common-fault LED indication',
          'Input: 220 VAC ±15%, ≤ 7.5 A',
        ],
      },
      {
        kind: 'care',
        items: [
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
        ],
      },
    ],
    media: mediaFor('Charger_TK2000W_TK48-35', 'Trontek TK2000W charger (TK 48-35)'),
  },

  /* -------------------- Charger · TK2000W · TK 61-30 */
  {
    productKey: 'trontek-charger-tk61-30',
    slug: 'trontek-tk2000w-charger-tk61-30',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK2000W Lithium EV Battery Charger TK 61-30',
    subtitle: 'Lithium-ion battery charger',
    modelName: 'TK 61-30',
    genericName: 'Lithium-ion battery charger',
    productType: 'On-board / off-board charger, CC-CV, active PFC + LLC',
    netQuantity: '1 Count',
    category: 'chargers',
    subcategory: 'ev-chargers',
    art: 'inverter',
    countryOfOrigin: 'India',
    description: [
      "The Trontek TK 61-30 is a 2000 W lithium EV battery charger from the TK2000W series, rated for 61V packs with a maximum output of 70 V at 30 A. Active PFC and LLC design deliver ≥94% efficiency and ≥0.99 power factor from a 220 VAC ±15% supply, with fast active and passive self-protection on voltage and current. The die-cast, glue-sealed shell and potted cooling fan give an IP66 unit built for on-board or off-board use in Indian conditions. CAN bus lets the charger talk to compatible battery BMS for controlled charging, and it shuts down automatically when the pack is full. Made at Trontek's New Delhi facility.",
    ],
    highlights: [
      'Active PFC and LLC topology — rapid fault response, software and hardware self-protection on voltage and current',
      'Advanced charging strategy acts as a safeguard for the battery system',
      'Integrated die-cast aluminium shell, sealed with special glue; IP66 rated',
      'Long-life potted active cooling fan; proven for 10+ years across wet, hot, cold and high-altitude environments',
      'CAN bus interface and tri-colour status indicator',
      'Burnout, reverse-connection, no-load and short-circuit protection; automatic shut-off when fully charged',
      'Certifications shown: UL, CE, IEC, KC, RCM, TÜV, IP66',
    ],
    boxContents: [],
    careInstructions: null,
    // "[insert Trontek charger warranty]".
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: CHARGER_HSN,
    taxRate: GST,
    facets: { voltage: 61 },
    badges: [],
    popularityRank: 37,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-CHG-TK6130')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Series', value: 'TK2000W' },
          { label: 'Model', value: 'TK 61-30' },
          { label: 'Rated battery pack voltage', value: '61 V' },
          { label: 'Max. output voltage', value: '70 V' },
          { label: 'Max. output current', value: '30 A' },
          { label: 'Rated power', value: '2000 W' },
          { label: 'AC input voltage range', value: '220 VAC ±15%' },
          { label: 'AC input max. current', value: '≤ 7.5 A' },
          { label: 'Power factor', value: '≥ 0.99' },
          { label: 'Efficiency', value: '≥ 94%' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
          { label: 'Communication', value: 'CAN bus compatible' },
          { label: 'Indication', value: 'Tri-colour LED; common-fault LED' },
          {
            label: 'Over-temperature',
            value:
              'Power derates above limit; stops and goes to standby above 65°C ambient, resumes when cool',
          },
          {
            label: 'Protections',
            value:
              'Burnout (over-temperature), reverse battery connection, no-load (no output without battery), output short circuit, auto shut-off at full charge',
          },
          { label: 'Enclosure', value: 'Integrated die-cast, glue-sealed; IP66' },
          { label: 'Cooling', value: 'Active fan (potted, long-life)' },
          { label: 'Height', value: '90 ±2 mm' },
          { label: 'Width', value: '160 ±2 mm' },
          { label: 'Length', value: '253 ±2 mm' },
          { label: 'Other models in series', value: 'TK 48-35, TK 72-25' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '253 × 160 × 90 mm (±2 mm)' },
          { label: 'In centimetres', value: '25.3 × 16.0 × 9.0 cm' },
          { label: 'Net weight', value: '~3.7 kg' },
          { label: 'Shipping weight', value: '~7.70 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek TK2000W Lithium EV Battery Charger TK 61-30' },
          { label: 'Model name', value: 'TK 61-30' },
          { label: 'Series', value: 'TK2000W series (2000 W)' },
          {
            label: 'Category',
            value: 'EV Battery Charger / Lithium Battery Charger (2W / 3W / Light EV)',
          },
          { label: 'Generic name', value: 'Lithium-ion battery charger' },
          { label: 'Type', value: 'On-board / off-board charger, CC-CV, active PFC + LLC' },
          { label: 'Suitable for battery pack', value: '61V lithium (LFP / Li-ion) packs' },
          { label: 'Max. output voltage', value: '70 V' },
          { label: 'Max. output current', value: '30 A' },
          { label: 'Input', value: '220 VAC ±15%, ≤ 7.5 A' },
          {
            label: 'Interface',
            value: 'CAN bus compatible; tri-colour LED status; common-fault LED indication',
          },
          {
            label: 'Applications',
            value:
              'E-rickshaws, e-loaders, e-scooters, golf cars, AGVs, material handling, floor care, mobile elevated platforms, ATV/UTV, aquatic and outdoor power supply',
          },
          { label: 'Colour', value: 'Grey die-cast' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8504 40 (static converters / battery chargers)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which batteries can I charge with this?',
        answer:
          'Any 61V lithium pack (LFP or NMC) whose BMS accepts a 70 V charge voltage and ≥ 30 A charge current. Check the battery datasheet — for LFP packs, 61V nominal usually means 19S / 60.8V, charged at 69.35V. Do not use on lead-acid batteries.',
      },
      {
        question: 'How long will a full charge take?',
        answer:
          'Roughly battery Ah ÷ 30 A plus about 30 minutes for the CV tail. Example: a 105 Ah pack ≈ 4 hours; a 30 Ah pack ≈ 1.5 hours.',
      },
      {
        question: 'Can I leave it connected overnight?',
        answer:
          'Yes. The charger switches off automatically when the pack is full and has no-load protection, so it does not trickle or overcharge.',
      },
      {
        question: 'Is it safe to use outdoors or in the rain?',
        answer:
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
      },
      {
        question: 'What does the LED indicate?',
        answer:
          'Tri-colour status: charging, fully charged, and fault. A common-fault indication flags reverse connection, short circuit or over-temperature — fix the fault and reconnect the battery to resume.',
      },
      {
        question: 'What happens if I connect the battery backwards?',
        answer:
          'Reverse-connection protection disconnects the output; neither charger nor battery is damaged. Reconnect correctly to charge.',
      },
      {
        question: 'Does it work with CAN-enabled batteries?',
        answer:
          'Yes — the CAN bus interface lets a compatible BMS control charge voltage and current. Non-CAN packs charge on the fixed CC-CV profile.',
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Rated battery pack voltage', value: '61 V' },
          { label: 'Max. output voltage', value: '70 V' },
          { label: 'Max. output current', value: '30 A' },
          { label: 'Rated power', value: '2000 W' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '61V lithium (LFP / Li-ion) packs',
          'Interface: CAN bus compatible; tri-colour LED status; common-fault LED indication',
          'Input: 220 VAC ±15%, ≤ 7.5 A',
        ],
      },
      {
        kind: 'care',
        items: [
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
        ],
      },
    ],
    media: mediaFor('Charger_TK2000W_TK61-30', 'Trontek TK2000W charger (TK 61-30)'),
  },

  /* -------------------- Charger · TK2000W · TK 72-25 */
  {
    productKey: 'trontek-charger-tk72-25',
    slug: 'trontek-tk2000w-charger-tk72-25',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK2000W Lithium EV Battery Charger TK 72-25',
    subtitle: 'Lithium-ion battery charger',
    modelName: 'TK 72-25',
    genericName: 'Lithium-ion battery charger',
    productType: 'On-board / off-board charger, CC-CV, active PFC + LLC',
    netQuantity: '1 Count',
    category: 'chargers',
    subcategory: 'ev-chargers',
    art: 'inverter',
    countryOfOrigin: 'India',
    description: [
      "The Trontek TK 72-25 is a 2000 W lithium EV battery charger from the TK2000W series, rated for 72V packs with a maximum output of 84 V at 25 A. Active PFC and LLC design deliver ≥94% efficiency and ≥0.99 power factor from a 220 VAC ±15% supply, with fast active and passive self-protection on voltage and current. The die-cast, glue-sealed shell and potted cooling fan give an IP66 unit built for on-board or off-board use in Indian conditions. CAN bus lets the charger talk to compatible battery BMS for controlled charging, and it shuts down automatically when the pack is full. Made at Trontek's New Delhi facility.",
    ],
    highlights: [
      'Active PFC and LLC topology — rapid fault response, software and hardware self-protection on voltage and current',
      'Advanced charging strategy acts as a safeguard for the battery system',
      'Integrated die-cast aluminium shell, sealed with special glue; IP66 rated',
      'Long-life potted active cooling fan; proven for 10+ years across wet, hot, cold and high-altitude environments',
      'CAN bus interface and tri-colour status indicator',
      'Burnout, reverse-connection, no-load and short-circuit protection; automatic shut-off when fully charged',
      'Certifications shown: UL, CE, IEC, KC, RCM, TÜV, IP66',
    ],
    boxContents: [],
    careInstructions: null,
    // "[insert Trontek charger warranty]".
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: CHARGER_HSN,
    taxRate: GST,
    facets: { voltage: 72 },
    badges: [],
    popularityRank: 38,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-CHG-TK7225')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Series', value: 'TK2000W' },
          { label: 'Model', value: 'TK 72-25' },
          { label: 'Rated battery pack voltage', value: '72 V' },
          { label: 'Max. output voltage', value: '84 V' },
          { label: 'Max. output current', value: '25 A' },
          { label: 'Rated power', value: '2000 W' },
          { label: 'AC input voltage range', value: '220 VAC ±15%' },
          { label: 'AC input max. current', value: '≤ 7.5 A' },
          { label: 'Power factor', value: '≥ 0.99' },
          { label: 'Efficiency', value: '≥ 94%' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
          { label: 'Communication', value: 'CAN bus compatible' },
          { label: 'Indication', value: 'Tri-colour LED; common-fault LED' },
          {
            label: 'Over-temperature',
            value:
              'Power derates above limit; stops and goes to standby above 65°C ambient, resumes when cool',
          },
          {
            label: 'Protections',
            value:
              'Burnout (over-temperature), reverse battery connection, no-load (no output without battery), output short circuit, auto shut-off at full charge',
          },
          { label: 'Enclosure', value: 'Integrated die-cast, glue-sealed; IP66' },
          { label: 'Cooling', value: 'Active fan (potted, long-life)' },
          { label: 'Height', value: '90 ±2 mm' },
          { label: 'Width', value: '160 ±2 mm' },
          { label: 'Length', value: '253 ±2 mm' },
          { label: 'Other models in series', value: 'TK 48-35, TK 61-30' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '253 × 160 × 90 mm (±2 mm)' },
          { label: 'In centimetres', value: '25.3 × 16.0 × 9.0 cm' },
          { label: 'Net weight', value: '~3.7 kg' },
          { label: 'Shipping weight', value: '~7.70 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek TK2000W Lithium EV Battery Charger TK 72-25' },
          { label: 'Model name', value: 'TK 72-25' },
          { label: 'Series', value: 'TK2000W series (2000 W)' },
          {
            label: 'Category',
            value: 'EV Battery Charger / Lithium Battery Charger (2W / 3W / Light EV)',
          },
          { label: 'Generic name', value: 'Lithium-ion battery charger' },
          { label: 'Type', value: 'On-board / off-board charger, CC-CV, active PFC + LLC' },
          { label: 'Suitable for battery pack', value: '72V lithium (LFP / Li-ion) packs' },
          { label: 'Max. output voltage', value: '84 V' },
          { label: 'Max. output current', value: '25 A' },
          { label: 'Input', value: '220 VAC ±15%, ≤ 7.5 A' },
          {
            label: 'Interface',
            value: 'CAN bus compatible; tri-colour LED status; common-fault LED indication',
          },
          {
            label: 'Applications',
            value:
              'E-rickshaws, e-loaders, e-scooters, golf cars, AGVs, material handling, floor care, mobile elevated platforms, ATV/UTV, aquatic and outdoor power supply',
          },
          { label: 'Colour', value: 'Grey die-cast' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8504 40 (static converters / battery chargers)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which batteries can I charge with this?',
        answer:
          'Any 72V lithium pack (LFP or NMC) whose BMS accepts a 84 V charge voltage and ≥ 25 A charge current. Check the battery datasheet — for LFP packs, 72V nominal usually means 23S / 73.6V, charged at 83.95V. Do not use on lead-acid batteries.',
      },
      {
        question: 'How long will a full charge take?',
        answer:
          'Roughly battery Ah ÷ 25 A plus about 30 minutes for the CV tail. Example: a 105 Ah pack ≈ 4.7 hours; a 30 Ah pack ≈ 1.7 hours.',
      },
      {
        question: 'Can I leave it connected overnight?',
        answer:
          'Yes. The charger switches off automatically when the pack is full and has no-load protection, so it does not trickle or overcharge.',
      },
      {
        question: 'Is it safe to use outdoors or in the rain?',
        answer:
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
      },
      {
        question: 'What does the LED indicate?',
        answer:
          'Tri-colour status: charging, fully charged, and fault. A common-fault indication flags reverse connection, short circuit or over-temperature — fix the fault and reconnect the battery to resume.',
      },
      {
        question: 'What happens if I connect the battery backwards?',
        answer:
          'Reverse-connection protection disconnects the output; neither charger nor battery is damaged. Reconnect correctly to charge.',
      },
      {
        question: 'Does it work with CAN-enabled batteries?',
        answer:
          'Yes — the CAN bus interface lets a compatible BMS control charge voltage and current. Non-CAN packs charge on the fixed CC-CV profile.',
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Rated battery pack voltage', value: '72 V' },
          { label: 'Max. output voltage', value: '84 V' },
          { label: 'Max. output current', value: '25 A' },
          { label: 'Rated power', value: '2000 W' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '72V lithium (LFP / Li-ion) packs',
          'Interface: CAN bus compatible; tri-colour LED status; common-fault LED indication',
          'Input: 220 VAC ±15%, ≤ 7.5 A',
        ],
      },
      {
        kind: 'care',
        items: [
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
        ],
      },
    ],
    media: mediaFor('Charger_TK2000W_TK72-25', 'Trontek TK2000W charger (TK 72-25)'),
  },

  /* -------------------- Charger · TK3000W · TK 48-50 */
  {
    productKey: 'trontek-charger-tk48-50',
    slug: 'trontek-tk3000w-charger-tk48-50',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK3000W Lithium EV Battery Charger TK 48-50',
    subtitle: 'Lithium-ion battery charger',
    modelName: 'TK 48-50',
    genericName: 'Lithium-ion battery charger',
    productType: 'On-board / off-board charger, CC-CV, active PFC + LLC',
    netQuantity: '1 Count',
    category: 'chargers',
    subcategory: 'ev-chargers',
    art: 'inverter',
    countryOfOrigin: 'India',
    description: [
      "The Trontek TK 48-50 is a 3000 W lithium EV battery charger from the TK3000W series, rated for 48V packs with a maximum output of 68 V at 50 A. Active PFC and LLC design deliver ≥94% efficiency and ≥0.99 power factor from a 220 VAC ±15% supply, with fast active and passive self-protection on voltage and current. The die-cast, glue-sealed shell and potted cooling fan give an IP66 unit built for on-board or off-board use in Indian conditions. CAN bus lets the charger talk to compatible battery BMS for controlled charging, and it shuts down automatically when the pack is full. Made at Trontek's New Delhi facility.",
    ],
    highlights: [
      'Active PFC and LLC topology — rapid fault response, software and hardware self-protection on voltage and current',
      'Advanced charging strategy acts as a safeguard for the battery system',
      'Integrated die-cast aluminium shell, sealed with special glue; IP66 rated',
      'Long-life potted active cooling fan; proven for 10+ years across wet, hot, cold and high-altitude environments',
      'CAN bus interface and tri-colour status indicator',
      'Burnout, reverse-connection, no-load and short-circuit protection; automatic shut-off when fully charged',
      'Certifications shown: UL, CE, IEC, KC, RCM, TÜV, IP66',
    ],
    boxContents: [],
    careInstructions: null,
    // "[insert Trontek charger warranty]".
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: CHARGER_HSN,
    taxRate: GST,
    facets: { voltage: 48 },
    badges: [],
    popularityRank: 39,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-CHG-TK4850')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Series', value: 'TK3000W' },
          { label: 'Model', value: 'TK 48-50' },
          { label: 'Rated battery pack voltage', value: '48 V' },
          { label: 'Max. output voltage', value: '68 V' },
          { label: 'Max. output current', value: '50 A' },
          { label: 'Rated power', value: '3000 W' },
          { label: 'AC input voltage range', value: '220 VAC ±15%' },
          { label: 'AC input max. current', value: '≤ 15 A @ 220 VAC' },
          { label: 'Power factor', value: '≥ 0.99' },
          { label: 'Efficiency', value: '≥ 94%' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
          { label: 'Communication', value: 'CAN bus compatible' },
          { label: 'Indication', value: 'Tri-colour LED; common-fault LED' },
          {
            label: 'Over-temperature',
            value:
              'Power derates above limit; stops and goes to standby above 65°C ambient, resumes when cool',
          },
          {
            label: 'Protections',
            value:
              'Burnout (over-temperature), reverse battery connection, no-load (no output without battery), output short circuit, auto shut-off at full charge',
          },
          { label: 'Enclosure', value: 'Integrated die-cast, glue-sealed; IP66' },
          { label: 'Cooling', value: 'Active fan (potted, long-life)' },
          { label: 'Height', value: '95 ±2 mm' },
          { label: 'Width', value: '197 ±2 mm' },
          { label: 'Length', value: '272 ±2 mm' },
          { label: 'Other models in series', value: 'TK 60-40, TK 72-35' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '272 × 197 × 95 mm (±2 mm)' },
          { label: 'In centimetres', value: '27.2 × 19.7 × 9.5 cm' },
          { label: 'Net weight', value: '~5.8 kg' },
          { label: 'Shipping weight', value: '~9.80 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek TK3000W Lithium EV Battery Charger TK 48-50' },
          { label: 'Model name', value: 'TK 48-50' },
          { label: 'Series', value: 'TK3000W series (3000 W)' },
          {
            label: 'Category',
            value: 'EV Battery Charger / Lithium Battery Charger (2W / 3W / Light EV)',
          },
          { label: 'Generic name', value: 'Lithium-ion battery charger' },
          { label: 'Type', value: 'On-board / off-board charger, CC-CV, active PFC + LLC' },
          { label: 'Suitable for battery pack', value: '48V lithium (LFP / Li-ion) packs' },
          { label: 'Max. output voltage', value: '68 V' },
          { label: 'Max. output current', value: '50 A' },
          { label: 'Input', value: '220 VAC ±15%, ≤ 15 A @ 220 VAC' },
          {
            label: 'Interface',
            value: 'CAN bus compatible; tri-colour LED status; common-fault LED indication',
          },
          {
            label: 'Applications',
            value:
              'E-rickshaws, e-loaders, e-scooters, golf cars, AGVs, material handling, floor care, mobile elevated platforms, ATV/UTV, aquatic and outdoor power supply',
          },
          { label: 'Colour', value: 'Grey die-cast' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8504 40 (static converters / battery chargers)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which batteries can I charge with this?',
        answer:
          'Any 48V lithium pack (LFP or NMC) whose BMS accepts a 68 V charge voltage and ≥ 50 A charge current. Check the battery datasheet — for LFP packs, 48V nominal usually means 16S / 51.2V, charged at 58.4V. Do not use on lead-acid batteries.',
      },
      {
        question: 'How long will a full charge take?',
        answer:
          'Roughly battery Ah ÷ 50 A plus about 30 minutes for the CV tail. Example: a 105 Ah pack ≈ 2.6 hours; a 30 Ah pack ≈ 1.1 hours.',
      },
      {
        question: 'Can I leave it connected overnight?',
        answer:
          'Yes. The charger switches off automatically when the pack is full and has no-load protection, so it does not trickle or overcharge.',
      },
      {
        question: 'Is it safe to use outdoors or in the rain?',
        answer:
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
      },
      {
        question: 'What does the LED indicate?',
        answer:
          'Tri-colour status: charging, fully charged, and fault. A common-fault indication flags reverse connection, short circuit or over-temperature — fix the fault and reconnect the battery to resume.',
      },
      {
        question: 'What happens if I connect the battery backwards?',
        answer:
          'Reverse-connection protection disconnects the output; neither charger nor battery is damaged. Reconnect correctly to charge.',
      },
      {
        question: 'Does it work with CAN-enabled batteries?',
        answer:
          'Yes — the CAN bus interface lets a compatible BMS control charge voltage and current. Non-CAN packs charge on the fixed CC-CV profile.',
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Rated battery pack voltage', value: '48 V' },
          { label: 'Max. output voltage', value: '68 V' },
          { label: 'Max. output current', value: '50 A' },
          { label: 'Rated power', value: '3000 W' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '48V lithium (LFP / Li-ion) packs',
          'Interface: CAN bus compatible; tri-colour LED status; common-fault LED indication',
          'Input: 220 VAC ±15%, ≤ 15 A @ 220 VAC',
        ],
      },
      {
        kind: 'care',
        items: [
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
        ],
      },
    ],
    media: mediaFor('Charger_TK3000W_TK48-50', 'Trontek TK3000W charger (TK 48-50)'),
  },

  /* -------------------- Charger · TK3000W · TK 60-40 */
  {
    productKey: 'trontek-charger-tk60-40',
    slug: 'trontek-tk3000w-charger-tk60-40',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK3000W Lithium EV Battery Charger TK 60-40',
    subtitle: 'Lithium-ion battery charger',
    modelName: 'TK 60-40',
    genericName: 'Lithium-ion battery charger',
    productType: 'On-board / off-board charger, CC-CV, active PFC + LLC',
    netQuantity: '1 Count',
    category: 'chargers',
    subcategory: 'ev-chargers',
    art: 'inverter',
    countryOfOrigin: 'India',
    description: [
      "The Trontek TK 60-40 is a 3000 W lithium EV battery charger from the TK3000W series, rated for 60V packs with a maximum output of 85 V at 40 A. Active PFC and LLC design deliver ≥94% efficiency and ≥0.99 power factor from a 220 VAC ±15% supply, with fast active and passive self-protection on voltage and current. The die-cast, glue-sealed shell and potted cooling fan give an IP66 unit built for on-board or off-board use in Indian conditions. CAN bus lets the charger talk to compatible battery BMS for controlled charging, and it shuts down automatically when the pack is full. Made at Trontek's New Delhi facility.",
    ],
    highlights: [
      'Active PFC and LLC topology — rapid fault response, software and hardware self-protection on voltage and current',
      'Advanced charging strategy acts as a safeguard for the battery system',
      'Integrated die-cast aluminium shell, sealed with special glue; IP66 rated',
      'Long-life potted active cooling fan; proven for 10+ years across wet, hot, cold and high-altitude environments',
      'CAN bus interface and tri-colour status indicator',
      'Burnout, reverse-connection, no-load and short-circuit protection; automatic shut-off when fully charged',
      'Certifications shown: UL, CE, IEC, KC, RCM, TÜV, IP66',
    ],
    boxContents: [],
    careInstructions: null,
    // "[insert Trontek charger warranty]".
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: CHARGER_HSN,
    taxRate: GST,
    facets: { voltage: 60 },
    badges: [],
    popularityRank: 40,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-CHG-TK6040')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Series', value: 'TK3000W' },
          { label: 'Model', value: 'TK 60-40' },
          { label: 'Rated battery pack voltage', value: '60 V' },
          { label: 'Max. output voltage', value: '85 V' },
          { label: 'Max. output current', value: '40 A' },
          { label: 'Rated power', value: '3000 W' },
          { label: 'AC input voltage range', value: '220 VAC ±15%' },
          { label: 'AC input max. current', value: '≤ 15 A @ 220 VAC' },
          { label: 'Power factor', value: '≥ 0.99' },
          { label: 'Efficiency', value: '≥ 94%' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
          { label: 'Communication', value: 'CAN bus compatible' },
          { label: 'Indication', value: 'Tri-colour LED; common-fault LED' },
          {
            label: 'Over-temperature',
            value:
              'Power derates above limit; stops and goes to standby above 65°C ambient, resumes when cool',
          },
          {
            label: 'Protections',
            value:
              'Burnout (over-temperature), reverse battery connection, no-load (no output without battery), output short circuit, auto shut-off at full charge',
          },
          { label: 'Enclosure', value: 'Integrated die-cast, glue-sealed; IP66' },
          { label: 'Cooling', value: 'Active fan (potted, long-life)' },
          { label: 'Height', value: '95 ±2 mm' },
          { label: 'Width', value: '197 ±2 mm' },
          { label: 'Length', value: '272 ±2 mm' },
          { label: 'Other models in series', value: 'TK 48-50, TK 72-35' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '272 × 197 × 95 mm (±2 mm)' },
          { label: 'In centimetres', value: '27.2 × 19.7 × 9.5 cm' },
          { label: 'Net weight', value: '~5.8 kg' },
          { label: 'Shipping weight', value: '~9.80 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek TK3000W Lithium EV Battery Charger TK 60-40' },
          { label: 'Model name', value: 'TK 60-40' },
          { label: 'Series', value: 'TK3000W series (3000 W)' },
          {
            label: 'Category',
            value: 'EV Battery Charger / Lithium Battery Charger (2W / 3W / Light EV)',
          },
          { label: 'Generic name', value: 'Lithium-ion battery charger' },
          { label: 'Type', value: 'On-board / off-board charger, CC-CV, active PFC + LLC' },
          { label: 'Suitable for battery pack', value: '60V lithium (LFP / Li-ion) packs' },
          { label: 'Max. output voltage', value: '85 V' },
          { label: 'Max. output current', value: '40 A' },
          { label: 'Input', value: '220 VAC ±15%, ≤ 15 A @ 220 VAC' },
          {
            label: 'Interface',
            value: 'CAN bus compatible; tri-colour LED status; common-fault LED indication',
          },
          {
            label: 'Applications',
            value:
              'E-rickshaws, e-loaders, e-scooters, golf cars, AGVs, material handling, floor care, mobile elevated platforms, ATV/UTV, aquatic and outdoor power supply',
          },
          { label: 'Colour', value: 'Grey die-cast' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8504 40 (static converters / battery chargers)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which batteries can I charge with this?',
        answer:
          'Any 60V lithium pack (LFP or NMC) whose BMS accepts a 85 V charge voltage and ≥ 40 A charge current. Check the battery datasheet — for LFP packs, 60V nominal usually means 19S / 60.8V, charged at 69.35V. Do not use on lead-acid batteries.',
      },
      {
        question: 'How long will a full charge take?',
        answer:
          'Roughly battery Ah ÷ 40 A plus about 30 minutes for the CV tail. Example: a 105 Ah pack ≈ 3.1 hours; a 30 Ah pack ≈ 1.3 hours.',
      },
      {
        question: 'Can I leave it connected overnight?',
        answer:
          'Yes. The charger switches off automatically when the pack is full and has no-load protection, so it does not trickle or overcharge.',
      },
      {
        question: 'Is it safe to use outdoors or in the rain?',
        answer:
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
      },
      {
        question: 'What does the LED indicate?',
        answer:
          'Tri-colour status: charging, fully charged, and fault. A common-fault indication flags reverse connection, short circuit or over-temperature — fix the fault and reconnect the battery to resume.',
      },
      {
        question: 'What happens if I connect the battery backwards?',
        answer:
          'Reverse-connection protection disconnects the output; neither charger nor battery is damaged. Reconnect correctly to charge.',
      },
      {
        question: 'Does it work with CAN-enabled batteries?',
        answer:
          'Yes — the CAN bus interface lets a compatible BMS control charge voltage and current. Non-CAN packs charge on the fixed CC-CV profile.',
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Rated battery pack voltage', value: '60 V' },
          { label: 'Max. output voltage', value: '85 V' },
          { label: 'Max. output current', value: '40 A' },
          { label: 'Rated power', value: '3000 W' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '60V lithium (LFP / Li-ion) packs',
          'Interface: CAN bus compatible; tri-colour LED status; common-fault LED indication',
          'Input: 220 VAC ±15%, ≤ 15 A @ 220 VAC',
        ],
      },
      {
        kind: 'care',
        items: [
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
        ],
      },
    ],
    media: mediaFor('Charger_TK3000W_TK60-40', 'Trontek TK3000W charger (TK 60-40)'),
  },

  /* -------------------- Charger · TK3000W · TK 72-35 */
  {
    productKey: 'trontek-charger-tk72-35',
    slug: 'trontek-tk3000w-charger-tk72-35',
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Trontek TK3000W Lithium EV Battery Charger TK 72-35',
    subtitle: 'Lithium-ion battery charger',
    modelName: 'TK 72-35',
    genericName: 'Lithium-ion battery charger',
    productType: 'On-board / off-board charger, CC-CV, active PFC + LLC',
    netQuantity: '1 Count',
    category: 'chargers',
    subcategory: 'ev-chargers',
    art: 'inverter',
    countryOfOrigin: 'India',
    description: [
      "The Trontek TK 72-35 is a 3000 W lithium EV battery charger from the TK3000W series, rated for 72V packs with a maximum output of 102 V at 35 A. Active PFC and LLC design deliver ≥94% efficiency and ≥0.99 power factor from a 220 VAC ±15% supply, with fast active and passive self-protection on voltage and current. The die-cast, glue-sealed shell and potted cooling fan give an IP66 unit built for on-board or off-board use in Indian conditions. CAN bus lets the charger talk to compatible battery BMS for controlled charging, and it shuts down automatically when the pack is full. Made at Trontek's New Delhi facility.",
    ],
    highlights: [
      'Active PFC and LLC topology — rapid fault response, software and hardware self-protection on voltage and current',
      'Advanced charging strategy acts as a safeguard for the battery system',
      'Integrated die-cast aluminium shell, sealed with special glue; IP66 rated',
      'Long-life potted active cooling fan; proven for 10+ years across wet, hot, cold and high-altitude environments',
      'CAN bus interface and tri-colour status indicator',
      'Burnout, reverse-connection, no-load and short-circuit protection; automatic shut-off when fully charged',
      'Certifications shown: UL, CE, IEC, KC, RCM, TÜV, IP66',
    ],
    boxContents: [],
    careInstructions: null,
    // "[insert Trontek charger warranty]".
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: CHARGER_HSN,
    taxRate: GST,
    facets: { voltage: 72 },
    badges: [],
    popularityRank: 41,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [unpriced('TRN-CHG-TK7235')],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Series', value: 'TK3000W' },
          { label: 'Model', value: 'TK 72-35' },
          { label: 'Rated battery pack voltage', value: '72 V' },
          { label: 'Max. output voltage', value: '102 V' },
          { label: 'Max. output current', value: '35 A' },
          { label: 'Rated power', value: '3000 W' },
          { label: 'AC input voltage range', value: '220 VAC ±15%' },
          { label: 'AC input max. current', value: '≤ 15 A @ 220 VAC' },
          { label: 'Power factor', value: '≥ 0.99' },
          { label: 'Efficiency', value: '≥ 94%' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
          { label: 'Communication', value: 'CAN bus compatible' },
          { label: 'Indication', value: 'Tri-colour LED; common-fault LED' },
          {
            label: 'Over-temperature',
            value:
              'Power derates above limit; stops and goes to standby above 65°C ambient, resumes when cool',
          },
          {
            label: 'Protections',
            value:
              'Burnout (over-temperature), reverse battery connection, no-load (no output without battery), output short circuit, auto shut-off at full charge',
          },
          { label: 'Enclosure', value: 'Integrated die-cast, glue-sealed; IP66' },
          { label: 'Cooling', value: 'Active fan (potted, long-life)' },
          { label: 'Height', value: '95 ±2 mm' },
          { label: 'Width', value: '197 ±2 mm' },
          { label: 'Length', value: '272 ±2 mm' },
          { label: 'Other models in series', value: 'TK 48-50, TK 60-40' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '272 × 197 × 95 mm (±2 mm)' },
          { label: 'In centimetres', value: '27.2 × 19.7 × 9.5 cm' },
          { label: 'Net weight', value: '~5.8 kg' },
          { label: 'Shipping weight', value: '~9.80 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Trontek TK3000W Lithium EV Battery Charger TK 72-35' },
          { label: 'Model name', value: 'TK 72-35' },
          { label: 'Series', value: 'TK3000W series (3000 W)' },
          {
            label: 'Category',
            value: 'EV Battery Charger / Lithium Battery Charger (2W / 3W / Light EV)',
          },
          { label: 'Generic name', value: 'Lithium-ion battery charger' },
          { label: 'Type', value: 'On-board / off-board charger, CC-CV, active PFC + LLC' },
          { label: 'Suitable for battery pack', value: '72V lithium (LFP / Li-ion) packs' },
          { label: 'Max. output voltage', value: '102 V' },
          { label: 'Max. output current', value: '35 A' },
          { label: 'Input', value: '220 VAC ±15%, ≤ 15 A @ 220 VAC' },
          {
            label: 'Interface',
            value: 'CAN bus compatible; tri-colour LED status; common-fault LED indication',
          },
          {
            label: 'Applications',
            value:
              'E-rickshaws, e-loaders, e-scooters, golf cars, AGVs, material handling, floor care, mobile elevated platforms, ATV/UTV, aquatic and outdoor power supply',
          },
          { label: 'Colour', value: 'Grey die-cast' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8504 40 (static converters / battery chargers)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which batteries can I charge with this?',
        answer:
          'Any 72V lithium pack (LFP or NMC) whose BMS accepts a 102 V charge voltage and ≥ 35 A charge current. Check the battery datasheet — for LFP packs, 72V nominal usually means 23S / 73.6V, charged at 83.95V. Do not use on lead-acid batteries.',
      },
      {
        question: 'How long will a full charge take?',
        answer:
          'Roughly battery Ah ÷ 35 A plus about 30 minutes for the CV tail. Example: a 105 Ah pack ≈ 3.5 hours; a 30 Ah pack ≈ 1.4 hours.',
      },
      {
        question: 'Can I leave it connected overnight?',
        answer:
          'Yes. The charger switches off automatically when the pack is full and has no-load protection, so it does not trickle or overcharge.',
      },
      {
        question: 'Is it safe to use outdoors or in the rain?',
        answer:
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
      },
      {
        question: 'What does the LED indicate?',
        answer:
          'Tri-colour status: charging, fully charged, and fault. A common-fault indication flags reverse connection, short circuit or over-temperature — fix the fault and reconnect the battery to resume.',
      },
      {
        question: 'What happens if I connect the battery backwards?',
        answer:
          'Reverse-connection protection disconnects the output; neither charger nor battery is damaged. Reconnect correctly to charge.',
      },
      {
        question: 'Does it work with CAN-enabled batteries?',
        answer:
          'Yes — the CAN bus interface lets a compatible BMS control charge voltage and current. Non-CAN packs charge on the fixed CC-CV profile.',
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Rated battery pack voltage', value: '72 V' },
          { label: 'Max. output voltage', value: '102 V' },
          { label: 'Max. output current', value: '35 A' },
          { label: 'Rated power', value: '3000 W' },
          { label: 'Charge method', value: 'CC-CV with active PFC + LLC' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '72V lithium (LFP / Li-ion) packs',
          'Interface: CAN bus compatible; tri-colour LED status; common-fault LED indication',
          'Input: 220 VAC ±15%, ≤ 15 A @ 220 VAC',
        ],
      },
      {
        kind: 'care',
        items: [
          'The unit is IP66 (dust-tight, protected against strong water jets) in a sealed die-cast shell. Keep the AC plug and connectors dry; do not submerge.',
        ],
      },
    ],
    media: mediaFor('Charger_TK3000W_TK72-35', 'Trontek TK3000W charger (TK 72-35)'),
  },

];
