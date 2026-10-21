import { describe, expect, it } from 'vitest';
import type { Product } from '@/lib/commerce/types';
import {
  ageFactorFor,
  baseConsumption,
  calculateMobility,
  decodeMobility,
  encodeMobility,
  nominalVoltageFor,
  recommendPacks,
  voltageMatches,
} from './mobility';

/** Only the fields the rules read, as in `linked-products.test.ts`. */
function product(
  id: string,
  category: Product['category'],
  subcategory: string,
  facets: { voltage?: number; batteryAh?: number },
  specs: Record<string, string> = {},
): Product {
  return {
    id,
    slug: id,
    category,
    subcategory,
    facets,
    specGroups: [
      { title: 'Electrical', specs: Object.entries(specs).map(([label, value]) => ({ label, value })) },
    ],
  } as unknown as Product;
}

describe('consumption', () => {
  it('uses the reference figure at the reference motor rating', () => {
    expect(baseConsumption('2w', 1000)).toBe(30);
    expect(baseConsumption('3w', 1200)).toBe(70);
  });

  it('scales with the square root of motor power', () => {
    // 30 × √(1500 / 1000) = 36.74
    expect(baseConsumption('2w', 1500)).toBeCloseTo(36.74, 2);
    // 70 × √(850 / 1200) = 58.91
    expect(baseConsumption('3w', 850)).toBeCloseTo(58.91, 2);
  });

  it('clamps to the band for the vehicle type', () => {
    expect(baseConsumption('2w', 250)).toBe(20);
    expect(baseConsumption('2w', 5000)).toBe(40);
    expect(baseConsumption('3w', 250)).toBe(55);
    expect(baseConsumption('3w', 5000)).toBe(90);
  });
});

describe('ageing', () => {
  it('adds 2% a year', () => {
    expect(ageFactorFor(0)).toBe(1);
    expect(ageFactorFor(5)).toBeCloseTo(1.1, 10);
  });

  it('caps at +20%', () => {
    expect(ageFactorFor(10)).toBeCloseTo(1.2, 10);
    expect(ageFactorFor(15)).toBeCloseTo(1.2, 10);
  });

  it('raises the requirement for an old vehicle', () => {
    const fresh = calculateMobility({ vehicleType: '2w', motorWatts: 1000, systemVoltage: 60, dailyKm: 60, vehicleAgeYears: 0 });
    const old = calculateMobility({ vehicleType: '2w', motorWatts: 1000, systemVoltage: 60, dailyKm: 60, vehicleAgeYears: 15 });
    expect(old.whPerKm).toBe(36);
    expect(old.energyWh).toBe(Math.round(fresh.energyWh * 1.2));
  });
});

describe('voltage mapping', () => {
  it('maps system voltages to LiFePO4 nominal pack voltages', () => {
    expect(nominalVoltageFor(48)).toBe(51.2);
    expect(nominalVoltageFor(51)).toBe(51.2);
    expect(nominalVoltageFor(60)).toBe(60.8);
    expect(nominalVoltageFor(64)).toBe(64);
    expect(nominalVoltageFor(72)).toBe(73.6);
  });

  it('takes any other voltage at face value', () => {
    expect(nominalVoltageFor(36)).toBe(36);
    expect(nominalVoltageFor(60.8)).toBe(60.8);
  });

  it('matches within ±3% only', () => {
    expect(voltageMatches(51, 51.2)).toBe(true);
    expect(voltageMatches(61, 60.8)).toBe(true);
    expect(voltageMatches(60.8, 51.2)).toBe(false);
    expect(voltageMatches(undefined, 51.2)).toBe(false);
  });
});

