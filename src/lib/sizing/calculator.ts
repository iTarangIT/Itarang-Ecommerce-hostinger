/**
 * Load sizing.
 *
 * Two calculations, kept deliberately transparent so the page can show its
 * working rather than producing a number out of nowhere:
 *
 *   Inverter VA = running watts ÷ power factor, with headroom for surge
 *   Battery Ah  = (running watts × hours) ÷ (system voltage × efficiency × usable depth)
 *
 * Appliance wattages are typical figures for Indian households and are stated
 * on screen so a shopper can correct them against their own appliance ratings.
 *
 * PLACEHOLDER FORMULA. The business has said the sizing will follow the NBFC's
 * Excel workbook once it is shared. When it arrives, replace `calculateSizing`
 * (and the four constants below it) with that workbook's formula, keep the
 * `SizingResult` shape so `/api/sizing` and `lib/sizing/recommend.ts` keep
 * working unchanged, and re-check the tests in `calculator.test.ts` against it.
 */

export const APPLIANCE_GROUPS = [
  'Lighting & fans',
  'Entertainment & work',
  'Kitchen',
  'Heavy loads',
] as const;
export type ApplianceGroup = (typeof APPLIANCE_GROUPS)[number];

/**
 * Rooms, for the "pick a room" path.
 *
 * A second way into the same appliance list, not a second list: choosing a room
 * adds that room's typical appliances to the very same `Selection`, so the two
 * paths cannot produce different arithmetic and a shopper can start in one and
 * finish in the other.
 */
export const ROOMS = [
  { id: 'bedroom', name: 'Bedroom' },
  { id: 'living', name: 'Living room' },
  { id: 'kitchen', name: 'Kitchen' },
  { id: 'bathroom', name: 'Bathroom' },
  { id: 'study', name: 'Study / home office' },
] as const;
export type RoomId = (typeof ROOMS)[number]['id'];

export interface Appliance {
  id: string;
  name: string;
  /** Typical running consumption in watts. */
  watts: number;
  /** Start-up surge multiplier; 1 means no meaningful surge. */
  surge: number;
  group: ApplianceGroup;
  /** Rooms this appliance is normally found in, for the room-by-room path. */
  rooms: RoomId[];
  /** Sensible starting quantity when the shopper adds it. */
  defaultQuantity: number;
  note?: string;
}

