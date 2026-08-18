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
 */

export interface Appliance {
  id: string;
  name: string;
  /** Typical running consumption in watts. */
  watts: number;
  /** Start-up surge multiplier; 1 means no meaningful surge. */
  surge: number;
  group: 'Lighting & fans' | 'Entertainment & work' | 'Kitchen' | 'Heavy loads';
  /** Sensible starting quantity when the shopper adds it. */
  defaultQuantity: number;
  note?: string;
}

export const APPLIANCES: Appliance[] = [
  { id: 'led', name: 'LED light', watts: 9, surge: 1, group: 'Lighting & fans', defaultQuantity: 6 },
  { id: 'tube', name: 'Tube light', watts: 36, surge: 1, group: 'Lighting & fans', defaultQuantity: 2 },
  { id: 'fan', name: 'Ceiling fan', watts: 75, surge: 1.6, group: 'Lighting & fans', defaultQuantity: 4 },
  { id: 'bldc-fan', name: 'BLDC ceiling fan', watts: 32, surge: 1.4, group: 'Lighting & fans', defaultQuantity: 4 },
  { id: 'cooler', name: 'Air cooler', watts: 180, surge: 2.5, group: 'Lighting & fans', defaultQuantity: 1 },

  { id: 'tv', name: 'Television (LED)', watts: 110, surge: 1, group: 'Entertainment & work', defaultQuantity: 1 },
  { id: 'router', name: 'Router / ONT', watts: 15, surge: 1, group: 'Entertainment & work', defaultQuantity: 1 },
  { id: 'laptop', name: 'Laptop', watts: 65, surge: 1, group: 'Entertainment & work', defaultQuantity: 1 },
  { id: 'desktop', name: 'Desktop computer', watts: 220, surge: 1.2, group: 'Entertainment & work', defaultQuantity: 1 },
  { id: 'printer', name: 'Printer (standby)', watts: 30, surge: 3, group: 'Entertainment & work', defaultQuantity: 1, note: 'Laser printers surge heavily while printing — keep them off backup.' },

  { id: 'fridge', name: 'Refrigerator', watts: 200, surge: 3, group: 'Kitchen', defaultQuantity: 1, note: 'Cycles on and off, so average draw is lower than peak.' },
  { id: 'mixer', name: 'Mixer grinder', watts: 500, surge: 2.5, group: 'Kitchen', defaultQuantity: 1 },
  { id: 'induction', name: 'Induction cooktop', watts: 1600, surge: 1.2, group: 'Kitchen', defaultQuantity: 1, note: 'A heavy continuous load — expect a large battery requirement.' },
  { id: 'microwave', name: 'Microwave oven', watts: 1200, surge: 1.5, group: 'Kitchen', defaultQuantity: 1 },

  { id: 'pump', name: 'Water pump (1 HP)', watts: 750, surge: 3, group: 'Heavy loads', defaultQuantity: 1 },
  { id: 'washing', name: 'Washing machine', watts: 500, surge: 3, group: 'Heavy loads', defaultQuantity: 1 },
  { id: 'ac', name: 'Air conditioner (1 ton)', watts: 1200, surge: 3, group: 'Heavy loads', defaultQuantity: 1, note: 'Requires a high-capacity system and a large battery bank.' },
];

export const APPLIANCE_BY_ID = new Map(APPLIANCES.map((a) => [a.id, a]));

export type Selection = Record<string, number>;

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
  backupHours: number;
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

export function calculateSizing(selection: Selection, backupHours: number): SizingResult {
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

  const peakWatts = Math.round(runningWatts + largestSurgeDelta);
  const requiredVa = Math.round((runningWatts / POWER_FACTOR) * HEADROOM);

  const systemVoltage: 12 | 24 | 48 = requiredVa > 3000 ? 48 : requiredVa > 1800 ? 24 : 12;
  const batteriesInSeries = systemVoltage / 12;

  const requiredAh =
    runningWatts === 0
      ? 0
      : Math.ceil(
          (runningWatts * backupHours) / (systemVoltage * EFFICIENCY * DEPTH_OF_DISCHARGE) / 5,
        ) * 5;

  return {
    runningWatts: Math.round(runningWatts),
    peakWatts,
    requiredVa,
    systemVoltage,
    requiredAh,
    backupHours,
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

export function encodeSelection(selection: Selection, backupHours: number): string {
  const parts = Object.entries(selection)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => `${id}:${qty}`);
  const params = new URLSearchParams();
  if (parts.length > 0) params.set('load', parts.join(','));
  params.set('hours', String(backupHours));
  return params.toString();
}

export function decodeSelection(load: string | undefined, hours: string | undefined) {
  const selection: Selection = {};
  for (const part of (load ?? '').split(',').filter(Boolean)) {
    const [id, qty] = part.split(':');
    const quantity = Number(qty);
    if (APPLIANCE_BY_ID.has(id) && Number.isFinite(quantity) && quantity > 0) {
      selection[id] = Math.min(50, Math.round(quantity));
    }
  }
  const parsedHours = Number(hours);
  return {
    selection,
    backupHours: Number.isFinite(parsedHours) && parsedHours >= 1 && parsedHours <= 12 ? parsedHours : 4,
  };
}