describe('formula', () => {
  it('2-wheeler, 1000 W, 60 V, 60 km, new', () => {
    const r = calculateMobility({ vehicleType: '2w', motorWatts: 1000, systemVoltage: 60, dailyKm: 60, vehicleAgeYears: 0 });
    // 60 km × 30 Wh/km ÷ 0.9 × 1.1 = 2200 Wh; ÷ 60.8 V = 36.2 Ah
    expect(r.whPerKm).toBe(30);
    expect(r.energyWh).toBe(2200);
    expect(r.nominalVoltage).toBe(60.8);
    expect(r.energyAh).toBe(36.2);
    expect(r.continuousCurrentA).toBe(16.4);
    expect(r.requiredAh).toBe(37);
    expect(r.governedBy).toBe('energy');
    // 37 Ah × 60.8 V × 0.9 ÷ 30 Wh/km = 67.5 km
    expect(r.estimatedRangeForAh(37)).toBe(67);
  });

  it('e-rickshaw, 1200 W, 51 V, 100 km, new', () => {
    const r = calculateMobility({ vehicleType: '3w', motorWatts: 1200, systemVoltage: 51, dailyKm: 100, vehicleAgeYears: 0 });
    // 100 × 70 ÷ 0.9 × 1.1 = 8556 Wh; ÷ 51.2 V = 167.1 Ah
    expect(r.energyWh).toBe(8556);
    expect(r.requiredAh).toBe(168);
    expect(r.notes.some((note) => note.includes('51.2 V'))).toBe(true);
  });
});

describe('C-rate floor', () => {
  it('sizes a short-range, high-power 2-wheeler to 1C', () => {
    const r = calculateMobility({ vehicleType: '2w', motorWatts: 2000, systemVoltage: 48, dailyKm: 1, vehicleAgeYears: 0 });
    // 2000 W ÷ 51.2 V = 39.1 A → 39.1 Ah at 1C
    expect(r.governedBy).toBe('current');
    expect(r.currentAh).toBe(39.1);
    expect(r.requiredAh).toBe(40);
  });

  it('sizes a 3-wheeler to 0.5C', () => {
    const r = calculateMobility({ vehicleType: '3w', motorWatts: 1500, systemVoltage: 48, dailyKm: 5, vehicleAgeYears: 0 });
    // 1500 ÷ 51.2 = 29.3 A → 58.6 Ah at 0.5C
    expect(r.governedBy).toBe('current');
    expect(r.requiredAh).toBe(59);
  });
});

