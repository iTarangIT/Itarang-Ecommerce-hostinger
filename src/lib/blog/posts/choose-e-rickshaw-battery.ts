import type { BlogPost } from '../types';

export const chooseERickshawBattery: BlogPost = {
  slug: 'how-to-choose-an-e-rickshaw-battery',
  title: 'How to choose an e-rickshaw battery: voltage, Ah, kWh and range',
  description:
    'A practical guide for e-rickshaw and 3-wheeler owners in India: how to read pack voltage, amp-hours and kWh, work out the range you need, and check a battery will actually fit and work with your vehicle.',
  date: '2026-10-06',
  author: 'iTarang team',
  category: 'Buying guide',
  readingMinutes: 6,
  relatedCategoryPaths: ['/batteries/ev-3-wheeler', '/chargers'],
  body: [
    {
      type: 'paragraph',
      text: 'For an e-rickshaw or loader driver, the battery decides how many trips you can do in a shift, how often you stop to charge, and how much you earn. A battery that is the wrong voltage will not run the vehicle at all; one that is too small leaves you stranded before the evening rush. This guide walks through the four numbers on every battery label and how to turn them into a sensible choice.',
    },
    { type: 'heading', level: 2, text: 'Start with voltage: it must match your vehicle' },
    {
      type: 'paragraph',
      text: 'Voltage is not a "more is better" number. Your motor controller is designed for a particular system voltage, and the battery has to suit it. Most e-rickshaws in India run on a 48V or 60V system, but check your own vehicle rather than assuming.',
    },
    {
      type: 'paragraph',
      text: 'Lithium iron phosphate (LFP) packs are built from cells of about 3.2V each, connected in series. That is why a pack meant for a 48V system is usually labelled around 51V (16 cells), and why you will see figures like 61V or 64V for 60V-class systems. These are nominal voltages; the actual voltage rises when the pack is full and falls as it empties.',
    },
    {
      type: 'list',
      items: [
        'Find the operating voltage range printed on your controller, or ask your vehicle dealer.',
        'Compare it with the battery’s full-charge and cut-off voltages, not just the nominal figure.',
        'If the two ranges do not overlap comfortably, the vehicle may refuse to start, cut out early, or the controller may be damaged.',
      ],
    },
    { type: 'heading', level: 2, text: 'Amp-hours and kWh: how much energy you are buying' },
    {
      type: 'paragraph',
      text: [
        'Amp-hours (Ah) tell you how much charge the pack holds at its rated voltage. On their own they are misleading, because a 100Ah pack at 51V holds less energy than a 100Ah pack at 64V. The number that lets you compare packs fairly is energy in ',
        { strong: 'kilowatt-hours (kWh)' },
        ':',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      title: 'The formula',
      text: 'Energy (kWh) = nominal voltage (V) × capacity (Ah) ÷ 1000. For example, 51.2V × 105Ah ÷ 1000 ≈ 5.4 kWh.',
    },
    {
      type: 'table',
      caption: 'Worked examples using the formula above',
      columns: ['Nominal voltage', 'Capacity', 'Energy'],
      rows: [
        ['51.2V', '105Ah', '≈ 5.4 kWh'],
        ['51.2V', '140Ah', '≈ 7.2 kWh'],
        ['64V', '105Ah', '≈ 6.7 kWh'],
      ],
    },
    { type: 'heading', level: 2, text: 'Turning kWh into range' },
    {
      type: 'paragraph',
      text: 'Range depends on how much energy your vehicle uses per kilometre, usually written as watt-hours per km (Wh/km). That figure changes a lot with load, road gradient, stop-start traffic, tyre pressure and driving style, so the most reliable number is one you measure on your own route.',
    },
    {
      type: 'list',
      ordered: true,
      items: [
        'Charge the battery fully and note the odometer reading.',
        'Drive a normal working day with a normal load.',
        'Note the distance covered and the state of charge left (most BMS displays or meters show this).',
        'Divide the energy used by the distance. If you used 60% of a 5.4 kWh pack (about 3.2 kWh) over 80 km, your consumption is roughly 40 Wh/km.',
      ],
    },
    {
      type: 'paragraph',
      text: 'Once you know your consumption, estimated range is simply usable energy ÷ Wh/km. Keep a margin of 15–20% so you are not running the pack to empty every day — it is easier on the battery and on your schedule. The figures in these examples are illustrations of the method, not a promise of what any particular vehicle will achieve.',
    },
    { type: 'heading', level: 2, text: 'Size for your day, not for a brochure' },
    {
      type: 'paragraph',
      text: 'Think about how you actually work. A driver who does one long shift with no chance to charge needs enough energy for the whole day plus a margin. A driver who can top up during a lunch break near home or a charging point can often manage with a smaller, lighter pack. A loader carrying heavy goods will use more energy per km than a passenger rickshaw on flat roads.',
    },
    { type: 'heading', level: 2, text: 'Check current, fit and connectors' },
    {
      type: 'list',
      items: [
        [
          { strong: 'Continuous and peak current: ' },
          'the battery’s BMS must allow at least the current your controller draws when climbing or starting loaded, otherwise it may cut out under load.',
        ],
        [
          { strong: 'Physical size and weight: ' },
          'measure the battery tray, including height under the seat, and check how the pack will be secured.',
        ],
        [
          { strong: 'Connector and wiring: ' },
          'confirm the main power connector and any meter or display wiring match your vehicle, or plan for a qualified electrician to fit the correct connector.',
        ],
        [
          { strong: 'Water and dust protection: ' },
          'monsoon water-logging is a real risk in many cities. Ask for the pack’s IP rating and where it will sit relative to the floor.',
        ],
      ],
    },
    { type: 'heading', level: 2, text: 'Plan the charger at the same time' },
    {
      type: 'paragraph',
      text: [
        'A lithium battery needs a charger made for its chemistry and its exact voltage. Buy them as a matched pair, and check the charger’s current rating against how long you have to charge between shifts. Our guide to ',
        { text: 'charging lithium batteries safely', href: '/blog/charging-lithium-batteries-safely' },
        ' covers the details.',
      ],
    },
    { type: 'heading', level: 2, text: 'Read the warranty properly' },
    {
      type: 'paragraph',
      text: 'Battery warranties are often written as a period or a number of cycles, whichever comes first, and may set conditions on the charger used or on physical damage. Read the exact wording on the product page and keep your invoice and the pack’s serial number safe.',
    },
    {
      type: 'callout',
      tone: 'tip',
      title: 'Quick checklist before you buy',
      text: 'Voltage matches the controller · kWh covers your daily distance with a margin · BMS current suits your controller · pack fits the tray · connector matches · matched charger · warranty terms understood.',
    },
  ],
};
