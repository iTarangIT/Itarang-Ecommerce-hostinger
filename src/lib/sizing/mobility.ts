import type { Product } from '@/lib/commerce/types';
import { linkedProducts } from '@/lib/catalog/linked-products';

/**
 * Mobility sizing — an EV traction battery for a 2-wheeler or an e-rickshaw.
 *
 * The question a rider or fleet owner actually has is "my vehicle has this
 * motor and runs on this voltage; I need it to do so many kilometres a day —
 * what pack?". So the inputs are the four things written on the vehicle or
 * known to its owner (vehicle type, motor watts, system voltage, daily km) plus
 * its age, and the arithmetic is kept transparent enough to print on the page:
 *
 *   Wh/km       = base(type) × √(motor W ÷ reference W), clamped per type
 *   Energy Wh   = daily km × Wh/km × age factor ÷ usable depth × (1 + reserve)
 *   Energy Ah   = Energy Wh ÷ nominal pack voltage
 *   Current Ah  = (motor W ÷ nominal voltage) ÷ max C-rate(type)
 *   Required Ah = max(Energy Ah, Current Ah), rounded up
 *
 * **Every output is an estimate.** Real consumption depends on payload,
 * gradients, traffic, tyre pressure and riding style far more than on any
 * figure we can ask for. The constants below are stated on screen so a shopper
 * — or a dealer who knows the vehicle better — can see what was assumed. None
 * of them is a product fact; product facts are read from the catalogue only.
 *
 * Client-safe: no server imports, so the calculator component computes the
 * same figures in the browser that the API route computes on the server.
 */

export type VehicleType = '2w' | '3w';

export const VEHICLE_TYPES: ReadonlyArray<{ id: VehicleType; label: string; description: string }> =
  [
    { id: '2w', label: '2-wheeler', description: 'Electric scooter or motorcycle' },
    { id: '3w', label: '3-wheeler', description: 'E-rickshaw or e-loader' },
  ];

/**
 * Energy use per kilometre at a reference motor rating.
 *
 * - **2-wheeler: 30 Wh/km at a 1000 W-class hub motor.** Typical Indian
 *   low/mid-speed scooters with one rider sit between roughly 20 and 40 Wh/km;
 *   30 is the middle of that band.
 * - **3-wheeler e-rickshaw: 70 Wh/km at a 1200 W motor** (the middle of the
 *   common 1000–1500 W fitment). Loaded e-rickshaws with 4 passengers run
 *   roughly 55–90 Wh/km depending on load and road.
 *
 * `min`/`max` are those bands. The scaled figure is clamped to them so an
 * unusual motor rating cannot produce a consumption no real vehicle has.
 */
export const CONSUMPTION: Readonly<
  Record<VehicleType, { baseWhPerKm: number; referenceWatts: number; min: number; max: number }>
> = {
  '2w': { baseWhPerKm: 30, referenceWatts: 1000, min: 20, max: 40 },
  '3w': { baseWhPerKm: 70, referenceWatts: 1200, min: 55, max: 90 },
};

/**
 * Exponent applied to motor power when scaling consumption.
 *
 * 0.5 — a square root — because the motor rating is a proxy, not a cause. A
 * bigger motor usually means a heavier, faster vehicle, which does use more
 * energy per km, but per-km energy is set by rolling resistance, mass and
 * aerodynamic drag at cruising speed, not by peak motor capability. Doubling
 * the motor rating does not double consumption; a square root lifts it by
 * ~41%, which is in line with how scooter Wh/km rises from 250 W city models to
 * 2 kW performance models. Linear scaling (exponent 1) would badly overstate
 * big motors; no scaling (exponent 0) would ignore a real effect.
 */
export const MOTOR_SCALING_EXPONENT = 0.5;

/**
 * Extra consumption per year of vehicle age, and its cap.
 *
 * Worn wheel bearings, under-inflated or worn tyres, a tired controller and
 * brake drag all raise the energy a vehicle needs per km. +2% a year, capped
 * at +20% (reached at 10 years), is a conservative allowance — it nudges the
 * pack up for an old vehicle rather than pretending a 12-year-old e-rickshaw
 * runs like a new one.
 */
