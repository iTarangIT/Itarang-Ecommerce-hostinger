import type { ProductSeed } from '../../src/lib/products/seed-types.ts';
import {
  CHOGORI_PIN_GROUP,
  EV_KEY_FEATURES,
  EV_SAFETY_GROUP,
  EV_SHARED_FAQS,
  GST,
  HSN,
  bmsGroup,
  evCare,
  mediaFor,
} from './trontek-shared.ts';

/**
 * The six LiEV traction packs — five 2-wheeler, one 3-wheeler.
 *
 * Transcribed from the six `Trontek_LiEV_*_Product_Listing.docx` sheets.
 *
 * Three transcription decisions worth stating, all of which follow from the
 * rules in `seed-types.ts`:
 *
 * **Warranty.** Only TK LiEV-51105 states one ("3 years or 1200 cycles,
 * whichever is earlier", in its product-details table). The other five say
 * `[insert Trontek warranty terms — typically expressed in months or cycles]`
 * and therefore carry `null`, and their pages show no warranty at all. Their
 * supplied artwork does say "3 years or 1200 cycles"; a marketing image is not
 * a warranty document, so it is not used as one.
 *
 * **No "Recommended applications" section.** Every EV document gives its
 * recommended use as one prose sentence, not as a set of use cases. Splitting
 * that into four titled cards would be writing copy, not transcribing it, so
 * the sentence is kept verbatim as a specification row and the applications
 * section is left for the admin to fill with real copy.
 *
 * **No "How long it will run" section.** The range figures in each document's
 * FAQ 2 ("roughly 82–119 km") are estimates derived from an assumed
 * consumption per kilometre. They stay in the FAQ, where the source put them
 * and where they read as an estimate — they are not promoted into a headline
 * table.
 */

