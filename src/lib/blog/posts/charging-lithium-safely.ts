import type { BlogPost } from '../types';

export const chargingLithiumSafely: BlogPost = {
  slug: 'charging-lithium-batteries-safely',
  title: 'Charging lithium batteries safely: chargers, heat, storage',
  description:
    'Everyday habits that keep an EV or home lithium battery safe and long-lived in Indian conditions: the right charger, where and when to charge, handling summer heat and monsoon damp, and storing a battery you are not using.',
  date: '2026-10-13',
  author: 'iTarang team',
  category: 'Care & safety',
  readingMinutes: 6,
  relatedCategoryPaths: [
    '/chargers',
    '/batteries/ev-2-wheeler',
    '/batteries/ev-3-wheeler',
    '/batteries/home-inverter',
  ],
  body: [
    {
      type: 'paragraph',
      text: 'Lithium iron phosphate (LFP) is one of the most stable lithium chemistries, and a well-built pack with a good battery management system (BMS) is designed to be safe in daily use. Safety still depends on how the battery is charged, where it is kept, and how it is treated. These habits cost nothing and make a real difference.',
    },
    { type: 'heading', level: 2, text: 'Use the charger made for your battery' },
    {
      type: 'paragraph',
      text: 'Every lithium battery has a specific full-charge voltage and a maximum charge current. The charger supplied with the battery, or one the battery maker specifies, is built to stop at exactly that voltage. A charger meant for a different voltage or chemistry may push the pack beyond its limit or leave it chronically undercharged.',
    },
    {
      type: 'list',
      items: [
        'Check the charger label: output voltage, output current and chemistry should all match the battery’s specification.',
        'Do not use "universal" or unbranded chargers whose output you cannot verify.',
        'Replace a charger with a damaged cable, a cracked case, or a plug that is discoloured or loose.',
        'For home inverters, set the inverter’s battery type to lithium if it has the option, or confirm with the installer that its charging matches the battery.',
      ],
    },
    { type: 'heading', level: 2, text: 'Where to charge' },
    {
      type: 'list',
      items: [
        [
          { strong: 'Dry, ventilated and shaded: ' },
          'a covered parking area or a well-aired room. Avoid charging in direct sun, and never in a closed space next to your only exit.',
        ],
        [
          { strong: 'A proper socket: ' },
          'plug the charger into a correctly rated, earthed wall socket protected by an MCB. Avoid extension boards and chains of adapters for high-current chargers.',
        ],
        [
          { strong: 'Away from things that burn: ' },
          'keep the charger and battery clear of curtains, cardboard, fuel cans and cushions.',
        ],
        [
          { strong: 'On a hard surface: ' },
          'chargers get warm in normal use and need air around them. Do not cover them.',
        ],
      ],
    },
    { type: 'heading', level: 2, text: 'Heat: India’s biggest battery challenge' },
    {
      type: 'paragraph',
      text: 'High temperature speeds up the ageing of any lithium battery, and charging adds its own heat. In peak summer a pack that has been standing in the sun, or has just finished a hard run, may be hotter than is ideal for charging.',
    },
    {
      type: 'list',
      items: [
        'After a long ride or a heavy load, let the pack rest in the shade for a while before you plug it in.',
        'Park in shade wherever you can. A battery under a seat in afternoon sun gets much hotter than the air around it.',
        'If the BMS stops charging because of temperature, that is the protection working. Let the battery cool, then try again.',
        'In very cold regions, such as hill areas in winter, avoid charging a pack that is below freezing; let it warm up indoors first.',
      ],
    },
    { type: 'heading', level: 2, text: 'Monsoon and moisture' },
    {
      type: 'paragraph',
      text: 'Water and electricity are a bad combination. Avoid driving an EV through deep water-logging, and never connect a charger to a wet plug or socket. If your battery or vehicle has been submerged, do not charge it — have it inspected by the seller or an authorised service centre first.',
    },
    { type: 'heading', level: 2, text: 'Everyday charging habits' },
    {
      type: 'list',
      items: [
        'You do not need to run a lithium battery flat before charging. Topping up when convenient is fine.',
        'Unplug once charging is complete, especially if you are charging away from home.',
        'Stay reasonably close while charging and avoid leaving a charge running unattended in a closed room overnight.',
        'Check the connectors now and then. Blackening, melting or a burning smell means a poor connection that needs attention.',
      ],
    },
    { type: 'heading', level: 2, text: 'Storing a battery you are not using' },
    {
      type: 'paragraph',
      text: 'If a vehicle will be parked for weeks, or a spare pack is going into storage, the way you leave it matters.',
    },
    {
      type: 'list',
      items: [
        'Store it partly charged — roughly half full is a common recommendation — rather than completely full or completely empty.',
        'Keep it somewhere cool and dry, away from direct sunlight.',
        'Disconnect it from the vehicle or inverter if the maker recommends it, since some systems draw a small current even when switched off.',
        'Check the charge level every couple of months and top it up so it never sits empty.',
      ],
    },
    {
      type: 'callout',
      tone: 'warning',
      title: 'Warning signs — stop and disconnect',
      text: 'Swelling or a bulging case, hissing, smoke, an unusual smell, or a pack that is very hot to touch. Switch off and unplug at the wall if it is safe to do so, move people away, and call the seller’s support line. Do not open or try to repair the pack yourself.',
    },
    { type: 'heading', level: 2, text: 'At the end of its life' },
    {
      type: 'paragraph',
      text: [
        'Lithium batteries must not go into household waste. Under India’s Battery Waste Management Rules, 2022, used batteries are collected and recycled through producers’ take-back channels. Contact ',
        { text: 'our support team', href: '/support' },
        ' when you are ready to replace a battery and we will tell you how to return the old one.',
      ],
    },
  ],
};
