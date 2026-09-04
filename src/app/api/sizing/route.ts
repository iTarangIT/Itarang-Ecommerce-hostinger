import { NextResponse } from 'next/server';
import { allProducts } from '@/lib/catalog/collections';
import { toProductSummary, type ProductSummary } from '@/lib/commerce/summary';
import { minSellingPrice, productAvailability } from '@/lib/catalog/pricing';
import { dcWattsFor } from '@/lib/sizing/calculator';
import type { Product } from '@/lib/commerce/types';
import {
  HOME_BACKUP_SUBCATEGORIES,
  formatWh,
  recommendBattery,
  type Assessment,
  type HomeSystemVoltage,
  type SizingRequirement,
  type SizingStatus,
} from '@/lib/sizing/recommend';

/**
 * Turns a sizing result into a shoppable recommendation.
 *
 * This handler owns no electrical logic at all. It parses the query, reads the
 * **published** catalogue through the active provider, and hands both to
 * `lib/sizing/recommend.ts`, which decides compatibility from what each product
 * documents. The arithmetic that produced `va`, `ah`, `w` and `v` lives in
 * `lib/sizing/calculator.ts`. Neither file holds a product definition, so a
 * catalogue edit is the only thing that can change an answer.
 *
 * See `docs/p1-b-2-catalogue-audit.md` for the audit of the eight real products
 * and of every constant the calculator applies.
 */
export interface RecommendedProduct {
  product: ProductSummary;
  /** Documented statements that support the match, in display order. */
  reasons: string[];
  /** "105 Ah at 12.8 V nominal · 1.34 kWh", from the product's own values. */
  capacityLabel: string;
}

export interface SizingRecommendation {
  /**
   * Which situation the shopper is in. The UI branches on this and nothing
   * else, so "we do not stock a match" can never be printed for a request that
   * merely arrived without a system voltage.
   */
  status: SizingStatus;
  /** Set only when `status` is `matched`. */
  battery: RecommendedProduct | null;
  /**
   * Set only when `status` is `not-available`: the product that satisfies every
   * electrical requirement but is not sellable right now.
   *
   * A separate field from `battery` on purpose. Sharing one would let a UI that
   * forgot to check `status` offer an out-of-stock product with a buy button.
   */
  unavailableMatch: RecommendedProduct | null;
  alternatives: Array<RecommendedProduct & { whyNotSelected: string }>;
  /**
   * Families the catalogue cannot answer at all right now, so the UI can say
   * which part is missing instead of implying the shopper's load is unusual.
   */
  unavailableFamilies: Array<'inverter' | 'battery' | 'combo'>;
  /** An inverter for the calculated VA, when the catalogue holds one. */
  inverter: ProductSummary | null;
  /** A combo covering both the VA and the Ah, when the catalogue holds one. */
  combo: ProductSummary | null;
}

/** A finite, non-negative number out of a query string, or zero. */
function positiveNumber(raw: string | null): number {
  const value = Number(raw ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function homeSystemVoltage(raw: string | null): HomeSystemVoltage | null {
  const value = Number(raw ?? 0);
  return value === 12 || value === 24 || value === 48 ? value : null;
}

function capacityLabel(assessment: Assessment): string {
  const { ah, nominalVoltage, energyWh } = assessment.spec;
  const parts = [
    ah !== null ? `${ah} Ah` : null,
    nominalVoltage !== null ? `${nominalVoltage} V nominal` : null,
    energyWh !== null ? formatWh(energyWh) : null,
  ].filter((part): part is string => part !== null);
  return parts.join(' · ');
}

function toRecommended(assessment: Assessment): RecommendedProduct {
  return {
    product: toProductSummary(assessment.product),
    reasons: assessment.reasons,
    capacityLabel: capacityLabel(assessment),
  };
}

function smallestMatch(candidates: Product[]): Product | undefined {
  return [...candidates].sort((a, b) => minSellingPrice(a) - minSellingPrice(b))[0];
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  /**
   * The requirement, as the calculator computed it.
   *
   * `v` (system voltage) and `w` (running watts) are both load-bearing: the
   * first decides which products are electrically compatible, the second is
   * what the documented discharge limit is checked against. A request without
   * them cannot establish compatibility, and `recommendBattery` answers
   * `incomplete-request` rather than falling back to matching on capacity —
   * capacity alone cannot tell a 12 V home battery from a 51 V traction pack,
   * which is exactly how a 51 V e-scooter pack came to be offered to somebody
   * sizing a 12 V 45 Ah home battery.
   */
  const runningWatts = positiveNumber(params.get('w'));
  const requirement: SizingRequirement = {
    runningWatts,
    requiredAh: positiveNumber(params.get('ah')),
    requiredDcWatts: runningWatts > 0 ? dcWattsFor(runningWatts) : 0,
    systemVoltage: homeSystemVoltage(params.get('v')),
    backupHours: positiveNumber(params.get('h')),
  };
  const va = positiveNumber(params.get('va'));

  // Published rows only — `DbCatalogProvider` reads `listPublished()`, so a
  // draft product is not in this list and cannot be recommended.
  const catalogue = await allProducts();

  const recommendation = recommendBattery(catalogue, requirement);

  /**
   * Inverters and combos, unchanged from before P1-B-2.
   *
   * `availability` is the rollup the storefront itself renders, and it respects
   * an explicitly out-of-stock variant. A raw `variants.some(v => v.stock > 0)`
   * would read the sentinel quantity `to-domain.ts` substitutes for untracked
   * inventory and recommend a product marked out of stock.
   */
  const sellable = catalogue.filter((p) => productAvailability(p) !== 'out-of-stock');
  const inverter = smallestMatch(
    sellable.filter((p) => p.category === 'inverters' && (p.facets.capacityVa ?? 0) >= va),
  );
  const combo = smallestMatch(
    sellable.filter(
      (p) =>
        p.category === 'combos' &&
        (p.facets.capacityVa ?? 0) >= va &&
        (p.facets.batteryAh ?? 0) >= requirement.requiredAh,
    ),
  );

  /**
   * Which families the catalogue holds nothing sellable for at all.
   *
   * Distinct from "nothing large enough": if we stock no inverters whatsoever,
   * the shopper's load is not the problem and telling them it is beyond our
   * range would be false.
   */
  const unavailableFamilies: SizingRecommendation['unavailableFamilies'] = [];
  if (!sellable.some((p) => p.category === 'inverters')) unavailableFamilies.push('inverter');
  if (!sellable.some((p) => p.category === 'combos')) unavailableFamilies.push('combo');
  if (
    !sellable.some(
      (p) => p.category === 'batteries' && HOME_BACKUP_SUBCATEGORIES.has(p.subcategory),
    )
  ) {
    unavailableFamilies.push('battery');
  }

  const body: SizingRecommendation = {
    status: recommendation.status,
    battery:
      recommendation.status === 'matched' && recommendation.best
        ? toRecommended(recommendation.best)
        : null,
    unavailableMatch:
      recommendation.status === 'not-available' && recommendation.best
        ? toRecommended(recommendation.best)
        : null,
    alternatives: recommendation.alternatives.map((alternative) => ({
      ...toRecommended(alternative.assessment),
      whyNotSelected: alternative.whyNotSelected,
    })),
    unavailableFamilies,
    inverter: inverter ? toProductSummary(inverter) : null,
    combo: combo ? toProductSummary(combo) : null,
  };

  return NextResponse.json(body);
}