export const APPLIANCES: Appliance[] = [
  { id: 'led', name: 'LED light', watts: 9, surge: 1, group: 'Lighting & fans', defaultQuantity: 6, rooms: ['bedroom', 'living', 'kitchen', 'bathroom', 'study'] },
  { id: 'tube', name: 'LED tube light', watts: 36, surge: 1, group: 'Lighting & fans', defaultQuantity: 2, rooms: ['living', 'kitchen', 'study'] },
  { id: 'fan', name: 'Ceiling fan', watts: 75, surge: 1.6, group: 'Lighting & fans', defaultQuantity: 4, rooms: ['bedroom', 'living', 'study'] },
  { id: 'bldc-fan', name: 'BLDC ceiling fan', watts: 32, surge: 1.4, group: 'Lighting & fans', defaultQuantity: 4, rooms: ['bedroom', 'living', 'study'] },
  { id: 'exhaust', name: 'Exhaust fan', watts: 40, surge: 1.8, group: 'Lighting & fans', defaultQuantity: 1, rooms: ['kitchen', 'bathroom'] },
  { id: 'cooler', name: 'Air cooler', watts: 180, surge: 2.5, group: 'Lighting & fans', defaultQuantity: 1, rooms: ['bedroom', 'living'] },

  { id: 'tv', name: 'Television (LED)', watts: 110, surge: 1, group: 'Entertainment & work', defaultQuantity: 1, rooms: ['living', 'bedroom'] },
  { id: 'settop', name: 'Set-top box', watts: 20, surge: 1, group: 'Entertainment & work', defaultQuantity: 1, rooms: ['living', 'bedroom'] },
  { id: 'router', name: 'Router / ONT', watts: 15, surge: 1, group: 'Entertainment & work', defaultQuantity: 1, rooms: ['living', 'study'] },
  { id: 'charger', name: 'Phone charger', watts: 12, surge: 1, group: 'Entertainment & work', defaultQuantity: 2, rooms: ['bedroom', 'living', 'study'] },
  { id: 'laptop', name: 'Laptop', watts: 65, surge: 1, group: 'Entertainment & work', defaultQuantity: 1, rooms: ['study', 'living'] },
  { id: 'desktop', name: 'Desktop computer', watts: 220, surge: 1.2, group: 'Entertainment & work', defaultQuantity: 1, rooms: ['study'] },
  { id: 'printer', name: 'Printer (standby)', watts: 30, surge: 3, group: 'Entertainment & work', defaultQuantity: 1, rooms: ['study'], note: 'Laser printers surge heavily while printing — keep them off backup.' },

  { id: 'fridge', name: 'Refrigerator', watts: 200, surge: 3, group: 'Kitchen', defaultQuantity: 1, rooms: ['kitchen'], note: 'Cycles on and off, so average draw is lower than peak.' },
  { id: 'mixer', name: 'Mixer grinder', watts: 500, surge: 2.5, group: 'Kitchen', defaultQuantity: 1, rooms: ['kitchen'] },
  { id: 'induction', name: 'Induction cooktop', watts: 1600, surge: 1.2, group: 'Kitchen', defaultQuantity: 1, rooms: ['kitchen'], note: 'A heavy continuous load — expect a large battery requirement.' },
  { id: 'microwave', name: 'Microwave oven', watts: 1200, surge: 1.5, group: 'Kitchen', defaultQuantity: 1, rooms: ['kitchen'] },

  { id: 'pump', name: 'Water pump (1 HP)', watts: 750, surge: 3, group: 'Heavy loads', defaultQuantity: 1, rooms: ['bathroom'] },
  { id: 'geyser', name: 'Water heater / geyser', watts: 2000, surge: 1.1, group: 'Heavy loads', defaultQuantity: 1, rooms: ['bathroom'], note: 'A sustained heating load. Most homes leave this off backup.' },
  { id: 'washing', name: 'Washing machine', watts: 500, surge: 3, group: 'Heavy loads', defaultQuantity: 1, rooms: ['bathroom'] },
  { id: 'iron', name: 'Electric iron', watts: 1000, surge: 1.1, group: 'Heavy loads', defaultQuantity: 1, rooms: ['bedroom'] },
  { id: 'ac', name: 'Air conditioner (1 ton)', watts: 1200, surge: 3, group: 'Heavy loads', defaultQuantity: 1, rooms: ['bedroom', 'living'], note: 'Requires a high-capacity system and a large battery bank.' },
];

export const APPLIANCE_BY_ID = new Map(APPLIANCES.map((a) => [a.id, a]));

export function appliancesForRoom(room: RoomId): Appliance[] {
  return APPLIANCES.filter((appliance) => appliance.rooms.includes(room));
}

export type Selection = Record<string, number>;

/**
 * An appliance the shopper described themselves.
 *
 * Livguard offers "Add Device" for anything not on the list, and without it a
 * household with a sewing machine or an aquarium pump has to either leave it
 * out — under-sizing — or file it under something else. `watts` is theirs, not
 * ours, so nothing here invents a rating.
 *
 * No surge multiplier: we do not know it, and guessing one would flow straight
 * into the peak figure the results screen prints. It is treated as 1, which is
 * stated on screen.
 */
export interface CustomAppliance {
  name: string;
  watts: number;
  quantity: number;
}

export const MAX_CUSTOM_APPLIANCES = 8;

