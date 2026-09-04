import { minSellingPrice, productAvailability } from '@/lib/catalog/pricing';
import type { Product, SpecGroup } from '@/lib/commerce/types';

/**
 * Turns a sizing requirement into a real catalogue recommendation.
 *
 * The customer's question is "I entered my load — which iTarang battery should
 * I use?", and the only honest answers are a product that provably satisfies
 * every documented requirement, or none. So this module is written as a set of
 * barriers rather than as a search for the nearest capacity: a product is
 * recommended when it clears all of them, and the absence of a documented
 * value is a failure to clear, never a licence to assume.
 *
 * Every fact it reads comes from the product row the storefront itself renders
 * — subcategory, product type, the "Recommended uses" and "Max. discharge
 * current" specification rows, `facets.voltage`, `facets.batteryAh` and the
 * variant availability rollup. There are no product definitions in this file,
 * so a catalogue edit changes the recommendation and cannot be contradicted by
 * a second copy of the data living here. `docs/p1-b-2-catalogue-audit.md`
 * records the provenance of each value and the conflicts left unresolved.
 *
 * What it deliberately does **not** do: pick the closest match. A load this
 * catalogue cannot serve returns `no-catalogue-match`, which is a successful
 * result, and the caller sends the shopper to a human.
 */

export type HomeSystemVoltage = 12 | 24 | 48;

/**
 * Battery subcategories that are home or inverter batteries.
 *
 * An allow-list, not a deny-list: a subcategory added later is excluded until
 * somebody says otherwise, which is the safe direction. The catalogue also
 * holds `ev-2-wheeler` and `ev-3-wheeler` — 51 V to 73.6 V traction packs
 * whose own `productType` reads "Electric vehicle traction battery pack". They
 * are not home-backup batteries. Before this list existed the filter matched on
 * `category === 'batteries'` and Ah alone, and a request for a 12 V 45 Ah home
 * battery was answered with a 51 V e-scooter pack.
 */
export const HOME_BACKUP_SUBCATEGORIES: ReadonlySet<string> = new Set([
  'lithium',
  'tall-tubular',
  'short-tubular',
  'flat-plate-smf',
]);

/**
 * Nominal pack voltage → the system voltage the product is sold to run on.
 *
 * Not an assumption of ours: each product states it. TK12100 (12.8 V nominal)
 * carries "Number of batteries: 1 × 12V battery required" and "Lithium-ready
 * inverters with 12V battery input"; TK25100 (25.6 V) says 24 V. This table is
 * the machine-readable form of those statements, for the nominal voltages the
 * catalogue actually contains plus the two lead-acid values a tubular battery
 * would state.
 *
 * **It fails closed.** A product whose nominal voltage is absent from this
 * table, or that states no voltage at all, is not recommended. That can only
 * withhold a recommendation, never produce a wrong one — the right failure
 * direction when the alternative is guessing whether a pack fits somebody's
 * inverter. Every LiEV voltage (51, 60.8, 61, 73.6) is absent by construction.
 */
export const SYSTEM_VOLTAGE_BY_NOMINAL: ReadonlyMap<number, HomeSystemVoltage> = new Map([
  [12, 12],
  [12.8, 12],
  [24, 24],
  [25.6, 24],
  [48, 48],
  [51.2, 48],
]);

/**
 * Wording that marks a documented application as vehicular.
 *
 * Checked against `productType` and against the "Recommended uses" row. A
 * second, independent barrier behind the subcategory allow-list: a traction
 * pack mis-filed under `lithium` would still be refused here.
 */
const VEHICLE_APPLICATION =
  /traction|drivetrain|vehicle|rickshaw|loader|wheeler|scooter|motorcycle/i;

/** Wording that marks a documented application as home backup or home storage. */
const HOME_APPLICATION = /home backup|residential energy storage|inverter batter/i;

/** Specification labels that state a continuous discharge limit. */
const DISCHARGE_LIMIT_LABELS = [
  'max. discharge current',
  'max discharge current',
  'maximum discharge current',
  'continuous discharge current',
];

const APPLICATION_LABELS = ['recommended uses', 'recommended use'];

export type RejectionCode =
  | 'not-a-battery'
  | 'not-a-home-backup-subcategory'
  | 'declared-vehicle-application'
  | 'application-not-documented'
  | 'voltage-not-documented'
  | 'voltage-mismatch'
  | 'capacity-not-documented'
  | 'capacity-below-requirement'
  | 'discharge-limit-not-documented'
  | 'discharge-limit-below-requirement'
  | 'not-available';

