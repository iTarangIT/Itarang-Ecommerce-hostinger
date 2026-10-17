import type { Product } from '@/lib/commerce/types';

/**
 * Which products may be recommended alongside another.
 *
 * The business asked for no recommendations at all unless the products are
 * genuinely linked ("Website changes", Oct 2026). Today the only link is a
 * charger for an EV battery: a 2-wheeler or 3-wheeler pack needs a charger, and
 * the wrong charger damages it. So this answers one question — which of our
 * chargers can charge this pack — and returns nothing for anything else.
 *
 * **The rule is the charge voltage, and it errs towards leaving a charger
 * out.** A lithium pack is charged to a precise voltage; a charger whose output
 * is above it over-charges the cells, and one far below never fills them. A
 * charger is offered only when its maximum output voltage sits between 95% and
 * 100.5% of the pack's charge voltage. The 0.5% above covers rounding in the
 * listing sheets (an 84 V charger for an 83.95 V pack); it excludes, say, a
 * 60 V charger for a 58.4 V pack, which a looser rule would happily recommend.
 *
 * The pack's charge voltage is read from its specifications when stated, and
 * otherwise derived from its nominal voltage for LiFePO4 cells: 3.2 V nominal,
 * 3.65 V full, so ×3.65/3.2. A charger's output is read from its
 * specifications only — never guessed — and a charger that does not state one
 * is never recommended.
 */

const EV_BATTERY_SUBCATEGORIES = new Set(['ev-2-wheeler', 'ev-3-wheeler']);

/** LiFePO4 full-charge voltage over nominal voltage, per cell. */
const LFP_CHARGE_RATIO = 3.65 / 3.2;

const MIN_RATIO = 0.95;
const MAX_RATIO = 1.005;

/** The first number in a spec value: "58.4 V" → 58.4, "14.6 V ±0.2 V" → 14.6. */
function firstNumber(value: string): number | undefined {
  const match = value.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  const number = match ? Number(match[0]) : NaN;
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function specValue(product: Product, label: RegExp): number | undefined {
  for (const group of product.specGroups) {
    for (const row of group.specs) {
      if (label.test(row.label)) {
        const number = firstNumber(row.value);
        if (number !== undefined) return number;
      }
    }
  }
  return undefined;
}

export function isEvBattery(product: Product): boolean {
  return product.category === 'batteries' && EV_BATTERY_SUBCATEGORIES.has(product.subcategory);
}

export function isCharger(product: Product): boolean {
  return product.category === 'chargers';
}

/** The voltage a pack is charged to, or `undefined` when it cannot be known. */
export function packChargeVoltage(product: Product): number | undefined {
  const stated = specValue(product, /^(max\.?|maximum)\s*charg(e|ing)\s*voltage|^charg(e|ing)\s*voltage/i);
  if (stated !== undefined) return stated;
  const nominal = product.facets.voltage;
  return nominal ? nominal * LFP_CHARGE_RATIO : undefined;
}

/** A charger's maximum output voltage, from its specifications only. */
export function chargerOutputVoltage(product: Product): number | undefined {
  return specValue(product, /^(max\.?|maximum)\s*output\s*voltage/i);
}

/** Can this charger charge this pack? */
export function chargerFitsPack(charger: Product, pack: Product): boolean {
  const output = chargerOutputVoltage(charger);
  const target = packChargeVoltage(pack);
  if (output === undefined || target === undefined) return false;
  const ratio = output / target;
  return ratio >= MIN_RATIO && ratio <= MAX_RATIO;
}

/**
 * The products linked to `source`, best match first.
 *
 * Chargers are ordered by how close their output is to the pack's charge
 * voltage, then by current (a faster charger first is the more useful
 * suggestion for a working vehicle). Everything else returns an empty list.
 */
export function linkedProducts(source: Product, catalogue: Product[], limit = 4): Product[] {
  if (!isEvBattery(source)) return [];
  const target = packChargeVoltage(source);
  if (target === undefined) return [];

  const current = (product: Product) =>
    specValue(product, /^(max\.?|maximum)\s*output\s*current/i) ?? 0;

  return catalogue
    .filter((candidate) => isCharger(candidate) && chargerFitsPack(candidate, source))
    .sort((a, b) => {
      const gap =
        Math.abs(chargerOutputVoltage(a)! - target) - Math.abs(chargerOutputVoltage(b)! - target);
      return gap !== 0 ? gap : current(b) - current(a);
    })
    .slice(0, limit);
}

/** Linked products for several sources at once (a cart), without duplicates. */
export function linkedProductsForAll(
  sources: Product[],
  catalogue: Product[],
  limit = 4,
): Product[] {
  const seen = new Set(sources.map((source) => source.id));
  const out: Product[] = [];
  for (const source of sources) {
    for (const linked of linkedProducts(source, catalogue, limit)) {
      if (seen.has(linked.id)) continue;
      seen.add(linked.id);
      out.push(linked);
      if (out.length >= limit) return out;
    }
  }
  return out;
}