/**
 * How much of the connected load actually runs at once — "average consumption".
 *
 * Livguard's control, with Livguard's three choices: 100%, 50% and 20%. It is
 * the fraction of the connected load drawn on average across the backup
 * window (a diversity / usage factor), so the energy the battery has to supply
 * is
 *
 *   load energy (Wh) = running watts × backup hours × average consumption
 *
 * **Applied to energy and never to power**, which is the whole design of it:
 *
 *   The *inverter* has to carry whatever is switched on at the moment the grid
 *   fails. Dividing its VA rating by a diversity factor would size it for a
 *   convenient average and let it trip on the first evening everything is on.
 *
 *   The *battery* supplies energy over a window, and if only half the load is
 *   running on average then half the watt-hours are drawn. That is what this
 *   figure legitimately reduces.
 *
 * So `requiredVa`, `peakWatts` and `runningWatts` ignore it entirely and only
 * `requiredAh` and `loadEnergyWh` respond to it. The default is 50%, labelled
 * "typical" (D-15, 27 Oct): at 100% every larger home preset needed more
 * battery than any bank we sell and the calculator dead-ended. The shopper can
 * still choose 100%, and the note under the control says what 50% assumes.
 *
 * Only these exact values are accepted anywhere (calculation and URL). Anything
 * unrecognised — including older links that carried `use=0.75` — falls back to
 * 100%, the conservative direction; only an absent value takes the default.
 */
export const DIVERSITY_OPTIONS = [
  { value: 1, label: '100%', description: 'Everything on backup runs together' },
  { value: 0.5, label: '50% typical', description: 'Typical — about half of it runs at any one time' },
  { value: 0.2, label: '20%', description: 'Only a few things run at once, on and off' },
] as const;

export const DEFAULT_DIVERSITY = 0.5;

/** What an unrecognised value becomes: everything runs together. */
const FAIL_CLOSED_DIVERSITY = 1;

function isDiversity(value: number): boolean {
  return DIVERSITY_OPTIONS.some((option) => option.value === value);
}

/**
 * Typical homes, as a starting point.
 *
 * Livguard opens on property type, and it is a better first question than a
 * list of appliances: almost nobody knows their connected load, and everybody
 * knows how many bedrooms they have. These are starting points to edit, not
 * claims about any particular home, and the screen says so. "Custom" is not a
 * preset — it is the empty list — so it lives in the component, not here.
 *
 * What each one assumes is on backup during a cut (wattages from `APPLIANCES`):
 *
 *   1 BHK  2 fans, 3 LED lights, 1 tube light, TV + set-top box, Wi-Fi router,
 *          1 phone charger                                        ≈ 370 W, 4 h
 *   2 BHK  3 fans, 5 LED lights, 2 tube lights, TV + set-top box, router,
 *          2 chargers, fridge                                     ≈ 710 W, 4 h
 *   3 BHK  4 fans, 8 LED lights, 2 tube lights, 2 TVs, 1 set-top box, router,
 *          3 chargers, laptop, fridge, kitchen exhaust fan        ≈ 1040 W, 6 h
 *   4 BHK  5 fans, 10 LED lights, 3 tube lights, 2 TVs + 2 set-top boxes,
 *          router, 4 chargers, 2 laptops, fridge, 2 exhaust fans ≈ 1310 W, 6 h
 *   Villa  7 fans, 14 LED lights, 4 tube lights, 3 TVs + 2 set-top boxes,
 *          2 routers, 5 chargers, 2 laptops, 2 fridges, 2 exhaust fans,
 *          1 HP water pump                                       ≈ 2615 W, 8 h
 *
 * Deliberately left out of every preset: air conditioners, geysers, irons,
 * induction and microwaves (most homes keep them off backup) and the mixer
 * grinder and washing machine (short, surge-heavy loads a shopper should opt in
 * to). They are one tap away in the list.
 */
