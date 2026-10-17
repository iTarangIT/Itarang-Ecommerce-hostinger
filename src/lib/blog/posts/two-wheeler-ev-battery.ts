import type { BlogPost } from '../types';

export const twoWheelerEvBattery: BlogPost = {
  slug: 'two-wheeler-ev-battery-voltage-connector-charger',
  title: '2-wheeler EV battery: matching voltage, connector and charger',
  description:
    'Replacing or upgrading the battery on an electric scooter or motorcycle? How to match the pack to your controller voltage, current, connector and charger — and what to check before you swap.',
  date: '2026-10-08',
  author: 'iTarang team',
  category: 'EV',
  readingMinutes: 6,
  relatedCategoryPaths: ['/batteries/ev-2-wheeler', '/chargers'],
  body: [
    {
      type: 'paragraph',
      text: 'Electric scooters and motorcycles have become everyday transport across Indian cities, and many of them are now old enough to need a new battery. A replacement pack is a significant purchase, and unlike a phone battery there is no single standard size. Getting the match right comes down to three things: voltage, the connector, and the charger.',
    },
    { type: 'heading', level: 2, text: 'Voltage: read the controller, not just the old battery' },
    {
      type: 'paragraph',
      text: 'The motor controller on your vehicle is designed to work within a voltage window. Common electric 2-wheeler system voltages include 48V, 60V and 72V, and lithium packs for them carry nominal figures based on how many cells are in series.',
    },
    {
      type: 'paragraph',
      text: 'With lithium iron phosphate (LFP) cells at about 3.2V each, a pack’s nominal voltage is a multiple of that figure — 16 cells give about 51.2V, 20 cells about 64V, 23 cells about 73.6V. Other lithium chemistries use cells of a different voltage, so the same system voltage can appear on labels as slightly different numbers.',
    },
    {
      type: 'table',
      caption: 'How LFP cell count relates to nominal pack voltage',
      columns: ['Cells in series', 'Nominal voltage', 'Typical full-charge voltage'],
      rows: [
        ['16', '≈ 51.2V', '≈ 58.4V'],
        ['20', '≈ 64V', '≈ 73V'],
        ['23', '≈ 73.6V', '≈ 84V'],
      ],
    },
    {
      type: 'paragraph',
      text: 'What matters is that the new pack’s full-charge voltage stays below the controller’s maximum, and its cut-off voltage sits above the controller’s minimum. A pack outside that window can trip the controller’s protection, give poor performance, or cause damage. If you cannot find the controller rating, ask the vehicle maker or an authorised service centre.',
    },
    { type: 'heading', level: 2, text: 'Current: the number people forget' },
    {
      type: 'paragraph',
      text: 'Your controller draws far more current when you pull away from a signal or climb a flyover than when cruising. The battery’s BMS sets the limit on how much current the pack will supply, both continuously and in short peaks. If the controller asks for more than the BMS allows, the BMS will protect the cells by cutting power — which feels like the scooter switching off mid-ride.',
    },
    {
      type: 'list',
      items: [
        'Check the controller’s rated current (often printed on its label).',
        'Compare it with the battery’s continuous and peak discharge current.',
        'Choose a pack whose limits comfortably cover the controller, especially if you ride two-up or on hilly routes.',
      ],
    },
    { type: 'heading', level: 2, text: 'Capacity and range' },
    {
      type: 'paragraph',
      text: [
        'As with any EV pack, energy in kWh is voltage × Ah ÷ 1000, and your range is usable energy divided by how many watt-hours your vehicle uses per km. Measure your own consumption over a few normal days rather than relying on a headline figure. Our ',
        { text: 'e-rickshaw battery guide', href: '/blog/how-to-choose-an-e-rickshaw-battery' },
        ' shows the method step by step — it works the same way for a scooter.',
      ],
    },
    { type: 'heading', level: 2, text: 'Connectors and physical fit' },
    {
      type: 'paragraph',
      text: 'Electric 2-wheelers use a variety of power connectors, and many makers use their own designs. A connector that is undersized for the current, loose, or badly crimped heats up — and heat at a connector is a common cause of melted plugs and electrical faults.',
    },
    {
      type: 'list',
      items: [
        'Photograph your existing battery’s main connector and any signal or display plugs before ordering.',
        'Confirm the new pack uses the same connector, or have a qualified technician fit one rated for the current.',
        'Measure the battery compartment — length, width, height — and check the pack can be secured without strain on the cables.',
        'Some vehicles communicate with the battery for the fuel gauge or range display. Ask whether the new pack will work with your display; it may show charge differently.',
      ],
    },
    { type: 'heading', level: 2, text: 'The charger must match the battery' },
    {
      type: 'paragraph',
      text: 'A lithium pack is charged with a constant-current, constant-voltage (CC/CV) profile that ends at a specific voltage set by the chemistry and the number of cells. A charger built for another voltage or another chemistry can overcharge the pack, or never fill it. The BMS adds a layer of protection, but it is a safety net, not a substitute for the correct charger.',
    },
    {
      type: 'list',
      items: [
        [
          { strong: 'Output voltage: ' },
          'must match the pack’s full-charge voltage exactly as the battery maker specifies.',
        ],
        [
          { strong: 'Chemistry: ' },
          'the charger must be made for the battery’s chemistry, for example LFP.',
        ],
        [
          { strong: 'Current: ' },
          'within the battery’s maximum charge current. A higher current charges faster but should never exceed what the pack is rated for.',
        ],
        [
          { strong: 'Connector: ' },
          'the charging plug must match the vehicle or battery charging port.',
        ],
      ],
    },
    {
      type: 'callout',
      tone: 'warning',
      title: 'Using your old charger',
      text: 'A charger that came with your previous battery is only safe to reuse if it is built for the new pack’s chemistry and full-charge voltage. If in doubt, buy the charger matched to the new battery.',
    },
    { type: 'heading', level: 2, text: 'Before you swap' },
    {
      type: 'paragraph',
      text: 'Replacing the original battery may affect your vehicle maker’s warranty, so check with your dealer first if the vehicle is still covered. In India, traction batteries for 2- and 3-wheelers are covered by the AIS-156 safety standard; it is reasonable to ask a seller about the pack’s compliance and testing. Keep the invoice and the pack’s serial number, and register the warranty as soon as the battery is fitted.',
    },
  ],
};