/**
 * The requirement, as the calculator produced it.
 *
 * `systemVoltage` is nullable because a caller may not have one to give, and
 * that case has to be distinguishable from "we stock nothing for it": without a
 * system voltage no product's compatibility can be established, so no product
 * is recommended. Capacity alone cannot tell a 12 V home battery from a 51 V
 * traction pack, which is precisely how the original bug happened.
 */
export interface SizingRequirement {
  runningWatts: number;
  requiredAh: number;
  requiredDcWatts: number;
  systemVoltage: HomeSystemVoltage | null;
  backupHours: number;
}

/** The electrical facts a candidate states, or nulls where it states none. */
export interface BatterySpec {
  nominalVoltage: number | null;
  systemVoltage: HomeSystemVoltage | null;
  ah: number | null;
  /**
   * Nominal voltage × Ah.
   *
   * Not a derivation we invented: it reproduces both Powercube documents'
   * `Energy` rows exactly (12.8 × 105 = 1344 Wh, 25.6 × 105 = 2688 Wh).
   */
  energyWh: number | null;
  maxContinuousDischargeA: number | null;
  /** Continuous discharge current × nominal voltage. */
  maxContinuousDischargeW: number | null;
  /** The "Recommended uses" row, verbatim, so the UI can quote it. */
  documentedApplication: string | null;
  available: boolean;
}

export interface Assessment {
  product: Product;
  spec: BatterySpec;
  /** Empty exactly when the product clears every barrier. */
  rejections: RejectionCode[];
  /** Documented statements supporting the match, in display order. */
  reasons: string[];
}

/**
 * Which of the five situations the caller is in.
 *
 * The distinction is the point. Telling a shopper their load is beyond our
 * range when the truth is that we have not priced the product, or that they
 * have not told us their system voltage, is a false statement about their home.
 *
 * - `matched` — a product satisfies every documented requirement.
 * - `incomplete-request` — the requirement itself is missing something
 *   compatibility depends on. Nothing is claimed about the catalogue.
 * - `information-missing` — a product is the right application but does not
 *   document a value the check needs. Fails closed.
 * - `not-available` — a product satisfies the requirement but is not sellable.
 * - `no-catalogue-match` — the catalogue genuinely cannot serve this load.
 */
export type SizingStatus =
  | 'matched'
  | 'incomplete-request'
  | 'information-missing'
  | 'not-available'
  | 'no-catalogue-match';

export interface BatteryRecommendation {
  status: SizingStatus;
  best: Assessment | null;
  alternatives: Array<{ assessment: Assessment; whyNotSelected: string }>;
  /** Every candidate considered, verdict included. Diagnostics and tests. */
  considered: Assessment[];
}

/* ------------------------------------------------------------ spec reading */

function normaliseLabel(label: string): string {
  return label.trim().toLowerCase();
}

function specValue(groups: SpecGroup[], labels: string[]): string | null {
  const wanted = new Set(labels);
  for (const group of groups) {
    for (const spec of group.specs) {
      if (wanted.has(normaliseLabel(spec.label))) return spec.value;
    }
  }
  return null;
}

/**
 * The ampere figure out of a discharge-current row.
 *
 * The catalogue states these as prose: "1C (≈105 A)", "45 A (max. 1.5C)",
 * "30 A". The number that matters is the one carrying the unit, so the C-rate
 * is skipped by requiring an `A` after the digits, and `Ah` is excluded by the
 * lookahead — an Ah figure in this position would otherwise be read as a
 * current and inflate the limit by an order of magnitude.
 *
 * Returns null on anything it cannot read, which fails the candidate closed.
 */
export function parseDischargeAmps(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/(\d+(?:\.\d+)?)\s*A(?![A-Za-z])/);
  if (!match) return null;
  const amps = Number(match[1]);
  return Number.isFinite(amps) && amps > 0 ? amps : null;
}

