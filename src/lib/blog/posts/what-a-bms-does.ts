import type { BlogPost } from '../types';

export const whatABmsDoes: BlogPost = {
  slug: 'what-a-bms-does',
  title: 'What a BMS does and why it matters',
  description:
    'The battery management system is the electronics inside every lithium pack. What it monitors, what it protects against, why it balances cells, and what its behaviour means for you day to day.',
  date: '2026-10-15',
  author: 'iTarang team',
  category: 'Buying guide',
  readingMinutes: 6,
  relatedCategoryPaths: [
    '/batteries/ev-3-wheeler',
    '/batteries/ev-2-wheeler',
    '/batteries/home-inverter',
    '/batteries/ess',
  ],
  body: [
    {
      type: 'paragraph',
      text: 'Every lithium battery pack, whether it powers an e-rickshaw, a scooter or a home inverter, is made of many individual cells wired together. Between those cells and the outside world sits a circuit board called the battery management system, or BMS. You rarely see it, but it decides how safely and how long your battery will work.',
    },
    { type: 'heading', level: 2, text: 'Why a lithium pack needs a BMS' },
    {
      type: 'paragraph',
      text: 'Lithium cells perform well inside a defined operating window of voltage, current and temperature, and they age quickly or can be damaged outside it. A pack might have sixteen or more cells in series, and no two cells are ever perfectly identical. The BMS watches each of them and steps in before any one of them leaves that safe window.',
    },
    { type: 'heading', level: 2, text: 'What it monitors' },
    {
      type: 'list',
      items: [
        [{ strong: 'Cell voltages: ' }, 'each cell, or each group of parallel cells, individually.'],
        [{ strong: 'Pack current: ' }, 'how much is flowing in while charging and out while driving.'],
        [
          { strong: 'Temperature: ' },
          'through sensors placed among the cells, and often on the BMS board itself.',
        ],
        [
          { strong: 'State of charge: ' },
          'an estimate of how full the pack is, calculated from voltage and the current that has flowed in and out.',
        ],
      ],
    },
    { type: 'heading', level: 2, text: 'What it protects against' },
    {
      type: 'table',
      caption: 'The main protections and what you may notice when one acts',
      columns: ['Protection', 'What it prevents', 'What you may notice'],
      rows: [
        [
          'Over-voltage',
          'Any cell being charged beyond its limit',
          'Charging stops, sometimes before the charger shows full',
        ],
        [
          'Under-voltage',
          'Cells being drained too far',
          'Power cuts off when the pack is nearly empty',
        ],
        [
          'Over-current',
          'More current than the cells and wiring can carry',
          'Power cuts out under heavy load, such as a steep climb',
        ],
        ['Short circuit', 'A sudden, very large current', 'The pack shuts off immediately'],
        [
          'Temperature',
          'Charging or discharging when too hot or too cold',
          'Charging or driving is paused until the pack recovers',
        ],
      ],
    },
    {
      type: 'paragraph',
      text: 'When a protection acts, the BMS opens an internal switch and disconnects the pack. That is the system doing its job. Once the cause has gone — the pack has cooled, the heavy load has stopped, or a charger is connected to a pack that cut out on low voltage — it will normally reconnect. If cut-outs keep happening, contact the seller rather than working around them.',
    },
    { type: 'heading', level: 2, text: 'Cell balancing' },
    {
      type: 'paragraph',
      text: 'Because cells are never perfectly matched, some reach full charge slightly before others. Over many cycles those small differences add up: the first cell to fill stops the charge for the whole pack, and the first to empty ends the discharge, so the usable capacity shrinks.',
    },
    {
      type: 'paragraph',
      text: 'Balancing evens this out. The most common method, passive balancing, bleeds a small amount of energy from the fuller cells as heat near the top of the charge so the others can catch up. Active balancing moves energy from fuller cells to emptier ones instead. Either way, balancing mostly happens near full charge — which is one reason it helps to let a pack charge completely from time to time, as the battery maker advises.',
    },
    { type: 'heading', level: 2, text: 'Communication and data' },
    {
      type: 'paragraph',
      text: 'Many BMS boards can share information with the outside world through a display, a vehicle controller, an inverter or a phone app. Depending on the design, this can show state of charge, cell voltages, temperature and fault history. For fleet operators, this data helps spot a pack that is ageing faster than the rest; for service technicians, it helps diagnose problems without opening the battery.',
    },
    { type: 'heading', level: 2, text: 'What the BMS cannot do' },
    {
      type: 'list',
      items: [
        'It cannot make up for the wrong charger. A charger with the wrong output voltage works against the BMS on every charge.',
        'It cannot protect against physical damage, crushing or water getting into the pack.',
        'It cannot reverse the effect of long exposure to high heat, which ages cells regardless.',
        'It relies on correct installation. Loose or undersized cables and connectors can overheat outside the pack, where the BMS is not measuring.',
      ],
    },
    { type: 'heading', level: 2, text: 'Questions worth asking when you buy' },
    {
      type: 'list',
      ordered: true,
      items: [
        'What are the continuous and peak discharge current limits, and do they suit my controller or inverter?',
        'What is the maximum charge current, and which charger do you specify?',
        'At what temperatures does the BMS stop charging and discharging?',
        'Does the pack show state of charge, and does it work with my vehicle display or inverter?',
        'What does the warranty say about BMS faults, and how are they handled?',
      ],
    },
    {
      type: 'callout',
      tone: 'tip',
      title: 'In short',
      text: [
        'A good BMS is what lets a lithium pack be used hard, every day, without being babied. Pair it with the right charger and sensible habits — see our guide to ',
        { text: 'charging lithium batteries safely', href: '/blog/charging-lithium-batteries-safely' },
        ' — and it will look after the cells for you.',
      ],
    },
  ],
};
