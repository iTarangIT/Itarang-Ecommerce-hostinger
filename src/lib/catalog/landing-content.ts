import type { FaqEntry } from '@/lib/support/faqs';

/**
 * Landing-page content for each category and subcategory: the "superior
 * features" row under the heading, the calculator that answers "which one do
 * I need", and the questions a shopper on that page asks.
 *
 * Every feature is a property every product in the section states on its
 * Trontek listing sheet (chemistry, BMS, sealing, made in India) — nothing is
 * claimed for a section that one of its products does not have. No lead-acid
 * comparisons, by the business's instruction.
 */

export type FeatureIcon = 'shield' | 'bolt' | 'cycle' | 'chip' | 'drop' | 'factory' | 'plug' | 'gauge';

export interface LandingFeature {
  icon: FeatureIcon;
  title: string;
  detail: string;
}

export interface LandingContent {
  features: LandingFeature[];
  tool?: { href: string; title: string; body: string; cta: string };
  faqs: FaqEntry[];
}

const LFP_SAFETY: LandingFeature = {
  icon: 'shield',
  title: 'LiFePO4 chemistry',
  detail: 'The most thermally stable lithium chemistry.',
};
const BMS: LandingFeature = {
  icon: 'chip',
  title: 'Smart BMS',
  detail: 'Cell balancing and protection on every pack.',
};
const MADE_IN_INDIA: LandingFeature = {
  icon: 'factory',
  title: 'Made in India',
  detail: 'Built and tested by Trontek.',
};

const EV_TOOL = {
  href: '/tools/mobility-calculator',
  title: 'Not sure which pack fits?',
  body: 'Enter your motor rating, voltage, daily distance and vehicle age. We work out the capacity you need and the pack and charger that fit.',
  cta: 'Open the EV battery calculator',
};

const HOME_TOOL = {
  href: '/tools/load-calculator',
  title: 'Calculate your home backup need',
  body: 'Pick your home size and appliances and the hours you need. We work out the battery that covers it.',
  cta: "Let's plan",
};