describe('recommendPacks', () => {
  const p2w51x30 = product('2w-51-30', 'batteries', 'ev-2-wheeler', { voltage: 51, batteryAh: 30 });
  const p2w51x45 = product('2w-51-45', 'batteries', 'ev-2-wheeler', { voltage: 51, batteryAh: 45 }, { 'Max. charge voltage': '57.6 V' });
  const p2w608x30 = product('2w-60-30', 'batteries', 'ev-2-wheeler', { voltage: 60.8, batteryAh: 30 });
  const p2w736x32 = product('2w-73-32', 'batteries', 'ev-2-wheeler', { voltage: 73.6, batteryAh: 32 });
  const p3w512x105 = product('3w-51-105', 'batteries', 'ev-3-wheeler', { voltage: 51.2, batteryAh: 105 });
  const p3w512x140 = product('3w-51-140', 'batteries', 'ev-3-wheeler', { voltage: 51.2, batteryAh: 140 });
  const p3w61x200 = product('3w-61-200', 'batteries', 'ev-3-wheeler', { voltage: 61, batteryAh: 200 });
  const home = product('home-51-200', 'batteries', 'ess', { voltage: 51.2, batteryAh: 200 });
  const noAh = product('2w-51-x', 'batteries', 'ev-2-wheeler', { voltage: 51 });
  const charger584 = product('ch-58.4', 'chargers', 'ev-chargers', {}, { 'Max. output voltage': '58.4 V' });
  const charger576 = product('ch-57.6', 'chargers', 'ev-chargers', {}, { 'Max. output voltage': '57.6 V' });

  const catalogue = [
    p2w51x30, p2w51x45, p2w608x30, p2w736x32,
    p3w512x105, p3w512x140, p3w61x200, home, noAh, charger584, charger576,
  ];

  it('returns adequate packs of the right type and voltage, smallest first', () => {
    const r = calculateMobility({ vehicleType: '2w', motorWatts: 1000, systemVoltage: 48, dailyKm: 30, vehicleAgeYears: 0 });
    // 30 × 30 ÷ 0.9 × 1.1 = 1100 Wh ÷ 51.2 = 21.5 → 22 Ah
    expect(r.requiredAh).toBe(22);
    const recs = recommendPacks(r, catalogue);
    expect(recs.map((rec) => rec.product.id)).toEqual(['2w-51-30', '2w-51-45']);
    expect(recs.every((rec) => !rec.shortfall)).toBe(true);
    // 30 Ah × 51 V × 0.9 ÷ 30 Wh/km = 45.9 km
    expect(recs[0]!.estimatedRangeKm).toBe(46);
  });

  it('attaches chargers that fit the pack', () => {
    const r = calculateMobility({ vehicleType: '2w', motorWatts: 1000, systemVoltage: 48, dailyKm: 30, vehicleAgeYears: 0 });
    const recs = recommendPacks(r, catalogue);
    // 51 V pack with no stated charge voltage → 58.1 V derived; both chargers fit.
    expect(recs[0]!.chargers.map((c) => c.id)).toEqual(['ch-58.4', 'ch-57.6']);
    // Stated 57.6 V charge voltage → the 58.4 V charger would over-charge it.
    expect(recs[1]!.chargers.map((c) => c.id)).toEqual(['ch-57.6']);
  });

  it('flags the largest matching-voltage pack as a shortfall when none is adequate', () => {
    const r = calculateMobility({ vehicleType: '3w', motorWatts: 1200, systemVoltage: 48, dailyKm: 150, vehicleAgeYears: 5 });
    expect(r.requiredAh).toBeGreaterThan(140);
    const recs = recommendPacks(r, catalogue);
    expect(recs).toHaveLength(1);
    expect(recs[0]!.product.id).toBe('3w-51-140');
    expect(recs[0]!.shortfall).toBe(true);
    expect(recs[0]!.estimatedRangeKm).toBeLessThan(150);
  });

  it('never recommends a pack of another voltage', () => {
    // Needs far more than any 51 V pack; a 61 V 200 Ah pack exists but must not appear.
    const r = calculateMobility({ vehicleType: '3w', motorWatts: 1200, systemVoltage: 51, dailyKm: 300, vehicleAgeYears: 0 });
    const recs = recommendPacks(r, catalogue);
    for (const rec of recs) expect(rec.product.facets.voltage).toBe(51.2);

    const at60 = calculateMobility({ vehicleType: '2w', motorWatts: 1000, systemVoltage: 60, dailyKm: 300, vehicleAgeYears: 0 });
    expect(recommendPacks(at60, catalogue).map((rec) => rec.product.id)).toEqual(['2w-60-30']);
  });

  it('returns nothing when no pack of that voltage exists', () => {
    const r = calculateMobility({ vehicleType: '3w', motorWatts: 1000, systemVoltage: 72, dailyKm: 50, vehicleAgeYears: 0 });
    expect(recommendPacks(r, catalogue)).toEqual([]);
  });

  it('ignores other subcategories and packs without a stated capacity', () => {
    const r = calculateMobility({ vehicleType: '3w', motorWatts: 1200, systemVoltage: 48, dailyKm: 40, vehicleAgeYears: 0 });
    const ids = recommendPacks(r, catalogue).map((rec) => rec.product.id);
    expect(ids).not.toContain('home-51-200');
    expect(ids).not.toContain('2w-51-x');
    expect(ids).toEqual(['3w-51-105', '3w-51-140']);
  });
});

describe('URL round-trip', () => {
  it('encodes and decodes', () => {
    const input = { vehicleType: '3w' as const, motorWatts: 1000, systemVoltage: 60, dailyKm: 120, vehicleAgeYears: 4 };
    const params = new URLSearchParams(encodeMobility(input));
    expect(decodeMobility((key) => params.get(key))).toEqual({ vehicleType: '3w', input });
  });

  it('falls back to defaults for out-of-range values', () => {
    const params = new URLSearchParams('v=2w&w=99999&km=-5&age=40');
    const decoded = decodeMobility((key) => params.get(key));
    expect(decoded.input).toEqual({ vehicleType: '2w', motorWatts: 1000, systemVoltage: 60, dailyKm: 60, vehicleAgeYears: 0 });
  });

  it('returns no input without a vehicle type', () => {
    expect(decodeMobility(() => null)).toEqual({ vehicleType: null, input: null });
  });
});