export function readBatterySpec(product: Product): BatterySpec {
  const nominalVoltage = product.facets.voltage ?? null;
  const ah = product.facets.batteryAh ?? null;
  const maxContinuousDischargeA = parseDischargeAmps(
    specValue(product.specGroups, DISCHARGE_LIMIT_LABELS),
  );

  return {
    nominalVoltage,
    systemVoltage:
      nominalVoltage === null ? null : (SYSTEM_VOLTAGE_BY_NOMINAL.get(nominalVoltage) ?? null),
    ah,
    energyWh: nominalVoltage !== null && ah !== null ? nominalVoltage * ah : null,
    maxContinuousDischargeA,
    maxContinuousDischargeW:
      maxContinuousDischargeA !== null && nominalVoltage !== null
        ? maxContinuousDischargeA * nominalVoltage
        : null,
    documentedApplication: specValue(product.specGroups, APPLICATION_LABELS),
    available: productAvailability(product) !== 'out-of-stock',
  };
}

/* --------------------------------------------------------------- barriers */

/**
 * Watt-hours as the catalogue writes them: kWh above a kilowatt-hour, Wh below.
 *
 * Exported because the route formats the same figure for the wire, and two
 * copies of a rounding rule is how "1.34 kWh" and "1.3 kWh" end up on the same
 * screen.
 */
export function formatWh(wh: number): string {
  return wh >= 1000 ? `${(wh / 1000).toFixed(2)} kWh` : `${Math.round(wh)} Wh`;
}

/**
 * One candidate against one requirement.
 *
 * Ordered so the most specific failure is listed first, because the caller
 * shows the first rejection to a human. Application before voltage before
 * capacity before power before availability: an EV pack should be reported as
 * the wrong application, not as the wrong voltage.
 */
export function assess(product: Product, requirement: SizingRequirement): Assessment {
  const spec = readBatterySpec(product);
  const rejections: RejectionCode[] = [];
  const reasons: string[] = [];

  /* 1 — application. Three independent barriers over the same question. */
  if (product.category !== 'batteries') {
    rejections.push('not-a-battery');
  } else if (!HOME_BACKUP_SUBCATEGORIES.has(product.subcategory)) {
    rejections.push('not-a-home-backup-subcategory');
  }

  if (product.productType && VEHICLE_APPLICATION.test(product.productType)) {
    rejections.push('declared-vehicle-application');
  }

  if (spec.documentedApplication === null) {
    rejections.push('application-not-documented');
  } else if (VEHICLE_APPLICATION.test(spec.documentedApplication)) {
    rejections.push('declared-vehicle-application');
  } else if (!HOME_APPLICATION.test(spec.documentedApplication)) {
    rejections.push('application-not-documented');
  } else {
    reasons.push(`Documented for ${spec.documentedApplication.split(';')[0]!.trim().toLowerCase()}`);
  }

  /* 2 — system voltage. */
  if (spec.systemVoltage === null) {
    rejections.push('voltage-not-documented');
  } else if (requirement.systemVoltage === null || spec.systemVoltage !== requirement.systemVoltage) {
    rejections.push('voltage-mismatch');
  } else {
    reasons.push(
      `${spec.nominalVoltage} V nominal — the ${spec.systemVoltage}V battery input your load needs`,
    );
  }

  /* 3 — capacity. */
  if (spec.ah === null) {
    rejections.push('capacity-not-documented');
  } else if (spec.ah < requirement.requiredAh) {
    rejections.push('capacity-below-requirement');
  } else {
    reasons.push(
      spec.energyWh !== null
        ? `${spec.ah} Ah (${formatWh(spec.energyWh)}) rated capacity against the ${requirement.requiredAh} Ah your ${requirement.backupHours}-hour window needs`
        : `${spec.ah} Ah rated capacity against the ${requirement.requiredAh} Ah your ${requirement.backupHours}-hour window needs`,
    );
  }

  /* 4 — documented continuous discharge limit. */
  if (spec.maxContinuousDischargeW === null) {
    rejections.push('discharge-limit-not-documented');
  } else if (spec.maxContinuousDischargeW < requirement.requiredDcWatts) {
    rejections.push('discharge-limit-below-requirement');
  } else {
    reasons.push(
      `Rated to deliver ${Math.round(spec.maxContinuousDischargeW)} W continuously, above the ${requirement.requiredDcWatts} W your ${requirement.runningWatts} W of appliances draw`,
    );
  }

  /* 5 — sellable. Last, so an out-of-stock match is still reported as a match
     that happens to be unavailable rather than as no match at all. */
  if (!spec.available) {
    rejections.push('not-available');
  } else {
    reasons.push('In stock and shipping now');
  }

  // `reasons` lists only the barriers this product actually cleared, so it is
  // returned whatever the verdict — `rejections` sits beside it and is the
  // authoritative signal. A caller rendering the reasons for a product with a
  // non-empty `rejections` would be endorsing it; none does.
  return { product, spec, rejections, reasons };
}