export interface HomePreset {
  id: '1bhk' | '2bhk' | '3bhk' | '4bhk' | 'villa';
  label: string;
  description: string;
  selection: Selection;
  hours: number;
}

export const HOME_PRESETS: HomePreset[] = [
  {
    id: '1bhk',
    label: '1 BHK',
    description: '2 fans, 4 lights, TV, router',
    selection: { fan: 2, led: 3, tube: 1, tv: 1, settop: 1, router: 1, charger: 1 },
    hours: 4,
  },
  {
    id: '2bhk',
    label: '2 BHK',
    description: '3 fans, 7 lights, TV, router, fridge',
    selection: { fan: 3, led: 5, tube: 2, tv: 1, settop: 1, router: 1, charger: 2, fridge: 1 },
    hours: 4,
  },
  {
    id: '3bhk',
    label: '3 BHK',
    description: '4 fans, 10 lights, 2 TVs, fridge, laptop',
    selection: {
      fan: 4, led: 8, tube: 2, tv: 2, settop: 1, router: 1, charger: 3, laptop: 1, fridge: 1,
      exhaust: 1,
    },
    hours: 6,
  },
  {
    id: '4bhk',
    label: '4 BHK',
    description: '5 fans, 13 lights, 2 TVs, fridge, 2 laptops',
    selection: {
      fan: 5, led: 10, tube: 3, tv: 2, settop: 2, router: 1, charger: 4, laptop: 2, fridge: 1,
      exhaust: 2,
    },
    hours: 6,
  },
  {
    id: 'villa',
    label: 'Villa',
    description: '7 fans, 18 lights, 3 TVs, 2 fridges, water pump',
    selection: {
      fan: 7, led: 14, tube: 4, tv: 3, settop: 2, router: 2, charger: 5, laptop: 2, fridge: 2,
      exhaust: 2, pump: 1,
    },
    hours: 8,
  },
];

export interface SizingResult {
  runningWatts: number;
  /** Highest instantaneous demand, assuming the largest single surge coincides. */
  peakWatts: number;
  /** Inverter capacity required, in VA, before rounding to a real product. */
  requiredVa: number;
  /** Recommended system voltage — 12V, 24V or 48V. */
  systemVoltage: 12 | 24 | 48;
  /** Battery capacity required, in Ah at the recommended voltage. */
  requiredAh: number;
  /**
   * Energy the selected appliances consume over the window, in watt-hours.
   *
   * Running watts × hours, and nothing else. No efficiency, no depth of
   * discharge, no headroom — it is the shopper's own two inputs multiplied,
   * which is why it can be shown on screen as a fact rather than an estimate.
   */
  loadEnergyWh: number;
  /**
   * Power the battery must deliver, in watts, to serve `runningWatts` at the
   * inverter's output.
   *
   * `runningWatts / EFFICIENCY`. Stated here so the recommendation engine can
   * compare a load against a product's documented maximum discharge current
   * without holding a second copy of the efficiency figure — see
   * `docs/p1-b-2-catalogue-audit.md`, which records that figure as awaiting
   * business confirmation.
   */
  requiredDcWatts: number;
  backupHours: number;
  /** The simultaneous-use fraction that produced `loadEnergyWh`. 1 = all of it. */
  diversity: number;
  /** True when the load needs more than a single-battery 12V system. */
  needsBank: boolean;
  batteriesInSeries: number;
}

/** Typical inverter power factor. */
const POWER_FACTOR = 0.8;
/** Inverter + wiring losses. */
const EFFICIENCY = 0.85;
/** Usable depth of discharge — conservative, suits lead acid and lithium alike. */
const DEPTH_OF_DISCHARGE = 0.6;
/** Headroom over the running load so the inverter is not permanently at 100%. */
const HEADROOM = 1.2;

/**
 * Watts at the inverter output → watts the battery has to supply.
 *
 * The single place `EFFICIENCY` is applied to a power figure, so the
 * recommendation engine's discharge-limit check and this file cannot drift
 * apart. None of the four constants above is supported by any source document;
 * `docs/p1-b-2-catalogue-audit.md` records all four as awaiting business
 * confirmation, and none was changed in P1-B-2.
 */
