import type { Category } from '../types';

/**
 * iTarang category architecture.
 *
 * **One family, four subcategories** — and it used to be four families and
 * fourteen. Inverters, UPS Systems and Inverter + Battery Combos were all
 * advertised in the mega menu, and the database holds no product in any of
 * them: every panel opened on a zero count and a page with nothing to buy.
 * Digital UPS, Tall Tubular, Short Tubular and Flat Plate & SMF were the same
 * problem one level down. A navigation section for a product line the business
 * does not sell is not a placeholder, it is a promise we break on click.
 *
 * So the taxonomy now states what iTarang actually sells: lithium batteries,
 * for homes and for vehicles.
 *
 * **No product was deleted or reclassified to make this true.** All eight
 * catalogue products are already `batteries`, and the removed slugs were empty.
 * `CategorySlug` deliberately keeps its wider union — the development fixture
 * in `mock/products.ts` still carries inverters, UPS and combos, and rewriting
 * that fixture to match a navigation change would be the tail wagging the dog.
 * `mock-provider.ts` filters it to the categories defined here instead.
 *
 * `home-inverter` is defined but currently holds nothing. It exists so genuine
 * inverter and home-backup stock has a place to land without another taxonomy
 * change, and the nav hides a subcategory with no products — which is the very
 * failure that made UPS and Combos worth removing. Do not invent products to
 * fill it.
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
    // Ampere-hours and voltage lead, ahead of price. They are the two numbers
    // that decide whether a battery fits at all — a pack at the right price and
    // the wrong voltage is not a cheaper option, it is not an option — so they
    // are the first refinements a shopper should reach, not the last.
    facetIds: [
      'subcategory',
      'batteryAh',
      'voltage',
      'price',
      'technology',
      'warrantyMonths',
      'rating',
      'availability',
    ],
    highlights: ['LiFePO4 home & EV packs', '30Ah to 105Ah', 'Shipped in protective crates'],
    subcategories: [
      {
        slug: 'lithium',
        name: 'Lithium Batteries',
        description:
          'Maintenance-free, deep-cyclable LiFePO4 storage — roughly a third the weight of an equivalent lead acid bank.',
        seoCopy: [
          'Lithium iron phosphate is the most stable of the common lithium chemistries and the right choice for home backup. It tolerates deep discharge without the capacity loss that shortens lead acid life, charges considerably faster, and needs no water topping up or ventilated battery trolley.',
          'Each iTarang lithium pack carries an integrated battery management system that handles cell balancing, temperature cut-off and over-discharge protection. Check the listing for the inverter battery input voltage and charging profile the pack expects.',
        ],
      },
      {
        slug: 'home-inverter',
        name: 'Home & Inverter Batteries',
        description:
          'Batteries sized for household backup, matched to a lithium-ready inverter’s battery input and charging profile.',
        seoCopy: [
          'A home backup battery is chosen from the load it has to carry and how long it has to carry it. Running watts multiplied by hours gives the energy required; energy divided by the pack voltage gives the ampere-hours. The load calculator does that arithmetic and checks the answer against what is actually in stock.',
          'The inverter side matters as much as the battery. A lithium pack needs an inverter that accepts its battery input voltage and can deliver its charging profile — a charger built for lead acid will not charge a LiFePO4 pack correctly, and may damage it.',
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
    ],
  },
];

export const CATEGORY_BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));