export const AGEING_PER_YEAR = 0.02;
export const AGEING_CAP = 0.2;

/**
 * Usable depth of discharge for a LiFePO4 traction pack.
 *
 * 90%: the BMS cuts off before the cells are fully empty, and routinely
 * running a pack to its absolute floor shortens its life.
 */
export const LFP_USABLE_DEPTH = 0.9;

/**
 * Sizing reserve on top of the daily requirement.
 *
 * 10% so the vehicle finishes its day with something left — for a detour, a
 * headwind, or the gradual capacity fade every battery has over its life.
 * Applied to sizing only. Estimated range on a given pack is the plain usable
 * energy ÷ consumption, so a pack sized exactly at `requiredAh` shows a range
 * about 10% above the daily km asked for.
 */
export const SIZING_RESERVE = 0.1;

/**
 * Highest continuous C-rate we size to.
 *
 * Continuous current = motor watts ÷ pack voltage. A pack asked to deliver
 * more than its rated continuous current runs hot and ages fast, so the pack
 * must be large enough that the motor's rated draw stays under:
 *
 * - **1C for a 2-wheeler** — short trips, light vehicle, high power-to-weight.
 * - **0.5C for a 3-wheeler** — heavy, loaded, often at full throttle for long
 *   stretches and in summer heat, so a gentler continuous rate is the safer
 *   assumption.
 *
 * It rarely governs (energy usually does) but it stops a short-range,
 * high-power request being answered with a pack too small to feed the motor.
 */
export const MAX_C_RATE: Readonly<Record<VehicleType, number>> = { '2w': 1, '3w': 0.5 };

/** Voltage choices offered on screen. Any sensible value is still accepted. */
export const VOLTAGE_PRESETS: Readonly<Record<VehicleType, readonly number[]>> = {
  '2w': [48, 60, 72],
  '3w': [48, 51, 60, 64],
};

export const MOTOR_PRESETS: Readonly<Record<VehicleType, readonly number[]>> = {
  '2w': [250, 500, 1000, 1500, 2000],
  '3w': [850, 1000, 1200, 1500],
};

/**
 * The pack's nominal voltage for a vehicle's stated system voltage.
 *
 * Vehicles are labelled by a round "system" figure; LiFePO4 packs are built
 * from 3.2 V cells, so the pack that runs a "48 V" vehicle is 16 cells, 51.2 V
 * nominal. The table holds the series counts the market uses:
 *
 *   48 V → 16S = 51.2 V      60 V → 19S = 60.8 V      64 V → 20S = 64 V
 *   72 V → 23S = 73.6 V      51 V → (already a 16S label) 51.2 V
 *
 * Anything else is taken at face value — the shopper may already be quoting a
 * nominal pack voltage.
 */
export const NOMINAL_VOLTAGE_BY_SYSTEM: ReadonlyMap<number, number> = new Map([
  [48, 51.2],
  [51, 51.2],
  [60, 60.8],
  [64, 64],
  [72, 73.6],
]);

export function nominalVoltageFor(systemVoltage: number): number {
  return NOMINAL_VOLTAGE_BY_SYSTEM.get(systemVoltage) ?? systemVoltage;
}

/** A pack voltage matches when within ±3% of the required nominal voltage. */
export const VOLTAGE_TOLERANCE = 0.03;

export const LIMITS = {
  motorWatts: { min: 250, max: 5000 },
  dailyKm: { min: 1, max: 300 },
  vehicleAgeYears: { min: 0, max: 15 },
  systemVoltage: { min: 24, max: 100 },
} as const;

export interface MobilityInput {
  vehicleType: VehicleType;
  motorWatts: number;
  systemVoltage: number;
  /** Range required per charge, in km. */
  dailyKm: number;
  vehicleAgeYears: number;
}