export function dcWattsFor(runningWatts: number): number {
  return Math.ceil(runningWatts / EFFICIENCY);
}

/**
 * Size a home backup system from the appliances on backup.
 *
 * @param selection   appliance id → quantity, from `APPLIANCES`.
 * @param backupHours hours of backup wanted per power cut / day.
 * @param options.diversity "average consumption" — the fraction of the
 *   connected load drawn on average over the window. One of
 *   `DIVERSITY_OPTIONS` (1, 0.5 or 0.2); omitted means `DEFAULT_DIVERSITY`,
 *   unrecognised means 1. Scales
 *   `loadEnergyWh` and `requiredAh` only — see `DIVERSITY_OPTIONS`.
 * @param options.custom shopper-described appliances, added to running watts.
 *
 * Interim formula — to be replaced by the NBFC Excel when the business shares
 * it (see the note at the top of this file).
 */
export function calculateSizing(
  selection: Selection,
  backupHours: number,
  options: { diversity?: number; custom?: readonly CustomAppliance[] } = {},
): SizingResult {
  // Fails closed to "everything runs together". An out-of-range value must
  // never quietly become a smaller battery than the shopper was shown.
  const diversity =
    options.diversity === undefined
      ? DEFAULT_DIVERSITY
      : isDiversity(options.diversity)
        ? options.diversity
        : FAIL_CLOSED_DIVERSITY;

  let runningWatts = 0;
  let largestSurgeDelta = 0;

  for (const [id, quantity] of Object.entries(selection)) {
    const appliance = APPLIANCE_BY_ID.get(id);
    if (!appliance || quantity <= 0) continue;
    const total = appliance.watts * quantity;
    runningWatts += total;
    // Only one appliance realistically starts at the exact same instant.
    const surgeDelta = appliance.watts * appliance.surge - appliance.watts;
    if (surgeDelta > largestSurgeDelta) largestSurgeDelta = surgeDelta;
  }

  // Shopper-described appliances carry no surge multiplier — we do not know one
  // and will not invent it — so they add to the running load and never to peak.
  for (const entry of options.custom ?? []) {
    if (!Number.isFinite(entry.watts) || entry.watts <= 0) continue;
    if (!Number.isFinite(entry.quantity) || entry.quantity <= 0) continue;
    runningWatts += entry.watts * entry.quantity;
  }

  const peakWatts = Math.round(runningWatts + largestSurgeDelta);
  const requiredVa = Math.round((runningWatts / POWER_FACTOR) * HEADROOM);

  const systemVoltage: 12 | 24 | 48 = requiredVa > 3000 ? 48 : requiredVa > 1800 ? 24 : 12;
  const batteriesInSeries = systemVoltage / 12;

  // Diversity enters here and nowhere else. `requiredVa` and `peakWatts` above
  // are deliberately computed from the full connected load — see the note on
  // `DIVERSITY_OPTIONS` for why sizing an inverter off an average is unsafe.
  const energyWh = runningWatts * backupHours * diversity;

  const requiredAh =
    runningWatts === 0
      ? 0
      : Math.ceil(energyWh / (systemVoltage * EFFICIENCY * DEPTH_OF_DISCHARGE) / 5) * 5;

  return {
    runningWatts: Math.round(runningWatts),
    peakWatts,
    requiredVa,
    systemVoltage,
    requiredAh,
    loadEnergyWh: Math.round(energyWh),
    requiredDcWatts: dcWattsFor(runningWatts),
    backupHours,
    diversity,
    needsBank: systemVoltage > 12,
    batteriesInSeries,
  };
}

