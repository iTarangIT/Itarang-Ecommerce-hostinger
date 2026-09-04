import type { Category } from '../types';

/**
 * iTarang category architecture.
 *
 * Four families, fourteen subcategories. Every subcategory is a real URL with
 * its own heading, description and SEO copy — no query-string categories.
 */
export const CATEGORIES: Category[] = [
  {
    slug: 'inverters',
    name: 'Inverters',
    shortName: 'Inverters',
    tagline: 'Silent, pure sine wave power for every home load',
    description:
      'Pure sine wave home inverters built for Indian grid conditions — wide input voltage protection, silent changeover and clean output that appliance electronics can tolerate indefinitely.',
    seoCopy: [
      'A home inverter converts stored battery power into mains-grade AC when the grid fails, and recharges the battery when the grid returns. The output waveform is what separates a basic unit from a good one: pure sine wave output matches the shape of grid supply, so motors, compressors and switch-mode power supplies run without the humming, extra heat and reduced life that modified sine wave output causes.',
      'Sizing is a two-part decision. The inverter VA rating must cover the total connected load with headroom for start-up surge, and the battery Ah rating determines how long that load runs. A 900VA inverter comfortably carries four fans, six LED lights, a router and a television; a 1500VA unit adds a refrigerator or a small water pump. Our load calculator works the arithmetic out for you and returns matching iTarang systems.',
      'Every iTarang inverter ships with wide-input protection for the 100V–290V swings common on rural and semi-urban feeders, short-circuit and overload cut-offs, and the full manufacturer specification on every product page.',
    ],
    icon: 'inverter',
    facetIds: [
      'subcategory',
      'capacityVa',
      'technology',
      'solarReady',
      'warrantyMonths',
      'price',
      'rating',
      'availability',
    ],
    highlights: ['Pure sine wave output', 'Wide input 100V–290V', 'Solar-ready models'],
    subcategories: [
      {
        slug: 'pure-sine-wave',
        name: 'Pure Sine Wave Inverters',
        description:
          'Clean, grid-shaped output for homes running mixed loads — fans, lighting, televisions, routers and refrigeration.',
        seoCopy: [
          'Pure sine wave output is the reference standard for home backup. Because the waveform matches grid supply, inductive loads such as ceiling fans and refrigerator compressors run at their rated efficiency instead of drawing extra current and running hot. Sensitive electronics — smart televisions, laptop adapters, routers, CPAP machines — see supply indistinguishable from the mains.',
          'iTarang pure sine wave inverters span 700VA to 3500VA, covering a single room through to a full four-bedroom home with pumps. All models include overload, deep-discharge and short-circuit protection, and a battery-agnostic charger that supports tubular, flat plate and lithium chemistries.',
        ],
      },
      {
        slug: 'digital-ups',
        name: 'Digital UPS (DUPS)',
        description:
          'Sub-10 millisecond changeover for desktops, network racks and workstations that cannot tolerate a flicker.',
        seoCopy: [
          'A digital UPS inverter combines the backup duration of a home inverter with the fast transfer time of a computer UPS. Changeover completes in under 10 milliseconds, which is quick enough that desktop power supplies, network switches and NVRs never see an interruption.',
          'This is the right family for a home office, a small clinic reception, or any room where a desktop computer shares a circuit with normal household load.',
        ],
      },
      {
        slug: 'solar-ready',
        name: 'Solar-Ready Inverters',
        description:
          'Built-in solar charge controller so panels charge the battery first and the grid only tops up.',
        seoCopy: [
          'Solar-ready inverters carry an integrated charge controller that prioritises panel input over grid input. On a normal sunny day the battery is charged entirely from the array, and the grid is only drawn on to finish the cycle or during extended cloud cover.',
          'Panel capacity, battery bank size and daily consumption need to be matched to each other. Our load calculator sizes the inverter and battery; the panel array is then specified by your installer against your roof orientation and daily unit consumption.',
        ],
      },
      {
        slug: 'high-capacity',
        name: 'High-Capacity Inverters',
        description:
          '2200VA and above for large homes, shops and workshops running pumps, compressors and multiple refrigeration loads.',
        seoCopy: [
          'Above roughly 2000VA an inverter moves from a 12V single-battery design to a 24V or 48V bank, which reduces current draw at the same power and keeps cable losses and heating under control. This is the family for a large home with a borewell pump, or a retail counter running refrigeration and lighting through long outages.',
          'High-capacity systems must be installed on a properly rated circuit with correct cable gauge, by a qualified electrician.',
        ],
      },
    ],
  },
  {
    slug: 'batteries',
    name: 'Batteries',
    shortName: 'Batteries',
    tagline: 'Home backup banks and EV traction packs, sized honestly',
    description:
      'The battery decides how long your backup lasts and how often you replace it. Choose lithium for cycle life and zero maintenance, or tubular for proven long-outage performance at a lower entry price — or a LiFePO4 traction pack matched to your vehicle’s system voltage.',
    seoCopy: [
      'Battery capacity is quoted in ampere-hours (Ah) at a stated discharge rate — usually C20, meaning the rated capacity is available when discharged evenly over twenty hours. A 150Ah C20 battery paired with a 900VA inverter carries a typical four-fan, six-light load for roughly six to eight hours depending on the depth of discharge you are willing to accept.',
      'Chemistry is the other half of the decision. Lithium iron phosphate (LiFePO4) delivers three to five times the cycle life of lead acid, weighs roughly a third as much, needs no topping up, and can be discharged deeper without damage — but costs more up front. Tall tubular lead acid remains the value choice for homes with long, frequent outages where the lower initial cost matters more than the replacement interval.',
      'Every iTarang battery is shipped in a protective crate, includes documented warranty terms, and is installed by a certified technician who will also verify that your inverter charger profile matches the chemistry.',
    ],
    icon: 'battery',
    facetIds: [
      'subcategory',
      'batteryAh',
      'voltage',
      'technology',
      'backupHours',
      'warrantyMonths',
      'price',
      'rating',
      'availability',
    ],
    highlights: ['LiFePO4 home & EV packs', '30Ah to 220Ah', 'Shipped in protective crates'],
    subcategories: [
      {
        slug: 'lithium',
        name: 'Lithium (LiFePO4) Batteries',
        description:
          'Maintenance-free, deep-cyclable and roughly a third the weight of an equivalent lead acid bank.',
        seoCopy: [
          'Lithium iron phosphate is the most stable of the common lithium chemistries and the right choice for home backup. It tolerates deep discharge without the capacity loss that shortens lead acid life, charges considerably faster, and needs no water topping up or ventilated battery trolley.',
          'Each iTarang lithium pack carries an integrated battery management system that handles cell balancing, temperature cut-off and over-discharge protection. Pair with any iTarang inverter — the charger profile is selectable.',
        ],
      },
      {
        slug: 'tall-tubular',
        name: 'Tall Tubular Batteries',
        description:
          'The long-outage workhorse — thick tubular plates and a large electrolyte reserve for repeated deep cycling.',
        seoCopy: [
          'Tall tubular construction uses thick, gauntlet-protected positive plates and a tall electrolyte column, which together tolerate the repeated deep discharge that daily long outages inflict. Where the grid is unreliable for hours at a stretch, tubular remains the most cost-effective capacity per rupee.',
          'Tubular batteries need periodic distilled-water topping up and adequate ventilation. Plan for a battery trolley and a location away from living space.',
        ],
      },
      {
        slug: 'short-tubular',
        name: 'Short Tubular Batteries',
        description:
          'Tubular plate performance in a lower-height case, for cupboards and utility spaces with limited headroom.',
        seoCopy: [
          'Short tubular batteries use the same plate technology as tall tubular units in a reduced-height case. Capacity per unit is lower, but the format fits under counters and inside utility cupboards where a tall unit will not stand.',
        ],
      },
      {
        slug: 'flat-plate-smf',
        name: 'Flat Plate & SMF Batteries',
        description:
          'Lower-cost flat plate and sealed maintenance-free units for short outages and light backup duty.',
        seoCopy: [
          'Flat plate batteries suit areas with short, infrequent outages where deep cycling is rare. Sealed maintenance-free (SMF) units add spill-proof construction and no water topping, making them suitable for indoor placement alongside a desktop UPS.',
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
  {
    slug: 'ups',
    name: 'UPS Systems',
    shortName: 'UPS',
    tagline: 'Uninterrupted supply for computers, routers and racks',
    description:
      'Line-interactive and online double-conversion UPS systems for desktops, network equipment and equipment that must never see a supply gap.',
    seoCopy: [
      'A UPS differs from a home inverter in transfer time and intent. A home inverter is sized for hours of household backup; a UPS is sized for minutes of clean, gap-free supply so equipment can ride through a cut or shut down safely.',
      'Line-interactive units handle desktops, routers and small NVRs, transferring in a few milliseconds and regulating moderate voltage swings without drawing on the battery. Online double-conversion units rebuild the waveform continuously, so the load never touches raw grid supply at all — the correct choice for servers, medical equipment and instrumentation.',
      'Runtime depends on the connected load, not just the VA rating. A 1000VA unit carrying a 300W desktop and monitor will hold far longer than the same unit carrying 700W.',
    ],
    icon: 'ups',
    facetIds: [
      'subcategory',
      'capacityVa',
      'technology',
      'warrantyMonths',
      'price',
      'rating',
      'availability',
    ],
    highlights: ['Under 10ms transfer', 'Line-interactive & online', 'Rack and desktop formats'],
    subcategories: [
      {
        slug: 'home-ups',
        name: 'Home & Office UPS',
        description:
          'Line-interactive units for desktops, routers, ONTs and camera recorders.',
        seoCopy: [
          'Line-interactive UPS units sit between the grid and your equipment, correcting moderate voltage swings with an internal transformer tap and switching to battery only when supply falls outside a usable window. Transfer is fast enough that a desktop power supply never resets.',
        ],
      },
      {
        slug: 'online-ups',
        name: 'Online (Double Conversion) UPS',
        description:
          'Zero transfer time, continuously regenerated waveform, for servers and instrumentation.',
        seoCopy: [
          'An online UPS rectifies incoming AC to DC and inverts it back continuously, so the connected load is permanently isolated from grid disturbance and transfer time is genuinely zero. This is what server racks, diagnostic equipment and precision instrumentation require.',
        ],
      },
    ],
  },
  {
    slug: 'combos',
    name: 'Inverter + Battery Combos',
    shortName: 'Combos',
    tagline: 'Matched, sized and ready to install',
    description:
      'Inverter and battery selected together, charger profile pre-matched to the chemistry, delivered and installed as one system — usually below the price of buying the two separately.',
    seoCopy: [
      'Buying an inverter and a battery separately leaves you responsible for matching them: charging current against battery capacity, charger profile against chemistry, VA rating against the load you actually run. A mismatched pair either undercharges the battery — which shortens its life — or overcharges it, which shortens it faster.',
      'An iTarang combo removes that risk. Each pairing is specified together, the charger profile is pre-set for the supplied chemistry, and both units carry a single warranty and a single installation visit. Pricing is set below the sum of the individual products.',
      'If you are not sure which combo fits, the load calculator will size a system from the appliances you actually run and take you straight to the matching product.',
    ],
    icon: 'combo',
    facetIds: [
      'subcategory',
      'capacityVa',
      'batteryAh',
      'technology',
      'backupHours',
      'price',
      'rating',
      'availability',
    ],
    highlights: ['Pre-matched charger profile', 'One warranty, one install', 'Combo pricing'],
    subcategories: [
      {
        slug: 'home-combos',
        name: 'Home Combos',
        description:
          'Sized for apartments and independent houses running fans, lighting, entertainment and a refrigerator.',
        seoCopy: [
          'Home combos pair a pure sine wave inverter with a battery sized for a typical evening outage. The 900VA and 1100VA pairings cover a two to three bedroom home; the 1500VA pairing adds refrigeration and a water pump.',
        ],
      },
      {
        slug: 'shop-office-combos',
        name: 'Shop & Office Combos',
        description:
          'Higher-capacity pairings for retail counters, clinics and offices with refrigeration or point-of-sale equipment.',
        seoCopy: [
          'Commercial premises run longer daily hours and heavier connected loads than homes. These pairings use higher-VA inverters on 24V battery banks so the system can carry refrigeration, lighting and billing equipment through a full working day of intermittent supply.',
        ],
      },
      {
        slug: 'solar-combos',
        name: 'Solar Combos',
        description:
          'Solar-ready inverter with a lithium bank, for homes adding panels now or later.',
        seoCopy: [
          'A solar combo pairs a solar-ready inverter with a lithium bank that tolerates the daily partial cycling a panel array produces. The system runs on grid charging from day one and accepts panels whenever you add them, without replacing the inverter.',
        ],
      },
    ],
  },
];

export const CATEGORY_BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));