/* ----------------------------------------------------------------- ranking */

/**
 * Smallest sufficient first.
 *
 * Over-specifying costs the shopper money and is not a better answer, so rank
 * by documented usable energy ascending, then by price, then by slug. The last
 * tiebreak is what makes the order deterministic rather than dependent on the
 * order rows came back from the database.
 */
function rank(a: Assessment, b: Assessment): number {
  const energyA = a.spec.energyWh ?? Number.POSITIVE_INFINITY;
  const energyB = b.spec.energyWh ?? Number.POSITIVE_INFINITY;
  if (energyA !== energyB) return energyA - energyB;
  const priceA = minSellingPrice(a.product);
  const priceB = minSellingPrice(b.product);
  if (priceA !== priceB) return priceA - priceB;
  return a.product.slug.localeCompare(b.product.slug);
}

function whyNotSelected(alternative: Assessment, best: Assessment): string {
  const theirs = alternative.spec.energyWh;
  const ours = best.spec.energyWh;
  if (theirs !== null && ours !== null && theirs > ours) {
    return `More capacity than your load needs — ${formatWh(theirs)} against ${formatWh(ours)}`;
  }
  if (minSellingPrice(alternative.product) > minSellingPrice(best.product)) {
    return 'Same documented capacity at a higher price';
  }
  return 'Also compatible, listed after the closest fit';
}

/** Failures that mean "the right kind of product, but a value is missing". */
const MISSING_INFORMATION: ReadonlySet<RejectionCode> = new Set<RejectionCode>([
  'application-not-documented',
  'voltage-not-documented',
  'capacity-not-documented',
  'discharge-limit-not-documented',
]);

/**
 * The recommendation.
 *
 * `catalogue` must be the **published** catalogue — `allProducts()` under
 * `COMMERCE_PROVIDER=db` reads `listPublished()`, so a draft product never
 * reaches here. That barrier lives in the repository rather than in this
 * function because `Product`, the shopper-facing projection, carries no status
 * at all: `to-domain.ts` strips it, which is what makes a draft unrecommendable
 * by construction rather than by a filter somebody could forget.
 */
export function recommendBattery(
  catalogue: Product[],
  requirement: SizingRequirement,
): BatteryRecommendation {
  const considered = catalogue
    .filter((product) => product.category === 'batteries')
    .map((product) => assess(product, requirement));

  const matches = considered.filter((entry) => entry.rejections.length === 0).sort(rank);

  if (matches.length > 0) {
    const [best, ...rest] = matches;
    return {
      status: 'matched',
      best: best!,
      alternatives: rest.map((assessment) => ({
        assessment,
        whyNotSelected: whyNotSelected(assessment, best!),
      })),
      considered,
    };
  }

  /**
   * No match. Which of the four remaining answers is true?
   *
   * Checked in order of how specific the statement is. "You have not told us
   * your system voltage" outranks "we stock nothing", which outranks "your load
   * is beyond our range" — and the last of those is only ever said when the
   * capacity or power comparison actually proves it.
   */
  if (requirement.systemVoltage === null) {
    return { status: 'incomplete-request', best: null, alternatives: [], considered };
  }

  const homeCandidates = considered.filter(
    (entry) =>
      !entry.rejections.includes('not-a-battery') &&
      !entry.rejections.includes('not-a-home-backup-subcategory') &&
      !entry.rejections.includes('declared-vehicle-application'),
  );

  const availabilityOnly = homeCandidates.find(
    (entry) => entry.rejections.length === 1 && entry.rejections[0] === 'not-available',
  );
  if (availabilityOnly) {
    return { status: 'not-available', best: availabilityOnly, alternatives: [], considered };
  }

  const informationGap = homeCandidates.find((entry) =>
    entry.rejections.some((code) => MISSING_INFORMATION.has(code)),
  );
  if (informationGap) {
    return { status: 'information-missing', best: null, alternatives: [], considered };
  }

  return { status: 'no-catalogue-match', best: null, alternatives: [], considered };
}