/** Assumptions surfaced on the page so the number is auditable, not magic. */
export const SIZING_ASSUMPTIONS = [
  { label: 'Power factor', value: `${POWER_FACTOR}` },
  { label: 'Inverter and wiring efficiency', value: `${Math.round(EFFICIENCY * 100)}%` },
  { label: 'Usable battery depth of discharge', value: `${Math.round(DEPTH_OF_DISCHARGE * 100)}%` },
  { label: 'Capacity headroom over running load', value: `${Math.round((HEADROOM - 1) * 100)}%` },
];

/* -------------------------------------------------------- URL round-trip */

export interface CalculatorState {
  selection: Selection;
  backupHours: number;
  diversity: number;
  custom: CustomAppliance[];
}

/**
 * Custom appliances in a query string.
 *
 * `name~watts~quantity`, tilde-separated because a tilde is one of the few
 * characters that survives a URL unescaped and does not appear in an appliance
 * name. Names are stripped of the two delimiters on the way in rather than
 * escaped: a shareable link is not worth a parser.
 */
function encodeCustom(custom: readonly CustomAppliance[]): string {
  return custom
    .filter((entry) => entry.watts > 0 && entry.quantity > 0)
    .slice(0, MAX_CUSTOM_APPLIANCES)
    .map((entry) => `${entry.name.replace(/[,~]/g, ' ').trim()}~${entry.watts}~${entry.quantity}`)
    .join(',');
}

function decodeCustom(raw: string | undefined): CustomAppliance[] {
  const out: CustomAppliance[] = [];
  for (const part of (raw ?? '').split(',').filter(Boolean)) {
    const [name, watts, quantity] = part.split('~');
    const w = Number(watts);
    const q = Number(quantity);
    if (!name || !Number.isFinite(w) || !Number.isFinite(q)) continue;
    if (w <= 0 || w > 10_000 || q <= 0) continue;
    out.push({
      name: name.slice(0, 40),
      watts: Math.round(w),
      quantity: Math.min(50, Math.round(q)),
    });
    if (out.length >= MAX_CUSTOM_APPLIANCES) break;
  }
  return out;
}

export function encodeSelection(
  selection: Selection,
  backupHours: number,
  options: { diversity?: number; custom?: readonly CustomAppliance[] } = {},
): string {
  const parts = Object.entries(selection)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => `${id}:${qty}`);
  const params = new URLSearchParams();
  if (parts.length > 0) params.set('load', parts.join(','));
  params.set('hours', String(backupHours));

  // Omitted at the default so an ordinary link stays short and, more usefully,
  // so a link that *does* carry it is visibly a link with an assumption in it.
  if (options.diversity !== undefined && options.diversity !== DEFAULT_DIVERSITY) {
    params.set('use', String(options.diversity));
  }
  const custom = encodeCustom(options.custom ?? []);
  if (custom) params.set('custom', custom);

  return params.toString();
}

export function decodeSelection(
  load: string | undefined,
  hours: string | undefined,
  options: { use?: string; custom?: string } = {},
): CalculatorState {
  const selection: Selection = {};
  for (const part of (load ?? '').split(',').filter(Boolean)) {
    const [id, qty] = part.split(':');
    const quantity = Number(qty);
    if (APPLIANCE_BY_ID.has(id) && Number.isFinite(quantity) && quantity > 0) {
      selection[id] = Math.min(50, Math.round(quantity));
    }
  }
  const parsedHours = Number(hours);
  const parsedUse = options.use === undefined ? DEFAULT_DIVERSITY : Number(options.use);

  return {
    selection,
    backupHours:
      Number.isFinite(parsedHours) && parsedHours >= 1 && parsedHours <= 12 ? parsedHours : 4,
    // Anything unrecognised falls back to "everything runs together", so a
    // mangled link cannot present a smaller requirement than the real one.
    diversity: isDiversity(parsedUse) ? parsedUse : FAIL_CLOSED_DIVERSITY,
    custom: decodeCustom(options.custom),
  };
}
