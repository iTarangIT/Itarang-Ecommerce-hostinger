import type { BlogPost } from '../types';

export const sizeHomeInverterBattery: BlogPost = {
  slug: 'sizing-a-home-inverter-battery',
  title: 'Sizing a home inverter battery for your load',
  description:
    'How to work out the battery capacity your home needs during power cuts: list your appliances, add up the watts, choose the backup hours, and allow for inverter losses and usable capacity.',
  date: '2026-10-10',
  author: 'iTarang team',
  category: 'Home backup',
  readingMinutes: 6,
  relatedCategoryPaths: ['/batteries/home-inverter', '/batteries/ess'],
  body: [
    {
      type: 'paragraph',
      text: 'Power cuts are still part of life in many Indian towns and cities, and the question every household asks is the same: how big a battery do we need to keep the essentials running? The answer is a short calculation, and you can do it with a pen and the labels on your appliances.',
    },
    { type: 'heading', level: 2, text: 'Step 1: decide what must keep running' },
    {
      type: 'paragraph',
      text: 'Backup is cheapest when it is selective. Most homes want fans, lights, the Wi-Fi router and phone charging; many add a TV, a laptop or a refrigerator. Heavy loads such as air conditioners, geysers, irons and induction cooktops draw a lot of power and usually need a much larger system.',
    },
    {
      type: 'paragraph',
      text: 'For each appliance, find its power rating in watts (W) on the label or in the manual. If only amps are given, multiply by 230V for an approximate figure. Then note how many of each you will run at the same time.',
    },
    {
      type: 'table',
      caption: 'An example list — use the ratings on your own appliances',
      columns: ['Appliance', 'Quantity', 'Rating', 'Total'],
      rows: [
        ['Ceiling fan', '3', '75 W', '225 W'],
        ['LED light', '6', '10 W', '60 W'],
        ['Wi-Fi router', '1', '15 W', '15 W'],
        ['LED TV', '1', '100 W', '100 W'],
        ['Total running load', '', '', '400 W'],
      ],
    },
    { type: 'heading', level: 2, text: 'Step 2: choose your backup hours' },
    {
      type: 'paragraph',
      text: 'How long are your typical cuts, and how long is the longest one you want to ride through? Multiply the running load by those hours to get the energy you need in watt-hours (Wh). In the example, 400 W for 3 hours is 1,200 Wh.',
    },
    { type: 'heading', level: 2, text: 'Step 3: allow for losses and usable capacity' },
    {
      type: 'paragraph',
      text: 'An inverter loses some energy turning the battery’s DC into AC for your home, so the battery has to supply a little more than your appliances use. Check your inverter’s stated efficiency; if you do not know it, allowing for around 85% is a reasonable working assumption.',
    },
    {
      type: 'paragraph',
      text: 'You also should not plan to drain a battery to absolutely zero. Lithium iron phosphate batteries can use most of their rated capacity, but leaving a margin protects the battery and covers ageing over the years. Check the usable capacity the battery maker states.',
    },
    {
      type: 'callout',
      tone: 'info',
      title: 'The calculation',
      text: 'Battery energy needed (Wh) = load (W) × hours ÷ inverter efficiency ÷ usable fraction. Example: 400 W × 3 h ÷ 0.85 ÷ 0.9 ≈ 1,570 Wh.',
    },
    { type: 'heading', level: 2, text: 'Step 4: convert to Ah at your system voltage' },
    {
      type: 'paragraph',
      text: 'Home inverters run at a fixed battery voltage — commonly 12V for smaller units and 24V or 48V for larger ones. Divide the energy needed by the battery’s nominal voltage to get amp-hours. A 12V-class lithium battery is usually rated around 12.8V nominal, so 1,570 Wh ÷ 12.8V ≈ 123Ah. Round up to the next available size.',
    },
    {
      type: 'paragraph',
      text: 'If the result is very large at 12V, that is often a sign you need a 24V or 48V inverter and battery instead. Higher-voltage systems carry the same power at lower current, which means thinner cables and less heat.',
    },
    { type: 'heading', level: 2, text: 'Step 5: check the inverter as well as the battery' },
    {
      type: 'list',
      items: [
        [
          { strong: 'Inverter rating: ' },
          'the inverter’s VA or watt rating must cover your total running load with headroom. The battery decides how long; the inverter decides how much at once.',
        ],
        [
          { strong: 'Starting surges: ' },
          'refrigerators, water pumps and other motors draw several times their running power for a moment when they start. Make sure the inverter can handle that surge.',
        ],
        [
          { strong: 'Charging profile: ' },
          'the inverter’s built-in charger must support the battery’s chemistry. Many current models have a lithium setting; confirm this before you buy.',
        ],
        [
          { strong: 'Recharge time: ' },
          'after a long cut, the battery needs to recharge before the next one. Check the inverter’s charging current against your battery size.',
        ],
      ],
    },
    { type: 'heading', level: 2, text: 'Let the calculator do the arithmetic' },
    {
      type: 'paragraph',
      text: [
        'Our ',
        { text: 'load calculator', href: '/tools/load-calculator' },
        ' runs these steps for you: pick your appliances, set the hours, and it suggests a battery size. It is a good way to compare options — for instance, how much extra capacity it takes to add a refrigerator to your backup list.',
      ],
    },
    {
      type: 'callout',
      tone: 'tip',
      title: 'Measure if you can',
      text: 'Appliance labels show maximum ratings, and real use is often lower — a fan on a low speed draws less than its label. A plug-in energy meter gives you real numbers, and real numbers give you a better-sized system.',
    },
    { type: 'heading', level: 2, text: 'Thinking bigger: solar and storage' },
    {
      type: 'paragraph',
      text: 'If you are planning rooftop solar or want to run larger loads for longer, an energy storage system (ESS) may suit you better than an inverter battery. The sizing logic is the same — load, hours, losses, usable capacity — just at a larger scale, and it is worth having an installer survey your home first.',
    },
  ],
};