export interface MobilityResult {
  input: MobilityInput;
  /** Estimated consumption including the ageing allowance, Wh/km, one decimal. */
  whPerKm: number;
  /** Consumption before the ageing allowance, Wh/km, one decimal. */
  baseWhPerKm: number;
  /** 1.00–1.20. */
  ageFactor: number;
  /** Pack energy required for the daily km, with depth and reserve applied. */
  energyWh: number;
  /** Nominal LiFePO4 pack voltage for the system voltage. */
  nominalVoltage: number;
  /** Motor rated watts ÷ nominal voltage. */
  continuousCurrentA: number;
  /** Ah required to carry the energy. */
  energyAh: number;
  /** Ah required to keep the continuous current within the C-rate limit. */
  currentAh: number;
  /** max(energyAh, currentAh), rounded up to a whole Ah. */
  requiredAh: number;
  /** Which of the two requirements set `requiredAh`. */
  governedBy: 'energy' | 'current';
  /** Plain-language caveats to print beside the figures. */
  notes: string[];
  /** Estimated km per full charge for a pack of `ah` at `nominalVoltage`. */
  estimatedRangeForAh: (ah: number) => number;
}

/** The serialisable part of a result — what crosses the wire. */
export type MobilityFigures = Omit<MobilityResult, 'estimatedRangeForAh'>;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function ageFactorFor(vehicleAgeYears: number): number {
  const years = Math.max(0, vehicleAgeYears);
  return 1 + Math.min(years * AGEING_PER_YEAR, AGEING_CAP);
}

/** Consumption before ageing, in Wh/km. Unrounded. */
export function baseConsumption(vehicleType: VehicleType, motorWatts: number): number {
  const c = CONSUMPTION[vehicleType];
  const scaled = c.baseWhPerKm * Math.pow(motorWatts / c.referenceWatts, MOTOR_SCALING_EXPONENT);
  return clamp(scaled, c.min, c.max);
}

/**
 * Estimated km on one full charge of a pack of `ah` at `nominalVoltage`.
 *
 * Usable energy ÷ aged consumption. The sizing reserve is deliberately not
 * subtracted — this is the estimate of what the pack does, not the target it
 * was sized to.
 */
export function estimatedRangeKm(
  ah: number,
  nominalVoltage: number,
  whPerKmAged: number,
): number {
  if (!(ah > 0) || !(nominalVoltage > 0) || !(whPerKmAged > 0)) return 0;
  return Math.round((ah * nominalVoltage * LFP_USABLE_DEPTH) / whPerKmAged);
}

export function calculateMobility(input: MobilityInput): MobilityResult {
  const { vehicleType, motorWatts, systemVoltage, dailyKm, vehicleAgeYears } = input;
  const c = CONSUMPTION[vehicleType];

  const unclamped =
    c.baseWhPerKm * Math.pow(motorWatts / c.referenceWatts, MOTOR_SCALING_EXPONENT);
  const base = baseConsumption(vehicleType, motorWatts);
  const ageFactor = ageFactorFor(vehicleAgeYears);
  const whPerKmAged = base * ageFactor;

  const nominalVoltage = nominalVoltageFor(systemVoltage);

  // Energy the pack must hold: what the day uses, grossed up for the part of
  // the pack the BMS will not let us use, plus the reserve.
  const energyWh = ((dailyKm * whPerKmAged) / LFP_USABLE_DEPTH) * (1 + SIZING_RESERVE);
  const energyAh = energyWh / nominalVoltage;

  // Current floor: the motor's rated draw must stay within the C-rate limit.
  const continuousCurrentA = motorWatts / nominalVoltage;
  const currentAh = continuousCurrentA / MAX_C_RATE[vehicleType];

  const governedBy: MobilityResult['governedBy'] = currentAh > energyAh ? 'current' : 'energy';
  const requiredAh = Math.ceil(Math.max(energyAh, currentAh));

  const notes: string[] = [
    'These are estimates. Payload, gradients, traffic, tyre pressure and riding style change real-world range.',
  ];
  if (unclamped < c.min || unclamped > c.max) {
    notes.push(
      `Consumption held at ${unclamped < c.min ? c.min : c.max} Wh/km, the ${
        unclamped < c.min ? 'lowest' : 'highest'
      } figure we use for a ${vehicleType === '2w' ? '2-wheeler' : '3-wheeler'}.`,
    );
  }
  if (ageFactor > 1) {
    notes.push(
      `A ${vehicleAgeYears}-year-old vehicle is assumed to use ${Math.round(
        (ageFactor - 1) * 100,
      )}% more energy per km than a new one${ageFactor >= 1 + AGEING_CAP ? ' (the maximum allowance)' : ''}.`,
    );
  }
  if (governedBy === 'current') {
    notes.push(
      `The motor's draw (about ${Math.round(continuousCurrentA)} A) sets the minimum size here, not the distance: a smaller pack would run above ${MAX_C_RATE[vehicleType]}C continuously.`,
    );
  }
  if (nominalVoltage !== systemVoltage) {
    notes.push(
      `A ${systemVoltage} V vehicle runs on a ${nominalVoltage} V nominal LiFePO4 pack.`,
    );
  }

  return {
    input,
    whPerKm: round1(whPerKmAged),
    baseWhPerKm: round1(base),
    ageFactor: Math.round(ageFactor * 100) / 100,
    energyWh: Math.round(energyWh),
    nominalVoltage,
    continuousCurrentA: round1(continuousCurrentA),
    energyAh: round1(energyAh),
    currentAh: round1(currentAh),
    requiredAh,
    governedBy,
    notes,
    estimatedRangeForAh: (ah: number) => estimatedRangeKm(ah, nominalVoltage, whPerKmAged),
  };
}