const CONTENT: Record<string, LandingContent> = {
  'ev-3-wheeler': {
    features: [
      { icon: 'gauge', title: 'Quoted in kWh', detail: 'The figure that decides a working day.' },
      { icon: 'cycle', title: 'Long cycle life', detail: 'Built for daily deep cycling.' },
      LFP_SAFETY,
      BMS,
      { icon: 'drop', title: 'No maintenance', detail: 'No water topping, no acid, no corrosion.' },
    ],
    tool: EV_TOOL,
    faqs: [
      {
        id: 'erickshaw-voltage',
        question: 'Which voltage does my e-rickshaw need?',
        answer:
          'The same nominal voltage as your controller — usually printed on the controller or in the vehicle manual. Most e-rickshaws run on 48 V or 60 V systems; a 51 V LiFePO4 pack replaces a 48 V system and a 61 V pack a 60 V system. Never fit a pack of a different voltage class.',
      },
      {
        id: 'erickshaw-range',
        question: 'How far will it go on one charge?',
        answer:
          'Roughly the pack’s energy in watt-hours divided by your rickshaw’s consumption per kilometre — typically 55–90 Wh/km depending on load, motor and roads. A 5.4 kWh pack therefore gives very roughly 60–95 km. The EV battery calculator works it out for your vehicle.',
      },
      {
        id: 'erickshaw-charger',
        question: 'Do I need a new charger?',
        answer:
          'Yes — a lithium pack needs a lithium charger matched to its charge voltage. Each battery page lists the Trontek chargers that fit it.',
      },
      {
        id: 'erickshaw-warranty',
        question: 'What warranty do the e-rickshaw packs carry?',
        answer:
          'It is stated on each product page in Trontek’s words — for example 3 years or 1200 cycles, whichever comes first.',
      },
    ],
  },
  'ev-2-wheeler': {
    features: [
      { icon: 'bolt', title: 'Matched by voltage', detail: '48 V, 60 V and 72 V systems.' },
      LFP_SAFETY,
      BMS,
      { icon: 'cycle', title: '2000+ cycles', detail: 'As stated on the LiEV listing sheets.' },
      MADE_IN_INDIA,
    ],
    tool: EV_TOOL,
    faqs: [
      {
        id: 'scooter-fit',
        question: 'Will this battery fit my scooter?',
        answer:
          'Check three things on the product page against your vehicle: the nominal voltage, the dimensions, and the connector. If all three match, it fits. If you are unsure, send us your scooter model on WhatsApp.',
      },
      {
        id: 'scooter-range',
        question: 'How much range will I get?',
        answer:
          'Range is energy divided by consumption. Most scooters use 25–40 Wh per km, so a 2.3 kWh pack gives roughly 55–90 km depending on speed, load and terrain.',
      },
      {
        id: 'scooter-charge',
        question: 'How long does charging take?',
        answer:
          'About the pack’s ampere-hours divided by the charger current, plus half an hour. A 45 Ah pack on a 10 A charger takes around five hours.',
      },
    ],
  },
  'home-inverter': {
    features: [
      { icon: 'drop', title: 'Zero maintenance', detail: 'No water topping, no fumes.' },
      { icon: 'cycle', title: 'Up to 4000 cycles', detail: 'Powercube warranty: 5 years or 4000 cycles.' },
      LFP_SAFETY,
      BMS,
      { icon: 'plug', title: 'Lithium-ready inverters', detail: '12 V and 24 V battery inputs.' },
    ],
    tool: HOME_TOOL,
    faqs: [
      {
        id: 'home-inverter-compat',
        question: 'Will it work with my existing inverter?',
        answer:
          'It needs an inverter whose battery input voltage matches (12 V or 24 V) and that can charge a lithium battery — a "lithium-ready" or "lithium-compatible" inverter. Check your inverter’s manual or ask us with its model number.',
      },
      {
        id: 'home-backup-hours',
        question: 'How many hours of backup will I get?',
        answer:
          'Battery energy in watt-hours divided by the load in watts. A 1.34 kWh battery running 200 W of fans and lights lasts roughly six hours. The load calculator does this for your appliances.',
      },
      {
        id: 'home-placement',
        question: 'Where can I keep it?',
        answer:
          'Indoors, on a wall or a flat surface, away from direct heat and water. It needs no ventilated trolley.',
      },
    ],
  },
  ess: {
    features: [
      { icon: 'gauge', title: '5 kWh and up', detail: 'Wall and rack storage that scales.' },
      { icon: 'cycle', title: 'Long design life', detail: 'Built for a cycle every day.' },
      LFP_SAFETY,
      BMS,
      MADE_IN_INDIA,
    ],
    tool: HOME_TOOL,
    faqs: [
      {
        id: 'ess-size',
        question: 'What size of ESS do I need?',
        answer:
          'Multiply the load you want to run (kW) by the hours you need it, then add headroom so the battery is not emptied every day. The load calculator gives a starting figure; our team can size a system for a shop or office.',
      },
      {
        id: 'ess-solar',
        question: 'Can I use it with solar?',
        answer:
          'Yes, with a hybrid or off-grid inverter that supports lithium batteries at the pack’s voltage. Each product page lists the inverter communication it supports.',
      },
    ],
  },
  'ev-chargers': {
    features: [
      { icon: 'plug', title: 'Matched to the pack', detail: 'By output voltage and current.' },
      { icon: 'shield', title: 'IP66 sealed', detail: 'Die-cast, glue-sealed shell.' },
      { icon: 'chip', title: 'CC-CV charging', detail: 'Automatic shut-off when full.' },
      MADE_IN_INDIA,
    ],
    faqs: [
      {
        id: 'charger-choose',
        question: 'How do I pick the right charger?',
        answer:
          'Match the charger’s maximum output voltage to your battery’s charge voltage first, then choose the current for how fast you need it charged. Every EV battery page lists the chargers that fit it.',
      },
      {
        id: 'charger-time',
        question: 'How long does a full charge take?',
        answer:
          'Roughly battery Ah divided by charger amps, plus about half an hour. A 105 Ah pack on a 25 A charger takes about four and a half hours.',
      },
    ],
  },
};

/** Content for a subcategory, or for a whole category's landing page. */
export function landingContentFor(categorySlug: string, subcategorySlug?: string): LandingContent | null {
  if (subcategorySlug) return CONTENT[subcategorySlug] ?? null;
  if (categorySlug === 'chargers') return CONTENT['ev-chargers'] ?? null;
  if (categorySlug === 'batteries') {
    return {
      features: [LFP_SAFETY, BMS, { icon: 'drop', title: 'No maintenance', detail: 'Sealed, nothing to top up.' }, MADE_IN_INDIA],
      tool: EV_TOOL,
      faqs: [
        ...(CONTENT['ev-3-wheeler']?.faqs.slice(0, 1) ?? []),
        ...(CONTENT['ev-2-wheeler']?.faqs.slice(0, 1) ?? []),
        ...(CONTENT['home-inverter']?.faqs.slice(0, 1) ?? []),
      ],
    };
  }
  return null;
}
