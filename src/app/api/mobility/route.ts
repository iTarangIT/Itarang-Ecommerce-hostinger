import { NextResponse } from 'next/server';
import { z } from 'zod';
import { allProducts } from '@/lib/catalog/collections';
import { toProductSummary, type ProductSummary } from '@/lib/commerce/summary';
import { crossOriginRejection } from '@/lib/security/origin';
import { formatWh } from '@/lib/sizing/recommend';
import {
  LIMITS,
  calculateMobility,
  recommendPacks,
  type MobilityFigures,
} from '@/lib/sizing/mobility';

/**
 * Turns a mobility sizing request into shoppable EV packs.
 *
 * Like `/api/sizing`, this handler owns no electrical logic. It validates the
 * body, runs `lib/sizing/mobility.ts` — the same pure function the calculator
 * runs in the browser — reads the **published** catalogue through the active
 * provider, and lets `recommendPacks` choose by subcategory, stated voltage and
 * stated capacity. Chargers come from `linkedProducts`, the one rule the shop
 * uses everywhere for which charger fits which pack.
 *
 * POST rather than GET only because the request is a small JSON document; it
 * changes nothing and reads no session.
 */

const bodySchema = z.object({
  vehicleType: z.enum(['2w', '3w']),
  motorWatts: z.number().finite().min(LIMITS.motorWatts.min).max(LIMITS.motorWatts.max),
  systemVoltage: z.number().finite().min(LIMITS.systemVoltage.min).max(LIMITS.systemVoltage.max),
  dailyKm: z.number().finite().min(LIMITS.dailyKm.min).max(LIMITS.dailyKm.max),
  vehicleAgeYears: z
    .number()
    .finite()
    .min(LIMITS.vehicleAgeYears.min)
    .max(LIMITS.vehicleAgeYears.max),
});

export type MobilityRequest = z.infer<typeof bodySchema>;

export interface RecommendedPack {
  product: ProductSummary;
  /** Estimated km per full charge for this vehicle. An estimate. */
  estimatedRangeKm: number;
  /** True when the pack is below the required Ah — the largest we stock. */
  shortfall: boolean;
  /** "45 Ah · 51 V nominal · 2.30 kWh", from the product's own facets. */
  capacityLabel: string;
  chargers: ProductSummary[];
}

export interface MobilityResponse {
  result: MobilityFigures;
  packs: RecommendedPack[];
}

export async function POST(request: Request) {
  const rejection = crossOriginRejection(request);
  if (rejection) return rejection;

  let input: MobilityRequest;
  try {
    input = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      {
        error: 'Check the vehicle details and try again.',
        code: 'invalid_request',
      },
      { status: 400 },
    );
  }

  const computed = calculateMobility(input);
  // Everything but the range helper, which is a function and cannot cross the wire.
  const { estimatedRangeForAh, ...result } = computed;
  void estimatedRangeForAh;

  // Published rows only — `DbCatalogProvider` reads `listPublished()`, so a
  // draft product is not in this list and cannot be recommended.
  const catalogue = await allProducts();
  const packs = recommendPacks(computed, catalogue);

  const body: MobilityResponse = {
    result,
    packs: packs.map((pack) => {
      const ah = pack.product.facets.batteryAh!;
      const volts = pack.product.facets.voltage!;
      return {
        product: toProductSummary(pack.product),
        estimatedRangeKm: pack.estimatedRangeKm,
        shortfall: pack.shortfall,
        capacityLabel: `${ah} Ah · ${volts} V nominal · ${formatWh(ah * volts)}`,
        chargers: pack.chargers.map(toProductSummary),
      };
    }),
  };

  return NextResponse.json(body);
}