/** Assumptions surfaced on the page so the number is auditable, not magic. */
export const MOBILITY_ASSUMPTIONS = [
  { label: '2-wheeler consumption', value: '30 Wh/km at 1000 W (20–40)' },
  { label: 'E-rickshaw consumption', value: '70 Wh/km at 1200 W (55–90)' },
  { label: 'Motor power scaling', value: '√(motor W ÷ reference W)' },
  { label: 'Ageing allowance', value: `+${AGEING_PER_YEAR * 100}% a year, max +${AGEING_CAP * 100}%` },
  { label: 'Usable depth of discharge (LiFePO4)', value: `${LFP_USABLE_DEPTH * 100}%` },
  { label: 'Sizing reserve', value: `${SIZING_RESERVE * 100}%` },
  { label: 'Max continuous C-rate', value: '1C (2W), 0.5C (3W)' },
];

/* ------------------------------------------------------- recommendation */

export const EV_SUBCATEGORY: Readonly<Record<VehicleType, string>> = {
  '2w': 'ev-2-wheeler',
  '3w': 'ev-3-wheeler',
};

export interface PackRecommendation {
  product: Product;
  /** Estimated km on one full charge of this pack, for this vehicle. */
  estimatedRangeKm: number;
  /** True when the pack is below `requiredAh` — the largest we have, not enough. */
  shortfall: boolean;
  /** Chargers whose output matches this pack, best first (from `linkedProducts`). */
  chargers: Product[];
}

export function voltageMatches(packVoltage: number | undefined, nominalVoltage: number): boolean {
  if (packVoltage === undefined || !(packVoltage > 0)) return false;
  return Math.abs(packVoltage - nominalVoltage) / nominalVoltage <= VOLTAGE_TOLERANCE;
}

/**
 * Catalogue packs for a mobility result.
 *
 * Three barriers, all read from the product row: the right subcategory for the
 * vehicle type, a stated nominal voltage within ±3% of the pack the vehicle
 * needs, and a stated capacity. **A pack of another voltage is never
 * offered** — a 60 V pack in a 48 V scooter will damage the controller, and no
 * amount of extra range justifies suggesting it.
 *
 * Adequate packs (Ah ≥ required) come back smallest first, because a bigger
 * pack costs more and weighs more without helping a rider who does not need
 * the range. When none is adequate the single largest matching-voltage pack is
 * returned flagged `shortfall`, with its honest estimated range, so the
 * shopper sees how far short it falls rather than nothing at all. An empty list
 * means we stock no pack at that voltage.
 */
