import { describe, expect, it } from 'vitest';
import type { Product } from '@/lib/commerce/types';
import { chargerFitsPack, linkedProducts, packChargeVoltage } from './linked-products';

/**
 * Only the fields the rule reads. The voltages are the ones printed on the
 * Trontek listing sheets: TK-LiFe-5145 (51 V, charge 57.6 V), the 51.2 V
 * e-rickshaw packs (no charge voltage stated), TK-LiFe-7332 (73.6 V, 83.95 V),
 * and the TK 51-10 / TK 61-30 / TK 73-10 chargers.
 */
function product(
  id: string,
  category: Product['category'],
  subcategory: string,
  specs: Record<string, string>,
  voltage?: number,
): Product {
  return {
    id,
    category,
    subcategory,
    facets: voltage === undefined ? {} : { voltage },
    specGroups: [
      { title: 'Electrical', specs: Object.entries(specs).map(([label, value]) => ({ label, value })) },
    ],
  } as unknown as Product;
}

const pack5145 = product('5145', 'batteries', 'ev-2-wheeler', { 'Max. charge voltage': '57.6 V' }, 51);
const erickshaw51 = product('51140', 'batteries', 'ev-3-wheeler', {}, 51.2);
const pack7332 = product('7332', 'batteries', 'ev-2-wheeler', { 'Max. charge voltage': '83.95 V' }, 73.6);
const homeBattery = product('12100', 'batteries', 'home-inverter', { 'Charging voltage': '14.6 V ±0.2 V' }, 12.8);

const charger58 = product('tk51-10', 'chargers', 'ev-chargers', {
  'Max. output voltage': '58.4 V',
  'Max. output current': '10 A',
});
const charger58fast = product('tk51-26', 'chargers', 'ev-chargers', {
  'Max. output voltage': '58.4 V',
  'Max. output current': '25 A',
});
const charger60 = product('tk61-30', 'chargers', 'ev-chargers', { 'Max. output voltage': '60 V' });
const charger84 = product('tk73-10', 'chargers', 'ev-chargers', { 'Max. output voltage': '84 V' });
const unstated = product('mystery', 'chargers', 'ev-chargers', {});

const catalogue = [pack5145, erickshaw51, pack7332, homeBattery, charger58, charger58fast, charger60, charger84, unstated];

describe('linked products', () => {
  it('reads a stated charge voltage and derives one from LiFePO4 nominal voltage', () => {
    expect(packChargeVoltage(pack5145)).toBe(57.6);
    expect(packChargeVoltage(erickshaw51)).toBeCloseTo(58.4, 5);
  });

  it('offers a 58.4 V charger for a 51 V pack, fastest first', () => {
    expect(linkedProducts(erickshaw51, catalogue).map((p) => p.id)).toEqual(['tk51-26', 'tk51-10']);
  });

  it('never offers a charger whose output is above the pack charge voltage', () => {
    // 60 V into a 58.4 V pack over-charges it.
    expect(chargerFitsPack(charger60, erickshaw51)).toBe(false);
    // 58.4 V into a 57.6 V pack is 1.4% over, outside the rounding margin.
    expect(chargerFitsPack(charger58, pack5145)).toBe(false);
  });

  it('allows listing-sheet rounding: an 84 V charger for an 83.95 V pack', () => {
    expect(linkedProducts(pack7332, catalogue).map((p) => p.id)).toEqual(['tk73-10']);
  });

  it('recommends nothing for products with no genuine link', () => {
    expect(linkedProducts(homeBattery, catalogue)).toEqual([]);
    expect(linkedProducts(charger58, catalogue)).toEqual([]);
  });

  it('never recommends a charger that does not state its output', () => {
    expect(chargerFitsPack(unstated, erickshaw51)).toBe(false);
  });
});
