import type { Category } from '../types';

/**
 * iTarang category architecture.
 *
 * Two families, matching what the business sells and nothing else: batteries
 * (2-wheeler, 3-wheeler, home inverter and ESS) and the chargers that go with
 * them. Inverters, UPS systems and combos were removed earlier because the
 * database holds no product in any of them, and a navigation section for a
 * product line the business does not sell is a promise broken on click.
 *
 * The order of the battery subcategories is the business's own: 3W, 2W, home
 * inverter, ESS. `lithium` used to be a subcategory too, but every product here
 * is lithium, so it described nothing; migration 0020 refiles its products
 * under `home-inverter`.
 *
 * `CategorySlug` deliberately keeps its wider union — the development fixture
 * in `mock/products.ts` still carries inverters, UPS and combos.
 * `mock-provider.ts` filters it to the categories defined here instead.
 *
 * A subcategory with no published product is hidden by the navigation, so ESS
 * and Chargers appear on their own once their first product is published. Do
 * not invent products to fill them.
 *
 * Every subcategory is a real URL with its own heading, description and SEO
 * copy — no query-string categories.
 */
export const CATEGORIES: Category[] = [
  {
    slug: 'batteries',
    name: 'Batteries',
    shortName: 'Batteries',
    tagline: 'Home backup banks and EV traction packs, sized honestly',
    description:
      'Lithium iron phosphate batteries for two jobs: keeping a home running through a cut, and driving an electric two- or three-wheeler. Choose by what the battery has to do, then by the system voltage it has to match.',
    seoCopy: [
      'Battery capacity is quoted in ampere-hours (Ah), and energy — the figure that actually decides how long a load runs — is that capacity multiplied by the pack voltage. A 12.8V 105Ah pack stores 1.34 kWh; a 51V 105Ah pack stores 5.36 kWh. Comparing two batteries on Ah alone, without their voltages, compares nothing.',
      'Lithium iron phosphate (LiFePO4) is the chemistry across the range. It is the most thermally stable of the common lithium chemistries, tolerates deep discharge without the capacity loss that shortens lead-acid life, weighs roughly a third as much, and needs no water topping up or ventilated trolley. Every pack carries a battery management system handling cell balancing, temperature cut-off and over-discharge protection.',
      'Home and vehicle packs are not interchangeable, and the listing says which is which. A home battery states the inverter input voltage and charging profile it expects; a traction pack states the drivetrain voltage, the charge voltage and the discharge cut-off its controller must accept. Match those figures before capacity, never after.',
    ],
    icon: 'battery',
    // Ampere-hours and voltage are the only numeric filters. They decide
    // whether a battery fits at all — a pack at the right price and the wrong
    // voltage is not a cheaper option, it is not an option. There is no price
    // filter by the business's decision; sorting by price still works.
    facetIds: [
      'subcategory',
      'batteryAh',
      'voltage',
      'technology',
      'warrantyMonths',
      'rating',
      'availability',
    ],
    highlights: ['LiFePO4 EV, home & ESS packs', 'Built-in BMS on every pack', 'Shipped in protective crates'],
    subcategories: [
      {
        slug: 'ev-3-wheeler',
        name: '3-Wheeler & E-Rickshaw Batteries',
        description:
          'High-capacity LiFePO4 packs for e-rickshaws and e-loaders, sized in kWh for a day of duty.',
        seoCopy: [
          'An e-rickshaw is a working vehicle, so the number that matters is energy — kilowatt-hours — rather than ampere-hours alone. Energy divided by the vehicle’s consumption per kilometre is the honest estimate of a day’s range, and consumption varies with passenger load, terrain and motor rating far more than with the battery.',
          'Lithium iron phosphate replaces a lead-acid bank at roughly a third of the weight and several times the cycle life, with no water topping, no acid and no terminal corrosion. Against daily deep cycling that difference compounds quickly.',
          'A traction pack must match the controller and the charger. Confirm the system voltage, the charge voltage and the connector before ordering, and use only a charger approved for the pack.',
        ],
      },
      {
        slug: 'ev-2-wheeler',
        name: '2-Wheeler EV Batteries',
        description:
          'LiFePO4 traction packs for electric scooters and motorcycles, matched by system voltage and connector.',
        seoCopy: [
          'A traction pack is chosen by system voltage first and capacity second. A 60V drivetrain needs a pack whose controller accepts its nominal voltage, its charge voltage and its discharge cut-off — a 51V pack and a 73.6V pack are not alternatives for the same vehicle, whatever their capacity. Check the voltage on the listing against the vehicle, then the connector, then the charger.',
          'Lithium iron phosphate is the safest chemistry on the road: it has a far higher thermal-runaway threshold than nickel-based cells and does not release oxygen when abused. Every pack listed here carries a battery management system that protects against over-charge, over-discharge, over-current and short circuit, and balances cells individually.',
          'Fitting a pack whose connector or charge profile does not match the vehicle is the most common and most expensive mistake. Confirm the connector type and the charger rating before ordering; a lead-acid charger will damage a lithium pack.',
        ],
      },
      {
        slug: 'home-inverter',
        name: 'Home Inverter Batteries',
        description:
          'Maintenance-free LiFePO4 batteries for household backup, matched to a lithium-ready inverter’s battery input and charging profile.',
        seoCopy: [
          'A home backup battery is chosen from the load it has to carry and how long it has to carry it. Running watts multiplied by hours gives the energy required; energy divided by the pack voltage gives the ampere-hours. The load calculator does that arithmetic and checks the answer against what is actually in stock.',
          'The inverter side matters as much as the battery. A lithium pack needs an inverter that accepts its battery input voltage and can deliver its charging profile — a charger built for lead acid will not charge a LiFePO4 pack correctly, and may damage it.',
        ],
      },
      {
        slug: 'ess',
        name: 'ESS — Energy Storage Systems',
        description:
          'Wall- and rack-mounted LiFePO4 storage from 5 kWh upwards, for homes, shops and solar systems.',
        seoCopy: [
          'An energy storage system is sized in kilowatt-hours: how much energy it can hold, not how many ampere-hours its cells are rated for. Multiply the load in kilowatts by the hours it has to run, then allow headroom so the pack is not cycled to empty every day.',
          'Every ESS pack here is lithium iron phosphate with an integrated battery management system, and states the inverter communication and charge profile it expects. Check those against the inverter or hybrid solar inverter before choosing a capacity.',
        ],
      },
    ],
  },
  {
    slug: 'chargers',
    name: 'Chargers',
    shortName: 'Chargers',
    tagline: 'The right charger for every Trontek pack',
    description:
      'Lithium battery chargers for electric two- and three-wheelers, matched to the pack by output voltage and current.',
    seoCopy: [
      'A lithium pack must be charged by a charger built for its chemistry and its voltage. The output voltage has to match the pack’s charge voltage, and the current decides how long a full charge takes: a 12 A charger refills a 105 Ah pack in roughly nine hours, a 20 A charger in a little over five.',
      'Each charger listed here states its output voltage class and current. Choose the voltage that matches the battery first, then the current that suits the time the vehicle has off the road.',
    ],
    icon: 'charger',
    facetIds: ['subcategory', 'voltage', 'availability'],
    highlights: ['Matched to Trontek packs', '500 W to 3 kW', 'Lithium charge profiles'],
    subcategories: [
      {
        slug: 'ev-chargers',
        name: 'EV Battery Chargers',
        description:
          'Chargers for 2-wheeler and 3-wheeler lithium packs, by output voltage and current.',
        seoCopy: [
          'Match the charger’s output voltage to the battery before anything else. A charger for a 51 V pack will not charge a 61 V pack, and a lead-acid charger must never be used on a lithium battery.',
        ],
      },
    ],
  },
];

export const CATEGORY_BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));
