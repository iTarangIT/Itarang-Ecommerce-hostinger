import type { ProductSeed } from '../../src/lib/products/seed-types.ts';
import { GST, HSN, mediaFor } from './trontek-shared.ts';

/**
 * The two Powercube home energy storage products.
 *
 * Transcribed from `Trontek_Powercube_1.4_TK12100_Product_Listing.docx` and
 * `Trontek_Powercube_2.7_TK25100_Product_Listing.docx`. See
 * `trontek-shared.ts` for the parties both point at and for the rules the
 * transcription follows.
 */

export const TRONTEK_HOME_PRODUCTS: ProductSeed[] = [
  /* ------------------------------------------------ 1 · Powercube 1.4 */
  {
    productKey: 'trontek-tk12100',
    slug: 'trontek-powercube-1-4-tk12100',
    status: 'published',
    brand: 'TRONTEK',
    title: 'Powercube 1.4 Home Battery Storage',
    subtitle: 'Lithium Iron Phosphate inverter / home energy storage battery',
    modelName: 'TK12100 (12.8V/105Ah)',
    genericName: 'Lithium Iron Phosphate inverter / home energy storage battery',
    // The two Powercube documents state no Category or Product type row.
    productType: null,
    netQuantity: '1 Count',
    category: 'batteries',
    subcategory: 'lithium',
    art: 'battery',
    countryOfOrigin: 'India',
    description: [
      'The Trontek Powercube 1.4 is a residential energy storage system that acts as a power source, stores excess electricity generation, helps go off-grid, lowers power cost, minimises power loss, fulfils peak power demand and improves the home power network. Connect it to an existing photovoltaic system or install a new one with a hybrid inverter to become energy independent. The built-in intelligent BMS protects and monitors the lithium pack for prolonged cyclic life. Trontek is an established Indian battery manufacturer with 1 GWh production capacity, in-house R&D and testing.',
    ],
    highlights: [
      'High safety standard LFP (LiFePO4) cell chemistry',
      'Intelligent BMS — over-charge, over-discharge, over-current, short-circuit and over-temperature protection',
      'Long-life design supported by efficient cell equalization technology',
      'Compact wall/floor-mount design, easy installation',
      'Works with an existing photovoltaic system, a new hybrid inverter or an existing 12V inverter',
      '>4000 cycles at 80% DOD; 12-year design life at 35°C',
    ],
    boxContents: [],
    careInstructions: null,
    // Stated in FAQ 7 of this document: "Warranty period 5 years or 4000 cycles
    // whichever is earlier". One of only two products whose warranty is stated.
    warrantyMonths: 60,
    warrantyCycles: 4000,
    warrantyText: '5 years or 4000 cycles, whichever is earlier',
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: HSN,
    taxRate: GST,
    facets: { batteryAh: 105, voltage: 12.8, technology: 'LiFePO4', warrantyMonths: 60 },
    badges: [],
    popularityRank: 1,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [
      {
        variantKey: 'default',
        sku: 'TRN-TK12100',
        title: '',
        optionValues: {},
        mrp: 3_000_000,
        selling: 2_500_000,
        stock: null,
        availability: 'in-stock',
      },
    ],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Model', value: 'TK12100' },
          { label: 'Type', value: '12.8V / 105Ah' },
          { label: 'Rated voltage', value: '12.8 V' },
          { label: 'Rated capacity (0.5CA)', value: '105 Ah' },
          { label: 'Energy', value: '1.344 kWh' },
          { label: 'Cell configuration', value: '4S1P' },
          { label: 'Cell voltage', value: '3.2 V' },
          { label: 'Voltage range', value: '11.2 – 14.6 V ±0.2 V' },
          { label: 'Charging voltage', value: '14.6 V ±0.2 V' },
          { label: 'Charging mode', value: 'CC/CV' },
          { label: 'Ah efficiency', value: '>95%' },
          { label: 'Max. charge current', value: '0.5C (≈52.5 A)' },
          { label: 'Max. discharge current', value: '1C (≈105 A)' },
          { label: 'Design life @35°C (Class I & II area)', value: '12 years' },
          {
            label: 'Cycle life (80% DOD, 25°C, 0.5C charge / 0.5C discharge)',
            value: '>4000 cycles',
          },
          { label: 'Charging temperature', value: '0°C to +45°C' },
          { label: 'Discharging temperature', value: '−10°C to +60°C' },
          {
            label: 'Storage temperature & time',
            value: '1 year @20°C / 6 months @30°C / 3 months @40°C',
          },
          { label: 'Protection class', value: 'IP20' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '262 × 354 × 133 mm (±2 mm)' },
          { label: 'In centimetres', value: '26.2 × 35.4 × 13.3 cm' },
          { label: 'Net weight', value: '11.5 kg' },
          { label: 'Shipping weight', value: '14.0 kg' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Powercube 1.4 Home Battery Storage' },
          { label: 'Model name', value: 'TK12100 (12.8V/105Ah)' },
          {
            label: 'Generic name',
            value: 'Lithium Iron Phosphate inverter / home energy storage battery',
          },
          { label: 'Battery cell composition', value: 'Lithium Iron Phosphate (LiFePO4 / LFP)' },
          { label: 'Voltage', value: '12.8 Volts' },
          { label: 'Battery capacity', value: '105 Ah (1.344 kWh)' },
          { label: 'Number of batteries', value: '1 × 12V battery required' },
          {
            label: 'Recommended uses',
            value:
              'Residential energy storage with hybrid / solar / lithium-compatible inverters; home backup power; storing excess PV generation; peak-demand supply; off-grid use',
          },
          {
            label: 'Inverter compatibility',
            value:
              'Lithium-ready inverters with 12V battery input and 14.6V charging profile; compatible with major inverter brands',
          },
          { label: 'Installation', value: 'Wall or floor mounted (indoor, IP20)' },
          { label: 'Colour', value: 'White with black display strip' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8507 60 00 (lithium-ion accumulators)' },
          { label: 'GST', value: '18% (subject to change as per govt norms)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Will this work with my existing inverter?',
        answer:
          'Yes, if your inverter supports lithium (LFP) batteries with a 12V battery input and a 14.6V charging voltage. Most modern hybrid and "lithium-ready" inverters do. Older lead-acid-only inverters are also compatible if they are using 12V lead acid batteries.',
      },
      {
        question: 'How is this different from a lead-acid / tubular inverter battery?',
        answer:
          'LFP delivers 4000+ cycles versus roughly 800–1200 for tubular, 80–100% usable depth of discharge versus about 50%, around one-third the weight, no water topping, no acid fumes and faster charging. Upfront cost is higher; cost per cycle is lower.',
      },
      {
        question: 'How long will it run my home?',
        answer:
          'The battery stores 1.344 kWh. Divide by your load. Example: 300 W of fans, lights and Wi-Fi runs for about 4 hours at ~90% usable capacity. Refer to calculator on website',
      },
      {
        question: 'Does it need maintenance?',
        answer:
          'No. There is no water topping, terminal cleaning or venting. The built-in BMS handles balancing and protection.',
      },
      {
        question: 'Is it safe to use indoors?',
        answer:
          'Yes. LFP is the most thermally stable lithium chemistry and the BMS protects against over-charge, over-discharge, over-current, short-circuit and over-temperature. The unit is IP20, so install indoors in a ventilated spot away from water.',
      },
      {
        question: 'Can I add a second battery later?',
        // Transcribed exactly. The source answer begins mid-sentence.
        answer: 'packs must be the same model and firmware. Never mix with lead-acid or other lithium brands.',
      },
      {
        question: 'What is the warranty and expected life?',
        answer:
          'Design life of 12 years at 35°C and more than 4000 cycles at 80% DOD. Warranty period 5 years or 4000 cycles whichever is earlier',
      },
      {
        question: 'What happens to the battery at end of life?',
        answer:
          "It is recyclable. Return it through the seller's take-back programme under the Battery Waste Management Rules, 2022. Never dispose of it in household waste.",
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Charging voltage', value: '14.6 V ±0.2 V' },
          { label: 'Charging mode', value: 'CC/CV' },
          { label: 'Max. charge current', value: '0.5C (≈52.5 A)' },
          { label: 'Charging temperature', value: '0°C to +45°C' },
          { label: 'Ah efficiency', value: '>95%' },
        ],
      },
      {
        kind: 'discharge',
        summary: '',
        points: [
          { label: 'Max. discharge current', value: '1C (≈105 A)' },
          { label: 'Discharging temperature', value: '−10°C to +60°C' },
          { label: 'Cycle life', value: '>4000 cycles at 80% DOD, 25°C' },
          { label: 'Design life at 35°C', value: '12 years' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          'Lithium-ready inverters with 12V battery input and 14.6V charging profile; compatible with major inverter brands',
          'Wall or floor mounted (indoor, IP20)',
          'Never mix with lead-acid or other lithium brands.',
        ],
      },
      {
        kind: 'care',
        items: [
          'There is no water topping, terminal cleaning or venting. The built-in BMS handles balancing and protection.',
          'The unit is IP20, so install indoors in a ventilated spot away from water.',
          'Storage: 1 year @20°C / 6 months @30°C / 3 months @40°C.',
        ],
      },
    ],
    media: mediaFor('Powercube_1.4_TK12100', 'Trontek Powercube 1.4 (TK12100)'),
  },

  /* ------------------------------------------------ 2 · Powercube 2.7 */
  {
    productKey: 'trontek-tk25100',
    slug: 'trontek-powercube-2-7-tk25100',
    // Draft, and it must stay one until it is priced. Section 8 of its document
    // reads "MRP ₹ [insert]" and "Selling price ₹ [insert]".
    status: 'draft',
    brand: 'TRONTEK',
    title: 'Powercube 2.7 Home Battery Storage',
    subtitle: 'Lithium Iron Phosphate inverter / home energy storage battery',
    modelName: 'TK25100 (25.6V/105Ah)',
    productType: null,
    genericName: 'Lithium Iron Phosphate inverter / home energy storage battery',
    netQuantity: '1 Count',
    category: 'batteries',
    subcategory: 'lithium',
    art: 'battery',
    countryOfOrigin: 'India',
    description: [
      'The Trontek Powercube 2.7 is a residential energy storage system that acts as a power source, stores excess electricity generation, helps go off-grid, lowers power cost, minimises power loss, fulfils peak power demand and improves the home power network. Connect it to an existing photovoltaic system or install a new one with a hybrid inverter to become energy independent. The built-in intelligent BMS protects and monitors the lithium pack for prolonged cyclic life. Trontek is an established Indian battery manufacturer with 1 GWh production capacity, in-house R&D and testing.',
    ],
    highlights: [
      'High safety standard LFP (LiFePO4) cell chemistry',
      'Intelligent BMS — over-charge, over-discharge, over-current, short-circuit and over-temperature protection',
      'Long-life design supported by efficient cell equalization technology',
      'Compact wall/floor-mount design, easy installation',
      'Works with an existing photovoltaic system or a new hybrid inverter',
      '>4000 cycles at 80% DOD; 12-year design life at 35°C',
    ],
    boxContents: [],
    careInstructions: null,
    // "Warranty period: [insert Trontek warranty terms]".
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: HSN,
    taxRate: GST,
    facets: { batteryAh: 105, voltage: 25.6, technology: 'LiFePO4' },
    badges: [],
    popularityRank: 2,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [
      {
        variantKey: 'default',
        sku: 'TRN-TK25100',
        title: '',
        optionValues: {},
        mrp: null,
        selling: null,
        stock: null,
        availability: 'in-stock',
      },
    ],
    specGroups: [
      {
        title: 'Technical specifications',
        specs: [
          { label: 'Model', value: 'TK25100' },
          { label: 'Type', value: '25.6V / 105Ah' },
          { label: 'Rated voltage', value: '25.6 V' },
          { label: 'Rated capacity (0.5CA)', value: '105 Ah' },
          { label: 'Energy', value: '2.688 kWh' },
          { label: 'Cell configuration', value: '8S1P' },
          { label: 'Cell voltage', value: '3.2 V' },
          { label: 'Voltage range', value: '21.6 – 29.2 V ±0.2 V' },
          { label: 'Charging voltage', value: '29.2 V ±0.2 V' },
          { label: 'Charging mode', value: 'CC/CV' },
          { label: 'Ah efficiency', value: '>95%' },
          { label: 'Max. charge current', value: '0.5C (≈52.5 A)' },
          { label: 'Max. discharge current', value: '1C (≈105 A)' },
          { label: 'Design life @35°C (Class I & II area)', value: '12 years' },
          {
            label: 'Cycle life (80% DOD, 25°C, 0.5C charge / 0.5C discharge)',
            value: '>4000 cycles',
          },
          { label: 'Charging temperature', value: '0°C to +45°C' },
          { label: 'Discharging temperature', value: '−10°C to +60°C' },
          {
            label: 'Storage temperature & time',
            value: '1 year @20°C / 6 months @30°C / 3 months @40°C',
          },
          { label: 'Protection class', value: 'IP20' },
        ],
      },
      {
        title: 'Size and weight',
        specs: [
          { label: 'Dimensions (L × W × H)', value: '362 × 132 × 354 mm (±2 mm)' },
          { label: 'In centimetres', value: '36.2 × 13.2 × 35.4 cm' },
          { label: 'Net weight', value: '20.4 kg' },
          { label: 'Shipping weight', value: '24.4 kg (net + 4 kg packaging)' },
        ],
      },
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK®' },
          { label: 'Product name', value: 'Powercube 2.7 Home Battery Storage' },
          { label: 'Model name', value: 'TK25100 (25.6V/105Ah)' },
          {
            label: 'Generic name',
            value: 'Lithium Iron Phosphate inverter / home energy storage battery',
          },
          { label: 'Battery cell composition', value: 'Lithium Iron Phosphate (LiFePO4 / LFP)' },
          { label: 'Voltage', value: '25.6 Volts' },
          { label: 'Battery capacity', value: '105 Ah (2.688 kWh)' },
          { label: 'Number of batteries', value: '1 × 24V battery required' },
          {
            label: 'Recommended uses',
            value:
              'Residential energy storage with hybrid / solar / lithium-compatible inverters; home backup power; storing excess PV generation; peak-demand supply; off-grid use',
          },
          {
            label: 'Inverter compatibility',
            value:
              'Lithium-ready inverters with 24V battery input and 29.2V charging profile; compatible with major inverter brands',
          },
          { label: 'Installation', value: 'Wall or floor mounted (indoor, IP20)' },
          { label: 'Colour', value: 'White with black display strip' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8507 60 00 (lithium-ion accumulators)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Will this work with my existing inverter?',
        answer:
          'Yes, if your inverter supports lithium (LFP) batteries with a 24V battery input and a 29.2V charging voltage. Most modern hybrid and "lithium-ready" inverters do. Older lead-acid-only inverters need a lithium charging profile or a compatible replacement.',
      },
      {
        question: 'How is this different from a lead-acid / tubular inverter battery?',
        answer:
          'LFP delivers 4000+ cycles versus roughly 800–1200 for tubular, 80–100% usable depth of discharge versus about 50%, around one-third the weight, no water topping, no acid fumes and faster charging. Upfront cost is higher; cost per cycle is lower.',
      },
      {
        question: 'How long will it run my home?',
        answer:
          'The battery stores 2.688 kWh. Divide by your load. Example: 300 W of fans, lights and Wi-Fi runs for about 8 hours at ~90% usable capacity.',
      },
      {
        question: 'Does it need maintenance?',
        answer:
          'No. There is no water topping, terminal cleaning or venting. The built-in BMS handles balancing and protection.',
      },
      {
        question: 'Is it safe to use indoors?',
        answer:
          'Yes. LFP is the most thermally stable lithium chemistry and the BMS protects against over-charge, over-discharge, over-current, short-circuit and over-temperature. The unit is IP20, so install indoors in a ventilated spot away from water.',
      },
      {
        question: 'Can I add a second battery later?',
        answer:
          'Check with the seller before paralleling; packs must be the same model and firmware. Never mix with lead-acid or other lithium brands.',
      },
      {
        question: 'What is the warranty and expected life?',
        // The source ends "Warranty period: [insert Trontek warranty terms]".
        // The placeholder is dropped rather than reproduced on a public page;
        // the sentence before it is a design-life statement and stands alone.
        answer: 'Design life of 12 years at 35°C and more than 4000 cycles at 80% DOD.',
      },
      {
        question: 'What happens to the battery at end of life?',
        answer:
          "It is recyclable. Return it through the seller's take-back programme under the Battery Waste Management Rules, 2022. Never dispose of it in household waste.",
      },
    ],
    sections: [
      {
        kind: 'charging',
        summary: '',
        points: [
          { label: 'Charging voltage', value: '29.2 V ±0.2 V' },
          { label: 'Charging mode', value: 'CC/CV' },
          { label: 'Max. charge current', value: '0.5C (≈52.5 A)' },
          { label: 'Charging temperature', value: '0°C to +45°C' },
          { label: 'Ah efficiency', value: '>95%' },
        ],
      },
      {
        kind: 'discharge',
        summary: '',
        points: [
          { label: 'Max. discharge current', value: '1C (≈105 A)' },
          { label: 'Discharging temperature', value: '−10°C to +60°C' },
          { label: 'Cycle life', value: '>4000 cycles at 80% DOD, 25°C' },
          { label: 'Design life at 35°C', value: '12 years' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          'Lithium-ready inverters with 24V battery input and 29.2V charging profile; compatible with major inverter brands',
          'Wall or floor mounted (indoor, IP20)',
          'Check with the seller before paralleling; packs must be the same model and firmware. Never mix with lead-acid or other lithium brands.',
        ],
      },
      {
        kind: 'care',
        items: [
          'There is no water topping, terminal cleaning or venting. The built-in BMS handles balancing and protection.',
          'The unit is IP20, so install indoors in a ventilated spot away from water.',
          'Storage: 1 year @20°C / 6 months @30°C / 3 months @40°C.',
        ],
      },
    ],
    media: mediaFor('Powercube_2.7_TK25100', 'Trontek Powercube 2.7 (TK25100)'),
  },
];