export function recommendPacks(
  result: MobilityResult,
  products: Product[],
  options: { limit?: number; chargerLimit?: number } = {},
): PackRecommendation[] {
  const limit = options.limit ?? 3;
  const chargerLimit = options.chargerLimit ?? 2;
  const subcategory = EV_SUBCATEGORY[result.input.vehicleType];

  const candidates = products.filter(
    (product) =>
      product.category === 'batteries' &&
      product.subcategory === subcategory &&
      voltageMatches(product.facets.voltage, result.nominalVoltage) &&
      (product.facets.batteryAh ?? 0) > 0,
  );

  const toRecommendation = (product: Product, shortfall: boolean): PackRecommendation => ({
    product,
    // The pack's own stated voltage, not the vehicle's: a 51 V pack and a
    // 51.2 V pack differ, and the range is the pack's.
    estimatedRangeKm: estimatedRangeKm(
      product.facets.batteryAh!,
      product.facets.voltage!,
      result.whPerKm,
    ),
    shortfall,
    chargers: linkedProducts(product, products, chargerLimit),
  });

  const byAh = (a: Product, b: Product) =>
    a.facets.batteryAh! - b.facets.batteryAh! || a.slug.localeCompare(b.slug);

  const adequate = candidates
    .filter((product) => product.facets.batteryAh! >= result.requiredAh)
    .sort(byAh);
  if (adequate.length > 0) {
    return adequate.slice(0, limit).map((product) => toRecommendation(product, false));
  }

  const largest = [...candidates].sort(byAh).pop();
  return largest ? [toRecommendation(largest, true)] : [];
}

/* -------------------------------------------------------- URL round-trip */

/**
 * `?v=2w&w=1000&sv=60&km=60&age=3` — short keys so a shared link stays
 * readable. Anything out of range decodes to `null` for that field, and the
 * calculator falls back to the type's default rather than computing from a
 * mangled value.
 */
export function encodeMobility(input: Partial<MobilityInput>): string {
  const params = new URLSearchParams();
  if (input.vehicleType) params.set('v', input.vehicleType);
  if (input.motorWatts !== undefined) params.set('w', String(input.motorWatts));
  if (input.systemVoltage !== undefined) params.set('sv', String(input.systemVoltage));
  if (input.dailyKm !== undefined) params.set('km', String(input.dailyKm));
  if (input.vehicleAgeYears !== undefined) params.set('age', String(input.vehicleAgeYears));
  return params.toString();
}

export const DEFAULTS: Readonly<Record<VehicleType, Omit<MobilityInput, 'vehicleType'>>> = {
  '2w': { motorWatts: 1000, systemVoltage: 60, dailyKm: 60, vehicleAgeYears: 0 },
  '3w': { motorWatts: 1200, systemVoltage: 51, dailyKm: 100, vehicleAgeYears: 0 },
};

function inRange(raw: string | null | undefined, min: number, max: number): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

export function decodeMobility(get: (key: string) => string | null | undefined): {
  vehicleType: VehicleType | null;
  input: MobilityInput | null;
} {
  const v = get('v');
  const vehicleType: VehicleType | null = v === '2w' || v === '3w' ? v : null;
  if (!vehicleType) return { vehicleType: null, input: null };
  const d = DEFAULTS[vehicleType];
  return {
    vehicleType,
    input: {
      vehicleType,
      motorWatts: Math.round(
        inRange(get('w'), LIMITS.motorWatts.min, LIMITS.motorWatts.max) ?? d.motorWatts,
      ),
      systemVoltage:
        inRange(get('sv'), LIMITS.systemVoltage.min, LIMITS.systemVoltage.max) ?? d.systemVoltage,
      dailyKm: Math.round(inRange(get('km'), LIMITS.dailyKm.min, LIMITS.dailyKm.max) ?? d.dailyKm),
      vehicleAgeYears: Math.round(
        inRange(get('age'), LIMITS.vehicleAgeYears.min, LIMITS.vehicleAgeYears.max) ??
          d.vehicleAgeYears,
      ),
    },
  };
}