export const TRONTEK_EV_PRODUCTS: ProductSeed[] = [
  /* -------------------------------------------- 3 · TK-LiFe-5145 · 51V 45Ah */
  {
    productKey: 'trontek-tk-life-5145',
    slug: 'trontek-liev-tk-life-5145',
    status: 'published',
    brand: 'TRONTEK',
    title: 'Trontek LiEV LiFePO4 EV Battery 51V 45Ah (2.3 kWh)',
    subtitle: 'Lithium Iron Phosphate (LiFePO4) EV battery pack',
    modelName: 'TK-LiFe-5145 (51V / 45Ah)',
    genericName: 'Lithium Iron Phosphate (LiFePO4) EV battery pack',
    productType: 'Electric vehicle traction battery pack (lithium iron phosphate)',
    netQuantity: '1 Count',
    category: 'batteries',
    subcategory: 'ev-2-wheeler',
    art: 'battery',
    countryOfOrigin: 'India',
    description: [
      'The Trontek TK-LiFe-5145 is a 51V 45Ah (2.29 kWh) lithium iron phosphate traction battery built for electric 2-wheelers. LFP chemistry gives the safest lithium option on the road — no thermal runaway, no fire on puncture or short — with 2000+ cycle life and steady output voltage across the full discharge. The pack is optimised by its battery management system (BMS), which monitors every cell to protect against over-charge, over-discharge, over-current and short circuit, and balances cells independently for safe and accurate operation. Trontek is an established Indian battery manufacturer with 1 GWh production capacity and in-house R&D and testing.',
    ],
    highlights: EV_KEY_FEATURES,
    boxContents: [],
    careInstructions: null,
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: HSN,
    taxRate: GST,
    facets: { batteryAh: 45, voltage: 51, technology: 'LiFePO4' },
    badges: [],
    popularityRank: 3,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [
      {
        variantKey: 'default',
        sku: 'TRN-TKLIFE5145',
        title: '',
        optionValues: {},
        mrp: 5_737_500,
        selling: 4_131_000,
        stock: null,
        availability: 'in-stock',
      },
    ],
    specGroups: [
      {
        title: 'Electrical characteristics',
        specs: [
          { label: 'Model', value: 'TK-LiFe-5145' },
          { label: 'Nominal voltage', value: '51 V' },
          { label: 'Nominal capacity', value: '45 Ah' },
          { label: 'Battery pack energy', value: '2.29 kWh (2295 Wh)' },
          { label: 'Impedance (max. at 1000 Hz)', value: '≤ 15 mΩ' },
          { label: 'Expected cycle life', value: '2000 cycles at 0.5C, 25°C, within operating range' },
        ],
      },
      {
        title: 'Operation conditions',
        specs: [
          { label: 'Charge method', value: 'Constant Current / Constant Voltage (CC-CV)' },
          { label: 'Max. charge voltage', value: '57.6 V' },
          { label: 'Standard charge current', value: '0.3C (≈13.5 A)' },
          { label: 'Max. charge current', value: '0.5C (≈22.5 A)' },
          { label: 'Continuous discharge current', value: '45 A (max. 1.5C)' },
          { label: 'Peak instant discharge current', value: '90 A' },
          { label: 'Peak instant discharge time', value: '5 s' },
          { label: 'Discharge cut-off voltage', value: '44.8 V' },
          { label: 'Discharge temperature', value: '−20°C to 60°C' },
          { label: 'Storage temperature', value: '15°C to 35°C' },
        ],
      },
      {
        title: 'Mechanical characteristics',
        specs: [
          { label: 'Height', value: '356 ±2 mm' },
          { label: 'Width', value: '165 ±2 mm' },
          { label: 'Length', value: '230 ±2 mm' },
          { label: 'Dimensions (L × W × H)', value: '230 × 165 × 356 mm (±2 mm)' },
          { label: 'Net weight', value: '~20 kg' },
          { label: 'Shipping weight', value: '~24.00 kg (net + 4 kg packaging)' },
        ],
      },
      bmsGroup({
        overChargeDetection: '3.6 ±0.025 V',
        overChargeRelease: '3.5 ±0.025 V',
        maxChargeVoltage: '3.6 ±0.05 V',
        standardChargeCurrent: '≤ 45 A',
        overDischargeDetection: '2.8 ±0.025 V',
        overDischargeDelay: '≤ 115 – 173 ms',
        overDischargeRelease: '2.9 ±0.01 V',
        overCurrentDetection: '121 ±30 A',
        overCurrentDelay: '32 ±16 ms',
        maxContinuousCurrent: '≤ 90 A',
        shortCircuitDetection: 'Exterior short circuit (850 A)',
      }),
      EV_SAFETY_GROUP,
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK® (LiEV / Lithium Ferro series)' },
          { label: 'Category', value: '2-Wheeler Lithium Battery / EV Battery' },
          { label: 'Battery cell composition', value: 'Lithium Iron Phosphate (LiFePO4 / LFP)' },
          { label: 'Number of batteries', value: '1 × battery pack' },
          {
            label: 'Recommended uses',
            value:
              'Electric 2-wheelers (scooters / motorcycles) and light EVs running on a 48VV system; OEM replacement or retrofit with compatible controller and charger',
          },
          { label: 'Compatibility', value: '48VV EV drivetrain with 57.6V charging profile' },
          { label: 'Connector', value: 'Top-mounted connector with buzzer and breather' },
          {
            label: 'Enclosure',
            value: 'Extruded aluminium enclosure with handle, buzzer and breather valve',
          },
          { label: 'Colour', value: 'Grey/black enclosure' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8507 60 00 (lithium-ion accumulators)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which electric 2-wheelers is this battery compatible with?',
        answer:
          'Any 48VV-system electric scooter or motorcycle whose controller accepts a 51V nominal LFP pack with a 57.6V charge voltage and 44.8V cut-off. Confirm connector type (Top-mounted connector with buzzer and breather) and charger rating with iTarang before purchase; controller and charger must match.',
      },
      {
        question: 'What range will I get?',
        answer:
          'The pack stores 2.29 kWh. A typical e-scooter consumes 25–35 Wh/km, so expect roughly 66–92 km per full charge depending on rider weight, speed, terrain and motor rating.',
      },
      {
        question: 'How long does it take to charge?',
        answer:
          'At the standard charge current (0.3C (≈13.5 A)) a full charge from cut-off takes about 3.5–4 hours. Use only a Trontek-approved LFP charger with a 57.6V CC-CV profile; a lead-acid charger will damage the pack.',
      },
      ...EV_SHARED_FAQS.slice(0, 2),
      {
        question: 'Can I use it in hot Indian summers and in the rain?',
        answer:
          "Discharge is rated −20°C to 60°C; the BMS throttles or cuts charging outside safe limits. Extruded aluminium enclosure with handle, buzzer and breather valve — mount inside the vehicle's battery compartment and keep the connector dry. Store between 15°C and 35°C.",
      },
      ...EV_SHARED_FAQS.slice(2),
    ],
    sections: [
      {
        kind: 'charging',
        summary:
          'At the standard charge current (0.3C (≈13.5 A)) a full charge from cut-off takes about 3.5–4 hours. Use only a Trontek-approved LFP charger with a 57.6V CC-CV profile; a lead-acid charger will damage the pack.',
        points: [
          { label: 'Charge method', value: 'Constant Current / Constant Voltage (CC-CV)' },
          { label: 'Max. charge voltage', value: '57.6 V' },
          { label: 'Standard charge current', value: '0.3C (≈13.5 A)' },
          { label: 'Max. charge current', value: '0.5C (≈22.5 A)' },
        ],
      },
      {
        kind: 'discharge',
        summary: '',
        points: [
          { label: 'Continuous discharge current', value: '45 A (max. 1.5C)' },
          { label: 'Peak instant discharge current', value: '90 A' },
          { label: 'Peak instant discharge time', value: '5 s' },
          { label: 'Discharge cut-off voltage', value: '44.8 V' },
          { label: 'Discharge temperature', value: '−20°C to 60°C' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '48VV EV drivetrain with 57.6V charging profile',
          'Connector: Top-mounted connector with buzzer and breather',
          'Electric 2-wheelers (scooters / motorcycles) and light EVs running on a 48VV system; OEM replacement or retrofit with compatible controller and charger',
        ],
      },
      {
        kind: 'care',
        items: evCare('Extruded aluminium enclosure with handle, buzzer and breather valve'),
      },
    ],
    media: mediaFor('LiEV_51V_45Ah_TK-LiFe-5145', 'Trontek LiEV 51V 45Ah (TK-LiFe-5145)'),
  },

  /* --------------------------------------- 4 · TK-LiFe-6130 (V2) · 61V 30Ah */
  {
    productKey: 'trontek-tk-life-6130-v2',
    slug: 'trontek-liev-tk-life-6130-v2',
    status: 'published',
    brand: 'TRONTEK',
    title: 'Trontek LiEV LiFePO4 EV Battery 61V 30Ah (1.83 kWh)',
    subtitle: 'Lithium Iron Phosphate (LiFePO4) EV battery pack',
    modelName: 'TK-LiFe-6130 (V2) (61V / 30Ah)',
    genericName: 'Lithium Iron Phosphate (LiFePO4) EV battery pack',
    productType: 'Electric vehicle traction battery pack (lithium iron phosphate)',
    netQuantity: '1 Count',
    category: 'batteries',
    subcategory: 'ev-2-wheeler',
    art: 'battery',
    countryOfOrigin: 'India',
    description: [
      'The Trontek TK-LiFe-6130 (V2) is a 61V 30Ah (1.83 kWh) lithium iron phosphate traction battery built for electric 2-wheelers. LFP chemistry gives the safest lithium option on the road — no thermal runaway, no fire on puncture or short — with 2000+ cycle life and steady output voltage across the full discharge. The pack is optimised by its battery management system (BMS), which monitors every cell to protect against over-charge, over-discharge, over-current and short circuit, and balances cells independently for safe and accurate operation. Trontek is an established Indian battery manufacturer with 1 GWh production capacity and in-house R&D and testing.',
    ],
    highlights: EV_KEY_FEATURES,
    boxContents: [],
    careInstructions: null,
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: HSN,
    taxRate: GST,
    facets: { batteryAh: 30, voltage: 61, technology: 'LiFePO4' },
    badges: [],
    popularityRank: 4,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [
      {
        variantKey: 'default',
        sku: 'TRN-TKLIFE6130V2',
        title: '',
        optionValues: {},
        mrp: 4_575_000,
        selling: 3_294_000,
        stock: null,
        availability: 'in-stock',
      },
    ],
    specGroups: [
      {
        title: 'Electrical characteristics',
        specs: [
          { label: 'Model', value: 'TK-LiFe-6130 (V2)' },
          { label: 'Nominal voltage', value: '61 V' },
          { label: 'Nominal capacity', value: '30 Ah' },
          { label: 'Battery pack energy', value: '1.83 kWh (1830 Wh)' },
          { label: 'Impedance (max. at 1000 Hz)', value: '≤ 50 mΩ' },
          { label: 'Expected cycle life', value: '2000 cycles at 0.5C, 25°C, within operating range' },
        ],
      },
      {
        title: 'Operation conditions',
        specs: [
          { label: 'Charge method', value: 'Constant Current / Constant Voltage (CC-CV)' },
          { label: 'Max. charge voltage', value: '69.35 V' },
          { label: 'Standard charge current', value: '10 A' },
          { label: 'Max. charge current', value: '12 A' },
          { label: 'Continuous discharge current', value: '30 A' },
          { label: 'Peak instant discharge current', value: '60 A' },
          { label: 'Peak instant discharge time', value: '10 s' },
          { label: 'Discharge cut-off voltage', value: '53 V' },
          { label: 'Discharge temperature', value: '−20°C to 60°C' },
          { label: 'Storage temperature', value: '15°C to 35°C' },
        ],
      },
      {
        title: 'Mechanical characteristics',
        specs: [
          { label: 'Height', value: '359 ±2 mm' },
          { label: 'Width', value: '165 ±2 mm' },
          { label: 'Length', value: '230 ±2 mm' },
          { label: 'Dimensions (L × W × H)', value: '230 × 165 × 359 mm (±2 mm)' },
          { label: 'Net weight', value: '~16.75 kg' },
          { label: 'Shipping weight', value: '~20.75 kg (net + 4 kg packaging)' },
        ],
      },
      bmsGroup({
        overChargeDetection: '3.65 ±0.025 V',
        overChargeRelease: '3.5 ±0.025 V',
        maxChargeVoltage: '3.65 ±0.05 V',
        standardChargeCurrent: '≤ 10 A',
        overDischargeDetection: '2.65 ±0.025 V',
        overDischargeDelay: '0.5 – 1.5 s',
        overDischargeRelease: '2.9 ±0.025 V',
        overCurrentDetection: '121 ±30 A',
        overCurrentDelay: '200 ms',
        maxContinuousCurrent: '≤ 64 A',
        shortCircuitDetection: 'Exterior short circuit (333 A)',
      }),
      EV_SAFETY_GROUP,
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK® (LiEV / Lithium Ferro series)' },
          { label: 'Category', value: '2-Wheeler Lithium Battery / EV Battery' },
          { label: 'Battery cell composition', value: 'Lithium Iron Phosphate (LiFePO4 / LFP)' },
          { label: 'Number of batteries', value: '1 × battery pack' },
          {
            label: 'Recommended uses',
            value:
              'Electric 2-wheelers (scooters / motorcycles) and light EVs running on a 60VV system; OEM replacement or retrofit with compatible controller and charger',
          },
          { label: 'Compatibility', value: '60VV EV drivetrain with 69.35V charging profile' },
          { label: 'Connector', value: 'Front-mounted connector on top cover' },
          { label: 'Enclosure', value: 'Extruded aluminium enclosure with top cover and handle' },
          { label: 'Colour', value: 'Blue enclosure' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8507 60 00 (lithium-ion accumulators)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which electric 2-wheelers is this battery compatible with?',
        answer:
          'Any 60VV-system electric scooter or motorcycle whose controller accepts a 61V nominal LFP pack with a 69.35V charge voltage and 53V cut-off. Confirm connector type (Front-mounted connector on top cover) and charger rating with iTarang before purchase; controller and charger must match.',
      },
      {
        question: 'What range will I get?',
        answer:
          'The pack stores 1.83 kWh. A typical e-scooter consumes 25–35 Wh/km, so expect roughly 52–73 km per full charge depending on rider weight, speed, terrain and motor rating.',
      },
      {
        question: 'How long does it take to charge?',
        answer:
          'At the standard charge current (10 A) a full charge from cut-off takes about 3–3.5 hours. Use only a Trontek-approved LFP charger with a 69.35V CC-CV profile; a lead-acid charger will damage the pack.',
      },
      ...EV_SHARED_FAQS.slice(0, 2),
      {
        question: 'Can I use it in hot Indian summers and in the rain?',
        answer:
          "Discharge is rated −20°C to 60°C; the BMS throttles or cuts charging outside safe limits. Extruded aluminium enclosure with top cover and handle — mount inside the vehicle's battery compartment and keep the connector dry. Store between 15°C and 35°C.",
      },
      ...EV_SHARED_FAQS.slice(2),
    ],
    sections: [
      {
        kind: 'charging',
        summary:
          'At the standard charge current (10 A) a full charge from cut-off takes about 3–3.5 hours. Use only a Trontek-approved LFP charger with a 69.35V CC-CV profile; a lead-acid charger will damage the pack.',
        points: [
          { label: 'Charge method', value: 'Constant Current / Constant Voltage (CC-CV)' },
          { label: 'Max. charge voltage', value: '69.35 V' },
          { label: 'Standard charge current', value: '10 A' },
          { label: 'Max. charge current', value: '12 A' },
        ],
      },
      {
        kind: 'discharge',
        summary: '',
        points: [
          { label: 'Continuous discharge current', value: '30 A' },
          { label: 'Peak instant discharge current', value: '60 A' },
          { label: 'Peak instant discharge time', value: '10 s' },
          { label: 'Discharge cut-off voltage', value: '53 V' },
          { label: 'Discharge temperature', value: '−20°C to 60°C' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '60VV EV drivetrain with 69.35V charging profile',
          'Connector: Front-mounted connector on top cover',
          'Electric 2-wheelers (scooters / motorcycles) and light EVs running on a 60VV system; OEM replacement or retrofit with compatible controller and charger',
        ],
      },
      { kind: 'care', items: evCare('Extruded aluminium enclosure with top cover and handle') },
    ],
    media: mediaFor('LiEV_61V_30Ah_TK-LiFe-6130V2', 'Trontek LiEV 61V 30Ah (TK-LiFe-6130 V2)'),
  },

  /* ------------------------------- 5 · TK-LiFe-6130 Metal Top · 60.8V 30Ah */
  {
    productKey: 'trontek-tk-life-6130-metal-top',
    slug: 'trontek-liev-tk-life-6130-metal-top',
    status: 'published',
    brand: 'TRONTEK',
    title: 'Trontek LiEV LiFePO4 EV Battery 60.8V 30Ah (1.82 kWh)',
    subtitle: 'Lithium Iron Phosphate (LiFePO4) EV battery pack',
    modelName: 'TK-LiFe-6130 (Metal Top Cover) (60.8V / 30Ah)',
    genericName: 'Lithium Iron Phosphate (LiFePO4) EV battery pack',
    productType: 'Electric vehicle traction battery pack (lithium iron phosphate)',
    netQuantity: '1 Count',
    category: 'batteries',
    subcategory: 'ev-2-wheeler',
    art: 'battery',
    countryOfOrigin: 'India',
    description: [
      'The Trontek TK-LiFe-6130 (Metal Top Cover) is a 60.8V 30Ah (1.82 kWh) lithium iron phosphate traction battery built for electric 2-wheelers. LFP chemistry gives the safest lithium option on the road — no thermal runaway, no fire on puncture or short — with 2000+ cycle life and steady output voltage across the full discharge. The pack is optimised by its battery management system (BMS), which monitors every cell to protect against over-charge, over-discharge, over-current and short circuit, and balances cells independently for safe and accurate operation. Trontek is an established Indian battery manufacturer with 1 GWh production capacity and in-house R&D and testing.',
    ],
    highlights: EV_KEY_FEATURES,
    boxContents: [],
    careInstructions: null,
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: HSN,
    taxRate: GST,
    facets: { batteryAh: 30, voltage: 60.8, technology: 'LiFePO4' },
    badges: [],
    popularityRank: 5,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [
      {
        variantKey: 'default',
        sku: 'TRN-TKLIFE6130MT',
        title: '',
        optionValues: {},
        mrp: 4_560_000,
        selling: 3_283_200,
        stock: null,
        availability: 'in-stock',
      },
    ],
    specGroups: [
      {
        title: 'Electrical characteristics',
        specs: [
          { label: 'Model', value: 'TK-LiFe-6130 (Metal Top Cover)' },
          { label: 'Nominal voltage', value: '60.8 V' },
          { label: 'Nominal capacity', value: '30 Ah' },
          { label: 'Battery pack energy', value: '1.82 kWh (1824 Wh)' },
          { label: 'Impedance (max. at 1000 Hz)', value: '≤ 50 mΩ' },
          { label: 'Expected cycle life', value: '2000 cycles at 0.5C, 25°C, within operating range' },
        ],
      },
      {
        title: 'Operation conditions',
        specs: [
          { label: 'Charge method', value: 'Constant Current / Constant Voltage (CC-CV)' },
          { label: 'Max. charge voltage', value: '69.35 V' },
          { label: 'Standard charge current', value: '10 A' },
          { label: 'Max. charge current', value: '12 A' },
          { label: 'Continuous discharge current', value: '15 A' },
          { label: 'Peak instant discharge current', value: '30 A' },
          { label: 'Peak instant discharge time', value: '10 s' },
          { label: 'Discharge cut-off voltage', value: '53 V' },
          { label: 'Discharge temperature', value: '−20°C to 60°C' },
          { label: 'Storage temperature', value: '15°C to 35°C' },
        ],
      },
      {
        title: 'Mechanical characteristics',
        specs: [
          { label: 'Height', value: '306 ±2 mm' },
          { label: 'Width', value: '165 ±2 mm' },
          { label: 'Length', value: '230 ±2 mm' },
          { label: 'Dimensions (L × W × H)', value: '230 × 165 × 306 mm (±2 mm)' },
          { label: 'Net weight', value: '~16.75 kg' },
          { label: 'Shipping weight', value: '~20.75 kg (net + 4 kg packaging)' },
        ],
      },
      bmsGroup({
        overChargeDetection: '3.65 ±0.025 V',
        overChargeRelease: '3.6 ±0.025 V',
        maxChargeVoltage: '3.65 ±0.05 V',
        standardChargeCurrent: '≤ 10 A',
        overDischargeDetection: '2.65 ±0.025 V',
        overDischargeDelay: '0.5 – 1.5 s',
        overDischargeRelease: '2.9 ±0.025 V',
        overCurrentDetection: '121 ±30 A',
        overCurrentDelay: '200 ms',
        maxContinuousCurrent: '≤ 64 A',
        shortCircuitDetection: 'Exterior short circuit (333 A)',
      }),
      EV_SAFETY_GROUP,
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK® (LiEV / Lithium Ferro series)' },
          { label: 'Category', value: '2-Wheeler Lithium Battery / EV Battery' },
          { label: 'Battery cell composition', value: 'Lithium Iron Phosphate (LiFePO4 / LFP)' },
          { label: 'Number of batteries', value: '1 × battery pack' },
          {
            label: 'Recommended uses',
            value:
              'Electric 2-wheelers (scooters / motorcycles) and light EVs running on a 60VV system; OEM replacement or retrofit with compatible controller and charger',
          },
          { label: 'Compatibility', value: '60VV EV drivetrain with 69.35V charging profile' },
          { label: 'Connector', value: 'PG-7 cable glands on metal top cover' },
          {
            label: 'Enclosure',
            value:
              'Extruded aluminium enclosure with metal top cover, handle, PG-7 glands and pressure vent',
          },
          { label: 'Colour', value: 'Grey metal enclosure' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8507 60 00 (lithium-ion accumulators)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which electric 2-wheelers is this battery compatible with?',
        answer:
          'Any 60VV-system electric scooter or motorcycle whose controller accepts a 60.8V nominal LFP pack with a 69.35V charge voltage and 53V cut-off. Confirm connector type (PG-7 cable glands on metal top cover) and charger rating with iTarang before purchase; controller and charger must match.',
      },
      {
        question: 'What range will I get?',
        answer:
          'The pack stores 1.82 kWh. A typical e-scooter consumes 25–35 Wh/km, so expect roughly 52–73 km per full charge depending on rider weight, speed, terrain and motor rating.',
      },
      {
        question: 'How long does it take to charge?',
        answer:
          'At the standard charge current (10 A) a full charge from cut-off takes about 3–3.5 hours. Use only a Trontek-approved LFP charger with a 69.35V CC-CV profile; a lead-acid charger will damage the pack.',
      },
      ...EV_SHARED_FAQS.slice(0, 2),
      {
        question: 'Can I use it in hot Indian summers and in the rain?',
        answer:
          "Discharge is rated −20°C to 60°C; the BMS throttles or cuts charging outside safe limits. Extruded aluminium enclosure with metal top cover, handle, PG-7 glands and pressure vent — mount inside the vehicle's battery compartment and keep the connector dry. Store between 15°C and 35°C.",
      },
      ...EV_SHARED_FAQS.slice(2),
    ],
    sections: [
      {
        kind: 'charging',
        summary:
          'At the standard charge current (10 A) a full charge from cut-off takes about 3–3.5 hours. Use only a Trontek-approved LFP charger with a 69.35V CC-CV profile; a lead-acid charger will damage the pack.',
        points: [
          { label: 'Charge method', value: 'Constant Current / Constant Voltage (CC-CV)' },
          { label: 'Max. charge voltage', value: '69.35 V' },
          { label: 'Standard charge current', value: '10 A' },
          { label: 'Max. charge current', value: '12 A' },
        ],
      },
      {
        kind: 'discharge',
        summary: '',
        points: [
          { label: 'Continuous discharge current', value: '15 A' },
          { label: 'Peak instant discharge current', value: '30 A' },
          { label: 'Peak instant discharge time', value: '10 s' },
          { label: 'Discharge cut-off voltage', value: '53 V' },
          { label: 'Discharge temperature', value: '−20°C to 60°C' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '60VV EV drivetrain with 69.35V charging profile',
          'Connector: PG-7 cable glands on metal top cover',
          'Electric 2-wheelers (scooters / motorcycles) and light EVs running on a 60VV system; OEM replacement or retrofit with compatible controller and charger',
        ],
      },
      {
        kind: 'care',
        items: evCare(
          'Extruded aluminium enclosure with metal top cover, handle, PG-7 glands and pressure vent',
        ),
      },
    ],
    media: mediaFor(
      'LiEV_60.8V_30Ah_TK-LiFe-6130_MetalTop',
      'Trontek LiEV 60.8V 30Ah (TK-LiFe-6130 Metal Top)',
    ),
  },

  /* ------------------------------------- 6 · TK-LiFe-6145 · 60.8V 45Ah CAN */
  {
    productKey: 'trontek-tk-life-6145',
    slug: 'trontek-liev-tk-life-6145',
    status: 'published',
    brand: 'TRONTEK',
    title: 'Trontek LiEV LiFePO4 EV Battery 61V 45Ah (2.74 kWh)',
    subtitle: 'Lithium Iron Phosphate (LiFePO4) EV battery pack',
    modelName: 'TK-LiFe-6145 (60.8V / 45Ah)',
    genericName: 'Lithium Iron Phosphate (LiFePO4) EV battery pack',
    productType: 'Electric vehicle traction battery pack (lithium iron phosphate)',
    netQuantity: '1 Count',
    category: 'batteries',
    subcategory: 'ev-2-wheeler',
    art: 'battery',
    countryOfOrigin: 'India',
    description: [
      'The Trontek TK-LiFe-6145 is a 60.8V 45Ah (2.74 kWh) lithium iron phosphate traction battery built for electric 2-wheelers. LFP chemistry gives the safest lithium option on the road — no thermal runaway, no fire on puncture or short — with 2000+ cycle life and steady output voltage across the full discharge. The pack is optimised by its battery management system (BMS), which monitors every cell to protect against over-charge, over-discharge, over-current and short circuit, and balances cells independently for safe and accurate operation. Trontek is an established Indian battery manufacturer with 1 GWh production capacity and in-house R&D and testing.',
    ],
    highlights: EV_KEY_FEATURES,
    boxContents: [],
    careInstructions: null,
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: HSN,
    taxRate: GST,
    // 60.8 V, as the specification and the "Voltage" row both state. The title
    // and product name in the same document say 61V; the discrepancy is
    // reproduced rather than resolved, and the facet follows the spec table
    // because that is the figure the energy calculation uses.
    facets: { batteryAh: 45, voltage: 60.8, technology: 'LiFePO4' },
    badges: [],
    popularityRank: 6,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [
      {
        variantKey: 'default',
        sku: 'TRN-TKLIFE6145',
        title: '',
        optionValues: {},
        mrp: 6_840_000,
        selling: 4_924_800,
        stock: null,
        availability: 'in-stock',
      },
    ],
    specGroups: [
      {
        title: 'Electrical characteristics',
        specs: [
          { label: 'Model', value: 'TK-LiFe-6145' },
          { label: 'Nominal voltage', value: '60.8 V' },
          { label: 'Nominal capacity', value: '45 Ah' },
          { label: 'Battery pack energy', value: '2.74 kWh (2736 Wh)' },
          { label: 'CAN resistance', value: '< 60 kΩ' },
          { label: 'Expected cycle life', value: '2000 cycles at 0.5C, 25°C, within operating range' },
        ],
      },
      {
        title: 'Operation conditions',
        specs: [
          { label: 'Charge method', value: 'Constant Current / Constant Voltage (CC-CV)' },
          { label: 'Max. charge voltage', value: '69.35 V' },
          { label: 'Standard charge current', value: '10 A' },
          { label: 'Max. charge current', value: '12 A' },
          { label: 'Continuous discharge current', value: '25 A' },
          { label: 'Peak instant discharge current', value: '55 A' },
          { label: 'Peak instant discharge time', value: '3 s' },
          { label: 'Discharge cut-off voltage', value: '53.2 V' },
          { label: 'Discharge temperature', value: '−20°C to 60°C' },
          { label: 'Storage temperature', value: '15°C to 35°C' },
        ],
      },
      {
        title: 'Mechanical characteristics',
        specs: [
          { label: 'Height', value: '447 ±2 mm' },
          { label: 'Width', value: '165 ±2 mm' },
          { label: 'Length', value: '230 ±2 mm' },
          { label: 'Dimensions (L × W × H)', value: '230 × 165 × 447 mm (±2 mm)' },
          { label: 'Net weight', value: '~23.56 kg' },
          { label: 'Shipping weight', value: '~27.56 kg (net + 4 kg packaging)' },
        ],
      },
      bmsGroup({
        overChargeDetection: '3.65 ±0.025 V',
        overChargeRelease: '3.6 ±0.025 V',
        maxChargeVoltage: '3.65 ±0.05 V',
        standardChargeCurrent: '≤ 10 A',
        overDischargeDetection: '2.7 ±0.025 V',
        overDischargeDelay: '0.5 – 1.5 s',
        overDischargeRelease: '2.8 ±0.025 V',
        overCurrentDetection: '121 ±30 A',
        overCurrentDelay: '32 ±16 ms',
        maxContinuousCurrent: '≤ 55 A',
        shortCircuitDetection: 'Exterior short circuit (333 A)',
      }),
      CHOGORI_PIN_GROUP,
      EV_SAFETY_GROUP,
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK® (LiEV / Lithium Ferro series)' },
          { label: 'Category', value: '2-Wheeler Lithium Battery / EV Battery' },
          { label: 'Battery cell composition', value: 'Lithium Iron Phosphate (LiFePO4 / LFP)' },
          { label: 'Number of batteries', value: '1 × battery pack' },
          {
            label: 'Recommended uses',
            value:
              'Electric 2-wheelers (scooters / motorcycles) and light EVs running on a 60VV system; OEM replacement or retrofit with compatible controller and charger',
          },
          {
            label: 'Compatibility',
            value: '60VV EV drivetrain with 69.35V charging profile; CAN-enabled BMS communication',
          },
          { label: 'Connector', value: 'Chogori 6-pin connector (main +/−, CAN L/H, Switch 1/2)' },
          {
            label: 'Enclosure',
            value:
              'Extruded aluminium enclosure with top cover, handle, buzzer and pressure vent',
          },
          { label: 'Colour', value: 'Grey enclosure' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8507 60 00 (lithium-ion accumulators)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which electric 2-wheelers is this battery compatible with?',
        answer:
          'Any 60VV-system electric scooter or motorcycle whose controller accepts a 60.8V nominal LFP pack with a 69.35V charge voltage and 53.2V cut-off. Confirm connector type (Chogori 6-pin connector (main +/−, CAN L/H, Switch 1/2)) and charger rating with iTarang before purchase; controller and charger must match.',
      },
      {
        question: 'What range will I get?',
        answer:
          'The pack stores 2.74 kWh. A typical e-scooter consumes 25–35 Wh/km, so expect roughly 78–109 km per full charge depending on rider weight, speed, terrain and motor rating.',
      },
      {
        question: 'How long does it take to charge?',
        answer:
          'At the standard charge current (10 A) a full charge from cut-off takes about 4.5–5 hours. Use only a Trontek-approved LFP charger with a 69.35V CC-CV profile; a lead-acid charger will damage the pack.',
      },
      ...EV_SHARED_FAQS.slice(0, 2),
      {
        question: 'Can I use it in hot Indian summers and in the rain?',
        answer:
          "Discharge is rated −20°C to 60°C; the BMS throttles or cuts charging outside safe limits. Extruded aluminium enclosure with top cover, handle, buzzer and pressure vent — mount inside the vehicle's battery compartment and keep the connector dry. Store between 15°C and 35°C.",
      },
      ...EV_SHARED_FAQS.slice(2),
    ],
    sections: [
      {
        kind: 'charging',
        summary:
          'At the standard charge current (10 A) a full charge from cut-off takes about 4.5–5 hours. Use only a Trontek-approved LFP charger with a 69.35V CC-CV profile; a lead-acid charger will damage the pack.',
        points: [
          { label: 'Charge method', value: 'Constant Current / Constant Voltage (CC-CV)' },
          { label: 'Max. charge voltage', value: '69.35 V' },
          { label: 'Standard charge current', value: '10 A' },
          { label: 'Max. charge current', value: '12 A' },
        ],
      },
      {
        kind: 'discharge',
        summary: '',
        points: [
          { label: 'Continuous discharge current', value: '25 A' },
          { label: 'Peak instant discharge current', value: '55 A' },
          { label: 'Peak instant discharge time', value: '3 s' },
          { label: 'Discharge cut-off voltage', value: '53.2 V' },
          { label: 'Discharge temperature', value: '−20°C to 60°C' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '60VV EV drivetrain with 69.35V charging profile; CAN-enabled BMS communication',
          'Connector: Chogori 6-pin connector (main +/−, CAN L/H, Switch 1/2)',
          'Electric 2-wheelers (scooters / motorcycles) and light EVs running on a 60VV system; OEM replacement or retrofit with compatible controller and charger',
        ],
      },
      {
        kind: 'care',
        items: evCare(
          'Extruded aluminium enclosure with top cover, handle, buzzer and pressure vent',
        ),
      },
    ],
    media: mediaFor('LiEV_61V_45Ah_TK-LiFe-6145', 'Trontek LiEV 61V 45Ah (TK-LiFe-6145)'),
  },

  /* ------------------------------------ 7 · TK-LiFe-7332 · 73.6V 32Ah CAN */
  {
    productKey: 'trontek-tk-life-7332',
    slug: 'trontek-liev-tk-life-7332',
    status: 'published',
    brand: 'TRONTEK',
    title: 'Trontek LiEV LiFePO4 EV Battery 73.6V 32Ah (2.35 kWh)',
    subtitle: 'Lithium Iron Phosphate (LiFePO4) EV battery pack',
    modelName: 'TK-LiFe-7332 (73.6V / 32Ah)',
    genericName: 'Lithium Iron Phosphate (LiFePO4) EV battery pack',
    productType: 'Electric vehicle traction battery pack (lithium iron phosphate)',
    netQuantity: '1 Count',
    category: 'batteries',
    subcategory: 'ev-2-wheeler',
    art: 'battery',
    countryOfOrigin: 'India',
    description: [
      'The Trontek TK-LiFe-7332 is a 73.6V 32Ah (2.36 kWh) lithium iron phosphate traction battery built for electric 2-wheelers. LFP chemistry gives the safest lithium option on the road — no thermal runaway, no fire on puncture or short — with 2000+ cycle life and steady output voltage across the full discharge. The pack is optimised by its battery management system (BMS), which monitors every cell to protect against over-charge, over-discharge, over-current and short circuit, and balances cells independently for safe and accurate operation. Trontek is an established Indian battery manufacturer with 1 GWh production capacity and in-house R&D and testing.',
    ],
    highlights: EV_KEY_FEATURES,
    boxContents: [],
    careInstructions: null,
    warrantyMonths: null,
    warrantyCycles: null,
    warrantyText: null,
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: HSN,
    taxRate: GST,
    facets: { batteryAh: 32, voltage: 73.6, technology: 'LiFePO4' },
    badges: [],
    popularityRank: 7,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [
      {
        variantKey: 'default',
        sku: 'TRN-TKLIFE7332',
        title: '',
        optionValues: {},
        mrp: 5_888_000,
        selling: 4_239_400,
        stock: null,
        availability: 'in-stock',
      },
    ],
    specGroups: [
      {
        title: 'Electrical characteristics',
        specs: [
          { label: 'Model', value: 'TK-LiFe-7332' },
          { label: 'Nominal voltage', value: '73.6 V' },
          { label: 'Nominal capacity', value: '32 Ah' },
          { label: 'Battery pack energy', value: '2.36 kWh (2355.2 Wh)' },
          // Reproduced verbatim. The comparable row on TK-LiFe-6145 reads
          // "< 60 kΩ"; one of the two units is wrong and neither is corrected
          // here.
          { label: 'CAN resistance', value: '≤ 55 mΩ' },
          { label: 'Expected cycle life', value: '2000 cycles at 0.5C, 25°C, within operating range' },
        ],
      },
      {
        title: 'Operation conditions',
        specs: [
          { label: 'Charge method', value: 'Constant Current / Constant Voltage (CC-CV)' },
          { label: 'Max. charge voltage', value: '83.95 V' },
          { label: 'Standard charge current', value: '12 A' },
          { label: 'Max. charge current', value: '16 A' },
          { label: 'Continuous discharge current', value: '32 A' },
          { label: 'Peak instant discharge current', value: '64 A' },
          { label: 'Peak instant discharge time', value: '3 s' },
          { label: 'Discharge cut-off voltage', value: '60.95 V' },
          { label: 'Discharge temperature', value: '−20°C to 55°C' },
          { label: 'Storage temperature', value: '15°C to 35°C' },
        ],
      },
      {
        title: 'Mechanical characteristics',
        specs: [
          { label: 'Height', value: '395 ±2 mm' },
          { label: 'Width', value: '180 ±2 mm' },
          { label: 'Length', value: '230 ±2 mm' },
          { label: 'Dimensions (L × W × H)', value: '230 × 180 × 395 mm (±2 mm)' },
          { label: 'Net weight', value: '~20 kg' },
          { label: 'Shipping weight', value: '~24.00 kg (net + 4 kg packaging)' },
        ],
      },
      bmsGroup({
        overChargeDetection: '3.65 ±0.025 V',
        overChargeRelease: '3.4 ±0.025 V',
        maxChargeVoltage: '3.65 ±0.05 V',
        standardChargeCurrent: '≤ 16 A',
        overDischargeDetection: '2.65 ±0.025 V',
        overDischargeDelay: '0.5 – 1.5 s',
        overDischargeRelease: '3.0 ±0.025 V',
        overCurrentDetection: '121 ±30 A',
        overCurrentDelay: '200 ms',
        maxContinuousCurrent: '≤ 64 A',
        shortCircuitDetection: 'Exterior short circuit (333 A)',
      }),
      CHOGORI_PIN_GROUP,
      EV_SAFETY_GROUP,
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK® (LiEV / Lithium Ferro series)' },
          { label: 'Category', value: '2-Wheeler Lithium Battery / EV Battery' },
          { label: 'Battery cell composition', value: 'Lithium Iron Phosphate (LiFePO4 / LFP)' },
          { label: 'Number of batteries', value: '1 × battery pack' },
          {
            label: 'Recommended uses',
            value:
              'Electric 2-wheelers (scooters / motorcycles) and light EVs running on a 72VV system; OEM replacement or retrofit with compatible controller and charger',
          },
          {
            label: 'Compatibility',
            value: '72VV EV drivetrain with 83.95V charging profile; CAN-enabled BMS communication',
          },
          { label: 'Connector', value: 'Chogori 6-pin connector (main +/−, CAN L/H, Switch 1/2)' },
          { label: 'Enclosure', value: 'Black enclosure with orange top cover' },
          { label: 'Colour', value: 'Black with orange top' },
          { label: 'Country of origin', value: 'India' },
          { label: 'HSN code', value: '8507 60 00 (lithium-ion accumulators)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which electric 2-wheelers is this battery compatible with?',
        answer:
          'Any 72VV-system electric scooter or motorcycle whose controller accepts a 73.6V nominal LFP pack with a 83.95V charge voltage and 60.95V cut-off. Confirm connector type (Chogori 6-pin connector (main +/−, CAN L/H, Switch 1/2)) and charger rating with iTarang before purchase; controller and charger must match.',
      },
      {
        question: 'What range will I get?',
        answer:
          'The pack stores 2.36 kWh. A typical e-scooter consumes 25–35 Wh/km, so expect roughly 67–94 km per full charge depending on rider weight, speed, terrain and motor rating.',
      },
      {
        question: 'How long does it take to charge?',
        answer:
          'At the standard charge current (12 A) a full charge from cut-off takes about 2.5–3 hours. Use only a Trontek-approved LFP charger with a 83.95V CC-CV profile; a lead-acid charger will damage the pack.',
      },
      ...EV_SHARED_FAQS.slice(0, 2),
      {
        question: 'Can I use it in hot Indian summers and in the rain?',
        answer:
          "Discharge is rated −20°C to 55°C; the BMS throttles or cuts charging outside safe limits. Black enclosure with orange top cover — mount inside the vehicle's battery compartment and keep the connector dry. Store between 15°C and 35°C.",
      },
      ...EV_SHARED_FAQS.slice(2),
    ],
    sections: [
      {
        kind: 'charging',
        summary:
          'At the standard charge current (12 A) a full charge from cut-off takes about 2.5–3 hours. Use only a Trontek-approved LFP charger with a 83.95V CC-CV profile; a lead-acid charger will damage the pack.',
        points: [
          { label: 'Charge method', value: 'Constant Current / Constant Voltage (CC-CV)' },
          { label: 'Max. charge voltage', value: '83.95 V' },
          { label: 'Standard charge current', value: '12 A' },
          { label: 'Max. charge current', value: '16 A' },
        ],
      },
      {
        kind: 'discharge',
        summary: '',
        points: [
          { label: 'Continuous discharge current', value: '32 A' },
          { label: 'Peak instant discharge current', value: '64 A' },
          { label: 'Peak instant discharge time', value: '3 s' },
          { label: 'Discharge cut-off voltage', value: '60.95 V' },
          { label: 'Discharge temperature', value: '−20°C to 55°C' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '72VV EV drivetrain with 83.95V charging profile; CAN-enabled BMS communication',
          'Connector: Chogori 6-pin connector (main +/−, CAN L/H, Switch 1/2)',
          'Electric 2-wheelers (scooters / motorcycles) and light EVs running on a 72VV system; OEM replacement or retrofit with compatible controller and charger',
        ],
      },
      { kind: 'care', items: evCare('Black enclosure with orange top cover') },
    ],
    media: mediaFor('LiEV_73.6V_32Ah_TK-LiFe-7332', 'Trontek LiEV 73.6V 32Ah (TK-LiFe-7332)'),
  },

  /* ------------------------- 8 · TK LiEV-51105 Phase-II · 51V 105Ah, 3W */
  {
    productKey: 'trontek-tk-liev-51105',
    slug: 'trontek-liev-tk-liev-51105-phase-ii',
    status: 'published',
    brand: 'TRONTEK',
    title: 'Trontek LiEV LiFePO4 EV Battery 51V 105Ah (5.355 kWh) Phase-II',
    subtitle: 'Lithium Iron Phosphate (LiFePO4) EV battery pack',
    modelName: 'TK LiEV-51105 (Phase-II) (51V / 105Ah)',
    genericName: 'Lithium Iron Phosphate (LiFePO4) EV battery pack',
    productType: 'Electric vehicle traction battery pack (lithium iron phosphate)',
    netQuantity: '1 Count',
    category: 'batteries',
    subcategory: 'ev-3-wheeler',
    art: 'battery',
    countryOfOrigin: 'India',
    description: [
      'The Trontek TK LiEV-51105 (Phase-II) is a 51V 105Ah (5.36 kWh) lithium iron phosphate traction battery built for electric 3-wheelers (e-rickshaws and e-loaders). LFP chemistry gives the safest lithium option on the road — no thermal runaway, no fire on puncture or short — with 2000+ cycle life and steady output voltage across the full discharge. The pack is optimised by its battery management system (BMS), which monitors every cell to protect against over-charge, over-discharge, over-current and short circuit, and balances cells independently for safe and accurate operation. Trontek is an established Indian battery manufacturer with 1 GWh production capacity and in-house R&D and testing.',
    ],
    highlights: EV_KEY_FEATURES,
    boxContents: [],
    careInstructions: null,
    // The only EV document that states a warranty: its product-details table
    // reads "3 years or 1200 cycles, whichever is earlier".
    warrantyMonths: 36,
    warrantyCycles: 1200,
    warrantyText: '3 years or 1200 cycles, whichever is earlier',
    installationIncluded: false,
    returnWindowDays: null,
    hsnCode: HSN,
    taxRate: GST,
    facets: { batteryAh: 105, voltage: 51, technology: 'LiFePO4', warrantyMonths: 36 },
    badges: [],
    popularityRank: 8,
    manufacturerKey: 'trontek',
    sellerKey: 'itarang',
    variants: [
      {
        variantKey: 'default',
        sku: 'TRN-TKLIEV51105',
        title: '',
        optionValues: {},
        mrp: 13_387_500,
        selling: 9_639_000,
        stock: null,
        availability: 'in-stock',
      },
    ],
    specGroups: [
      {
        title: 'Electrical characteristics',
        specs: [
          { label: 'Model', value: 'TK LiEV-51105 (Phase-II)' },
          { label: 'Nominal voltage', value: '51 V' },
          { label: 'Nominal capacity', value: '105 Ah' },
          { label: 'Battery pack energy', value: '5.36 kWh (5355 Wh)' },
          { label: 'Impedance (max. at 1000 Hz)', value: '≤ 20 mΩ' },
          { label: 'Expected cycle life', value: '2000 cycles at 0.5C, 25°C, within operating range' },
        ],
      },
      {
        title: 'Operation conditions',
        specs: [
          { label: 'Charge method', value: 'Constant Current / Constant Voltage (CC-CV)' },
          { label: 'Max. charge voltage', value: '58.4 V' },
          { label: 'Standard charge current', value: '16 A' },
          { label: 'Max. charge current', value: '50 A' },
          { label: 'Continuous discharge current', value: '25 A' },
          { label: 'Peak instant discharge current', value: '75 A' },
          { label: 'Peak instant discharge time', value: '5 s' },
          { label: 'Discharge cut-off voltage', value: '43.2 V' },
          { label: 'Discharge temperature', value: '−20°C to 60°C' },
          { label: 'Storage temperature', value: '15°C to 35°C' },
        ],
      },
      {
        title: 'Mechanical characteristics',
        specs: [
          { label: 'Height', value: '280 ±2 mm' },
          { label: 'Width', value: '380 ±2 mm' },
          { label: 'Length', value: '585 ±2 mm' },
          { label: 'Dimensions (L × W × H)', value: '585 × 380 × 280 mm (±2 mm)' },
          { label: 'Net weight', value: '~55 kg' },
          { label: 'Shipping weight', value: '~59.00 kg (net + 4 kg packaging)' },
        ],
      },
      bmsGroup({
        overChargeDetection: '3.7 ±0.025 V',
        overChargeRelease: '3.6 ±0.025 V',
        maxChargeVoltage: '3.7 ±0.05 V',
        standardChargeCurrent: '≤ 16 A',
        overDischargeDetection: '2.7 ±0.025 V',
        overDischargeDelay: '0.5 – 1.5 s',
        overDischargeRelease: '2.6 ±0.025 V',
        overCurrentDetection: '121 ±30 A',
        overCurrentDelay: '200 ms',
        maxContinuousCurrent: '≤ 96 A',
        shortCircuitDetection: 'Exterior short circuit (333 A)',
      }),
      EV_SAFETY_GROUP,
      {
        title: 'Product details',
        specs: [
          { label: 'Brand', value: 'TRONTEK® (LiEV / Lithium Ferro series)' },
          { label: 'Category', value: '3-Wheeler / E-Rickshaw Lithium Battery / EV Battery' },
          { label: 'Battery cell composition', value: 'Lithium Iron Phosphate (LiFePO4 / LFP)' },
          { label: 'Number of batteries', value: '1 × battery pack' },
          {
            label: 'Recommended uses',
            value:
              'Electric 3-wheelers / e-rickshaws and e-loaders running on a 48V system; OEM fitment or lead-acid replacement with compatible controller and Trontek charger',
          },
          { label: 'Compatibility', value: '48VV EV drivetrain with 58.4V charging profile' },
          { label: 'Connector', value: 'Output cable connector (charge + motor power leads)' },
          {
            label: 'Enclosure',
            value:
              'Powder-coated metal enclosure with orange top cover, dual carry handles and output cable glands',
          },
          { label: 'Colour', value: 'Black with orange top' },
          { label: 'Country of origin', value: 'India' },
          { label: 'Warranty', value: '3 years or 1200 cycles, whichever is earlier' },
          { label: 'HSN code', value: '8507 60 00 (lithium-ion accumulators)' },
          { label: 'GST', value: '18% (verify current rate)' },
        ],
      },
    ],
    faqs: [
      {
        question: 'Which electric 3-wheelers (e-rickshaws and e-loaders) is this battery compatible with?',
        answer:
          'Any 48VV-system e-rickshaw whose controller accepts a 51V nominal LFP pack with a 58.4V charge voltage and 43.2V cut-off. Confirm connector type (Output cable connector (charge + motor power leads)) and charger rating with iTarang before purchase; controller and charger must match.',
      },
      {
        question: 'What range will I get?',
        answer:
          'The pack stores 5.36 kWh. A typical e-rickshaw consumes 45–65 Wh/km, so expect roughly 82–119 km per full charge depending on passenger load, speed, terrain and motor rating.',
      },
      {
        question: 'How long does it take to charge?',
        // Reproduced exactly. The source sentence is malformed.
        answer:
          'At the standard charge current (16 A) a full charge from cut-off takes about 6.5–7 (16 A) / 2–2.5 (50 A fast) hours. Use only a Trontek-approved LFP charger with a 58.4V CC-CV profile; a lead-acid charger will damage the pack.',
      },
      ...EV_SHARED_FAQS.slice(0, 2),
      {
        question: 'Can I use it in hot Indian summers and in the rain?',
        answer:
          "Discharge is rated −20°C to 60°C; the BMS throttles or cuts charging outside safe limits. Powder-coated metal enclosure with orange top cover, dual carry handles and output cable glands — mount inside the vehicle's battery compartment and keep the connector dry. Store between 15°C and 35°C.",
      },
      ...EV_SHARED_FAQS.slice(2, 3),
      {
        question: 'What is the warranty?',
        answer:
          'Warranty: 3 years or 1200 cycles, whichever is earlier. Warranty is void if a non-approved charger is used or the pack is opened.',
      },
      ...EV_SHARED_FAQS.slice(3),
    ],
    sections: [
      {
        kind: 'charging',
        summary:
          'At the standard charge current (16 A) a full charge from cut-off takes about 6.5–7 (16 A) / 2–2.5 (50 A fast) hours. Use only a Trontek-approved LFP charger with a 58.4V CC-CV profile; a lead-acid charger will damage the pack.',
        points: [
          { label: 'Charge method', value: 'Constant Current / Constant Voltage (CC-CV)' },
          { label: 'Max. charge voltage', value: '58.4 V' },
          { label: 'Standard charge current', value: '16 A' },
          { label: 'Max. charge current', value: '50 A' },
        ],
      },
      {
        kind: 'discharge',
        summary: '',
        points: [
          { label: 'Continuous discharge current', value: '25 A' },
          { label: 'Peak instant discharge current', value: '75 A' },
          { label: 'Peak instant discharge time', value: '5 s' },
          { label: 'Discharge cut-off voltage', value: '43.2 V' },
          { label: 'Discharge temperature', value: '−20°C to 60°C' },
        ],
      },
      {
        kind: 'compatibility',
        items: [
          '48VV EV drivetrain with 58.4V charging profile',
          'Connector: Output cable connector (charge + motor power leads)',
          'Electric 3-wheelers / e-rickshaws and e-loaders running on a 48V system; OEM fitment or lead-acid replacement with compatible controller and Trontek charger',
        ],
      },
      {
        kind: 'care',
        items: evCare(
          'Powder-coated metal enclosure with orange top cover, dual carry handles and output cable glands',
        ),
      },
    ],
    media: mediaFor(
      'LiEV_51V_105Ah_TK-LiEV-51105_E-Rickshaw',
      'Trontek LiEV 51V 105Ah Phase-II (TK LiEV-51105)',
    ),
  },
];
