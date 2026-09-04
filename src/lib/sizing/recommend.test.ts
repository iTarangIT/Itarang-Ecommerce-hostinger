import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TRONTEK_PRODUCTS } from '../../../db/seed/trontek-products.ts';
import { toDomainProduct } from '@/lib/products/to-domain';
import type { ProductRecord } from '@/lib/products/types';
import type { Product } from '@/lib/commerce/types';
import { calculateSizing } from './calculator';
import {
  SYSTEM_VOLTAGE_BY_NOMINAL,
  assess,
  parseDischargeAmps,
  recommendBattery,
  type SizingRequirement,
} from './recommend';

/**
 * The recommendation engine, tested against the real catalogue.
 *
 * Every product here comes from `db/seed/trontek-products.ts` — the reviewed
 * transcription of the eight manufacturer listing sheets — projected through
 * the same `toDomainProduct` the storefront uses. Nothing in this file defines
 * a product's electrical values, so a test cannot pass because it agrees with a
 * second copy of the data.
 *
 * The exceptions are labelled `HYPOTHETICAL`: rows derived from a real one with
 * a single field changed, used to reach a state today's catalogue cannot
 * produce (an out-of-stock product, a product missing a specification, two
 * compatible products at once). They assert engine behaviour, never a product
 * claim.
 *
 * The arithmetic constants in `calculator.ts` are deliberately **not** pinned.
 * `docs/p1-b-2-catalogue-audit.md` records all four as awaiting business
 * confirmation; a test that fixed one would quietly make it permanent.
 */

const ROOT = resolve(__dirname, '../../..');

/* -------------------------------------------------- the catalogue, as domain */

/** The seed shape as the repository would return it. */
function asRecord(seed: (typeof TRONTEK_PRODUCTS)[number]): ProductRecord {
  return {
    ...seed,
    id: 0,
    status: seed.status,
    emiEnabled: false,
    manufacturer: null,
    seller: null,
    launchedAt: null,
    seoTitle: null,
    seoDescription: null,
    hostingerProductId: null,
    variants: seed.variants.map((variant, index) => ({
      id: index,
      variantKey: variant.variantKey,
      sku: variant.sku,
      title: variant.title ?? '',
      optionValues: variant.optionValues ?? {},
      mrp: variant.mrp,
      selling: variant.selling,
      stock: variant.stock,
      availability: variant.availability,
      position: index,
    })),
    media: seed.media.map((media, index) => ({
      id: index,
      storagePath: media.file,
      url: '',
      altText: media.altText,
      role: media.role,
      mime: null,
      bytes: null,
      width: null,
      height: null,
      position: index,
      isPrimary: index === 0,
    })),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: null,
    archivedAt: null,
    createdBy: null,
    updatedBy: null,
  };
}

function seedFor(productKey: string) {
  const seed = TRONTEK_PRODUCTS.find((entry) => entry.productKey === productKey);
  if (!seed) throw new Error(`${productKey} is not in the seed data`);
  return seed;
}

function domainFor(productKey: string): Product {
  return toDomainProduct(asRecord(seedFor(productKey)));
}

/**
 * What the storefront actually serves.
 *
 * `DbCatalogProvider` reads `listPublished()`, so this is the only list the
 * route can ever hand the engine. Powercube 2.7 is a draft and is absent.
 */
const PUBLISHED: Product[] = TRONTEK_PRODUCTS.filter((p) => p.status === 'published').map((p) =>
  toDomainProduct(asRecord(p)),
);

const POWERCUBE_1_4 = 'trontek-tk12100';
const POWERCUBE_2_7 = 'trontek-tk25100';

/** Never valid answers to a home-backup question. Step 4 of the P1-B-2 brief. */
const EV_PRODUCT_KEYS = [
  'trontek-tk-life-5145',
  'trontek-tk-life-6130-v2',
  'trontek-tk-life-6130-metal-top',
  'trontek-tk-life-6145',
  'trontek-tk-life-7332',
  'trontek-tk-liev-51105',
];

/** A requirement built from a real appliance selection, not from typed figures. */
function requirementFor(selection: Record<string, number>, hours: number): SizingRequirement {
  const sizing = calculateSizing(selection, hours);
  return {
    runningWatts: sizing.runningWatts,
    requiredAh: sizing.requiredAh,
    requiredDcWatts: sizing.requiredDcWatts,
    systemVoltage: sizing.systemVoltage,
    backupHours: sizing.backupHours,
  };
}

/* ------------------------------------------------------------- sanity first */

describe('the catalogue under test is the real one', () => {
  it('holds eight products, seven of them published', () => {
    expect(TRONTEK_PRODUCTS).toHaveLength(8);
    expect(PUBLISHED).toHaveLength(7);
  });

  it('projects the two documented Powercube voltages and capacities', () => {
    // Read from the seed, not asserted against a literal transcription: this
    // fails if the projection loses a facet, which is what the engine reads.
    const home = domainFor(POWERCUBE_1_4);
    expect(home.facets.voltage).toBe(seedFor(POWERCUBE_1_4).facets.voltage);
    expect(home.facets.batteryAh).toBe(seedFor(POWERCUBE_1_4).facets.batteryAh);
  });
});

/* ------------------------------------------- calculator shape (P1-B-1 work) */

describe('calculateSizing (shape only, no figures asserted)', () => {
  it('reports a system voltage the recommender can match on', () => {
    const result = calculateSizing({ fan: 2, led: 4 }, 4);
    expect([12, 24, 48]).toContain(result.systemVoltage);
  });

  it('asks for nothing when nothing is selected', () => {
    const result = calculateSizing({}, 4);
    expect(result.runningWatts).toBe(0);
    expect(result.requiredAh).toBe(0);
    expect(result.loadEnergyWh).toBe(0);
    expect(result.requiredDcWatts).toBe(0);
  });

  it('never returns a negative or fractional requirement', () => {
    const result = calculateSizing({ fridge: 1, fan: 3, led: 6 }, 6);
    expect(result.requiredVa).toBeGreaterThan(0);
    expect(Number.isInteger(result.requiredVa)).toBe(true);
    expect(Number.isInteger(result.requiredAh)).toBe(true);
    expect(Number.isInteger(result.requiredDcWatts)).toBe(true);
  });

  it('scales storage with the backup window, not with nothing', () => {
    const four = calculateSizing({ fan: 4, led: 6 }, 4);
    const eight = calculateSizing({ fan: 4, led: 6 }, 8);
    expect(eight.requiredAh).toBeGreaterThan(four.requiredAh);
  });

  it('asks the battery for at least what the appliances draw', () => {
    // A relative property: the DC side can never be asked for less than the AC
    // side. True under any efficiency figure below 1.
    const result = calculateSizing({ fan: 2, tv: 1 }, 4);
    expect(result.requiredDcWatts).toBeGreaterThanOrEqual(result.runningWatts);
  });

  it("states the load energy as the shopper's own two inputs multiplied", () => {
    const result = calculateSizing({ led: 10 }, 5);
    expect(result.loadEnergyWh).toBe(result.runningWatts * 5);
  });
});

/* ------------------------------------------------ nominal → system voltage */

describe('nominal to system voltage mapping', () => {
  it('maps the nominal voltages the catalogue actually contains', () => {
    expect(SYSTEM_VOLTAGE_BY_NOMINAL.get(12.8)).toBe(12);
    expect(SYSTEM_VOLTAGE_BY_NOMINAL.get(25.6)).toBe(24);
  });

  it('fails closed on every EV traction voltage in the catalogue', () => {
    // Read from the products themselves rather than typed out, so a new EV
    // voltage added to the catalogue is covered without editing this test.
    const evVoltages = EV_PRODUCT_KEYS.map((key) => seedFor(key).facets.voltage!);
    expect(evVoltages.length).toBeGreaterThan(0);
    for (const nominal of evVoltages) {
      expect(SYSTEM_VOLTAGE_BY_NOMINAL.get(nominal)).toBeUndefined();
    }
  });

  it('fails closed on an unknown voltage rather than guessing the nearest', () => {
    expect(SYSTEM_VOLTAGE_BY_NOMINAL.get(36)).toBeUndefined();
    expect(SYSTEM_VOLTAGE_BY_NOMINAL.get(0)).toBeUndefined();
  });
});

/* ------------------------------------------------- documented power limits */

describe('the documented discharge limit is read, not assumed', () => {
  it('takes the ampere figure out of the catalogue wording, not the C-rate', () => {
    // The three shapes the catalogue actually uses.
    expect(parseDischargeAmps('1C (≈105 A)')).toBe(105);
    expect(parseDischargeAmps('45 A (max. 1.5C)')).toBe(45);
    expect(parseDischargeAmps('30 A')).toBe(30);
  });

  it('never mistakes an Ah figure for a current', () => {
    // The failure this guards: reading "105 Ah" as 105 A would inflate a pack's
    // power limit by whatever its voltage is.
    expect(parseDischargeAmps('105 Ah')).toBeNull();
  });

  it('fails closed on wording it cannot read', () => {
    expect(parseDischargeAmps(null)).toBeNull();
    expect(parseDischargeAmps('')).toBeNull();
    expect(parseDischargeAmps('see datasheet')).toBeNull();
    expect(parseDischargeAmps('1C')).toBeNull();
  });

  it('derives the Powercube power ceiling from its own two documented values', () => {
    const product = domainFor(POWERCUBE_1_4);
    const spec = assess(product, requirementFor({ led: 1 }, 1)).spec;
    expect(spec.maxContinuousDischargeA).not.toBeNull();
    expect(spec.maxContinuousDischargeW).toBeCloseTo(
      spec.maxContinuousDischargeA! * spec.nominalVoltage!,
      6,
    );
  });

  it('derives pack energy in agreement with the documented Energy row', () => {
    // 12.8 V x 105 Ah = 1.344 kWh, which is what the source document states.
    // If the two ever disagree the derivation is wrong, not the document.
    for (const key of [POWERCUBE_1_4, POWERCUBE_2_7]) {
      const product = domainFor(key);
      const spec = assess(product, requirementFor({ led: 1 }, 1)).spec;
      const documented = product.specGroups
        .flatMap((group) => group.specs)
        .find((row) => row.label === 'Energy')!.value;
      const kWh = Number(documented.replace(/[^\d.]/g, ''));
      expect(spec.energyWh! / 1000).toBeCloseTo(kWh, 3);
    }
  });
});

/* ------------------------------------------------------ 1 · a valid 12V load */

describe('1 · a small valid 12V home-backup load', () => {
  // One ceiling fan and four lights over four hours. Chosen because the
  // requirement it produces is inside the published 12V product's documented
  // capacity under the calculator's current, unconfirmed derating.
  const requirement = requirementFor({ fan: 1, led: 4 }, 4);

  it('resolves to a 12V system', () => {
    expect(requirement.systemVoltage).toBe(12);
  });

  it('recommends the published 12V home battery', () => {
    const result = recommendBattery(PUBLISHED, requirement);
    expect(result.status).toBe('matched');
    expect(result.best?.product.id).toBe(POWERCUBE_1_4);
  });

  it('explains the recommendation from documented values only', () => {
    const result = recommendBattery(PUBLISHED, requirement);
    const reasons = result.best!.reasons.join(' ');
    expect(reasons).toContain('12V battery input');
    expect(reasons).toContain(`${requirement.requiredAh} Ah`);
    expect(reasons).toContain('continuously');
    expect(reasons).toContain('In stock');
  });

  it('offers no alternatives, because only one product is compatible', () => {
    expect(recommendBattery(PUBLISHED, requirement).alternatives).toEqual([]);
  });
});

/* ------------------------------------------------------- 2 · a 24V requirement */

describe('2 · a valid 24V requirement', () => {
  const requirement: SizingRequirement = {
    runningWatts: 600,
    requiredAh: 100,
    requiredDcWatts: 706,
    systemVoltage: 24,
    backupHours: 4,
  };

  it('returns nothing from the published catalogue, because the 24V product is a draft', () => {
    const result = recommendBattery(PUBLISHED, requirement);
    expect(result.best).toBeNull();
    expect(result.status).not.toBe('matched');
  });

  it('would match the 24V product only once it is published and priced', () => {
    // HYPOTHETICAL: the real Powercube 2.7 record with the two fields its
    // publish gate blocks on filled in. It asserts that nothing *other* than
    // its draft status and missing price stands between it and a match — not
    // that it is priced.
    const seed = seedFor(POWERCUBE_2_7);
    const published = toDomainProduct({
      ...asRecord(seed),
      status: 'published',
      variants: asRecord(seed).variants.map((variant) => ({
        ...variant,
        mrp: 4_000_000,
        selling: 3_500_000,
      })),
    });

    const result = recommendBattery([...PUBLISHED, published], requirement);
    expect(result.status).toBe('matched');
    expect(result.best?.product.id).toBe(POWERCUBE_2_7);
  });

  it('does not answer a 24V requirement with the 12V product', () => {
    const result = recommendBattery(PUBLISHED, requirement);
    const twelveVolt = result.considered.find((entry) => entry.product.id === POWERCUBE_1_4)!;
    expect(twelveVolt.rejections).toContain('voltage-mismatch');
  });
});

/* ---------------------------------------------- 3 · never an EV pack for home */

describe('3 · a home-backup load never returns an EV product', () => {
  /** A sweep wide enough to cover every voltage and capacity band. */
  const SWEEP: SizingRequirement[] = [
    { runningWatts: 100, requiredAh: 20, requiredDcWatts: 118, systemVoltage: 12, backupHours: 2 },
    { runningWatts: 200, requiredAh: 45, requiredDcWatts: 236, systemVoltage: 12, backupHours: 4 },
    { runningWatts: 400, requiredAh: 105, requiredDcWatts: 471, systemVoltage: 12, backupHours: 4 },
    { runningWatts: 900, requiredAh: 105, requiredDcWatts: 1059, systemVoltage: 24, backupHours: 4 },
    { runningWatts: 2500, requiredAh: 300, requiredDcWatts: 2942, systemVoltage: 48, backupHours: 6 },
    { runningWatts: 30, requiredAh: 5, requiredDcWatts: 36, systemVoltage: 12, backupHours: 1 },
  ];

  it.each(SWEEP)(
    'never selects a traction pack for $runningWatts W at $systemVoltage V',
    (requirement) => {
      const result = recommendBattery(PUBLISHED, requirement);
      const chosen = [result.best, ...result.alternatives.map((a) => a.assessment)]
        .filter((entry) => entry !== null)
        .map((entry) => entry!.product.id);
      for (const key of EV_PRODUCT_KEYS) {
        expect(chosen).not.toContain(key);
      }
    },
  );

  it.each(EV_PRODUCT_KEYS)('%s is refused on application and on voltage', (key) => {
    // Two independent barriers, so bypassing either alone changes nothing.
    const requirement = SWEEP[1]!;
    const verdict = assess(domainFor(key), requirement);
    expect(verdict.rejections).toContain('not-a-home-backup-subcategory');
    expect(verdict.rejections).toContain('declared-vehicle-application');
    expect(verdict.rejections).toContain('voltage-not-documented');
  });
});

/* ------------------------------------------------------- 4 · voltage mismatch */

describe('4 · a voltage mismatch produces no recommendation', () => {
  it('withholds rather than offering a different voltage', () => {
    const result = recommendBattery(PUBLISHED, {
      runningWatts: 3200,
      requiredAh: 100,
      requiredDcWatts: 3765,
      systemVoltage: 48,
      backupHours: 4,
    });
    expect(result.best).toBeNull();
    expect(result.status).toBe('no-catalogue-match');
  });
});

/* -------------------------------------------------- 5 · never undersize */

describe('5 · insufficient capacity produces no recommendation', () => {
  it('refuses rather than offering a smaller battery', () => {
    const requirement: SizingRequirement = {
      runningWatts: 300,
      requiredAh: 106, // one Ah above the documented capacity of the only 12V product
      requiredDcWatts: 353,
      systemVoltage: 12,
      backupHours: 4,
    };
    const result = recommendBattery(PUBLISHED, requirement);
    expect(result.status).toBe('no-catalogue-match');
    expect(result.considered.find((e) => e.product.id === POWERCUBE_1_4)!.rejections).toContain(
      'capacity-below-requirement',
    );
  });

  it('refuses a load above the documented continuous discharge limit', () => {
    // Capacity is satisfied and the voltage matches; only the pack's own
    // documented current limit stands in the way. Without this check the
    // recommendation would be electrically wrong while looking correct.
    const product = domainFor(POWERCUBE_1_4);
    const ceiling = assess(product, {
      runningWatts: 1,
      requiredAh: 1,
      requiredDcWatts: 1,
      systemVoltage: 12,
      backupHours: 1,
    }).spec.maxContinuousDischargeW!;

    const result = recommendBattery(PUBLISHED, {
      runningWatts: Math.round(ceiling),
      requiredAh: 10,
      requiredDcWatts: Math.round(ceiling) + 1,
      systemVoltage: 12,
      backupHours: 1,
    });
    expect(result.status).toBe('no-catalogue-match');
    expect(result.considered.find((e) => e.product.id === POWERCUBE_1_4)!.rejections).toContain(
      'discharge-limit-below-requirement',
    );
  });
});

/* --------------------------------------------------- 6 · out of stock */

describe('6 · an unavailable product is not recommended', () => {
  const requirement = requirementFor({ fan: 1, led: 4 }, 4);

  /** HYPOTHETICAL: the real 12V product with its variant stock set to zero. */
  const outOfStock = toDomainProduct({
    ...asRecord(seedFor(POWERCUBE_1_4)),
    variants: asRecord(seedFor(POWERCUBE_1_4)).variants.map((variant) => ({
      ...variant,
      stock: 0,
    })),
  });

  it('reports it as unavailable rather than as no match', () => {
    const result = recommendBattery([outOfStock], requirement);
    expect(result.status).toBe('not-available');
    expect(result.best?.product.id).toBe(POWERCUBE_1_4);
  });

  it('never presents it as a match', () => {
    const result = recommendBattery([outOfStock], requirement);
    expect(result.considered[0]!.rejections).toContain('not-available');
  });

  it('respects an explicitly out-of-stock label on an untracked variant', () => {
    // The sentinel quantity `to-domain.ts` substitutes for untracked stock is
    // 99. A raw `stock > 0` check would call this product available.
    const labelled = toDomainProduct({
      ...asRecord(seedFor(POWERCUBE_1_4)),
      variants: asRecord(seedFor(POWERCUBE_1_4)).variants.map((variant) => ({
        ...variant,
        stock: null,
        availability: 'out-of-stock' as const,
      })),
    });
    expect(labelled.variants[0]!.stock).toBe(99);
    expect(recommendBattery([labelled], requirement).status).toBe('not-available');
  });
});

/* --------------------------------------------------------- 7 · draft product */

describe('7 · a draft product is never recommended', () => {
  it('is absent from the list the route can serve', () => {
    expect(seedFor(POWERCUBE_2_7).status).toBe('draft');
    expect(PUBLISHED.map((p) => p.id)).not.toContain(POWERCUBE_2_7);
  });

  it('cannot be reached by any requirement', () => {
    // Every band, against the only list the storefront serves.
    for (const voltage of [12, 24, 48] as const) {
      for (const ah of [5, 45, 105, 200]) {
        const result = recommendBattery(PUBLISHED, {
          runningWatts: 200,
          requiredAh: ah,
          requiredDcWatts: 236,
          systemVoltage: voltage,
          backupHours: 4,
        });
        expect(result.best?.product.id ?? null).not.toBe(POWERCUBE_2_7);
        expect(result.alternatives.map((a) => a.assessment.product.id)).not.toContain(
          POWERCUBE_2_7,
        );
      }
    }
  });

  it('carries no price, which is why it is a draft', () => {
    for (const variant of seedFor(POWERCUBE_2_7).variants) {
      expect(variant.selling).toBeNull();
    }
  });
});

/* ------------------------------------------- 8 · missing information */

describe('8 · missing technical information fails closed', () => {
  const requirement = requirementFor({ fan: 1, led: 4 }, 4);
  const base = asRecord(seedFor(POWERCUBE_1_4));

  it('withholds when the product states no voltage', () => {
    // HYPOTHETICAL: the real product with `facets.voltage` cleared.
    const { voltage: _dropped, ...facets } = base.facets;
    const product = toDomainProduct({ ...base, facets });
    const result = recommendBattery([product], requirement);
    expect(result.status).toBe('information-missing');
    expect(result.best).toBeNull();
    expect(result.considered[0]!.rejections).toContain('voltage-not-documented');
  });

  it('withholds when the product states no capacity', () => {
    const { batteryAh: _dropped, ...facets } = base.facets;
    const product = toDomainProduct({ ...base, facets });
    const result = recommendBattery([product], requirement);
    expect(result.status).toBe('information-missing');
    expect(result.considered[0]!.rejections).toContain('capacity-not-documented');
  });

  it('withholds when the product states no discharge limit', () => {
    const product = toDomainProduct({
      ...base,
      specGroups: base.specGroups.map((group) => ({
        ...group,
        specs: group.specs.filter((spec) => !/discharge current/i.test(spec.label)),
      })),
    });
    const result = recommendBattery([product], requirement);
    expect(result.status).toBe('information-missing');
    expect(result.considered[0]!.rejections).toContain('discharge-limit-not-documented');
  });

  it('withholds when the product documents no recommended use', () => {
    const product = toDomainProduct({
      ...base,
      specGroups: base.specGroups.map((group) => ({
        ...group,
        specs: group.specs.filter((spec) => spec.label !== 'Recommended uses'),
      })),
    });
    const result = recommendBattery([product], requirement);
    expect(result.status).toBe('information-missing');
    expect(result.considered[0]!.rejections).toContain('application-not-documented');
  });

  it('withholds when the shopper has given no system voltage', () => {
    const result = recommendBattery(PUBLISHED, { ...requirement, systemVoltage: null });
    expect(result.status).toBe('incomplete-request');
    expect(result.best).toBeNull();
  });
});

/* ------------------------------------------------ 9 · deterministic ranking */

describe('9 · multiple compatible products rank deterministically', () => {
  const requirement: SizingRequirement = {
    runningWatts: 200,
    requiredAh: 60,
    requiredDcWatts: 236,
    systemVoltage: 12,
    backupHours: 4,
  };

  /**
   * HYPOTHETICAL: the real 12V product at three capacities.
   *
   * Today's catalogue holds exactly one compatible 12V product, so the ranking
   * rule cannot be exercised against it. These three are the same real record
   * with `batteryAh` and price changed, and they assert the rule — smallest
   * sufficient first — not any product's specification.
   */
  const base = asRecord(seedFor(POWERCUBE_1_4));
  function variantOf(key: string, ah: number, selling: number): Product {
    return toDomainProduct({
      ...base,
      productKey: key,
      slug: key,
      facets: { ...base.facets, batteryAh: ah },
      variants: base.variants.map((variant) => ({ ...variant, selling, sku: `${key}-sku` })),
    });
  }
  const small = variantOf('hypothetical-75ah', 75, 2_000_000);
  const medium = variantOf('hypothetical-105ah', 105, 2_500_000);
  const large = variantOf('hypothetical-200ah', 200, 4_000_000);

  it('prefers the smallest product that satisfies the requirement', () => {
    const result = recommendBattery([large, medium, small], requirement);
    expect(result.status).toBe('matched');
    expect(result.best?.product.id).toBe('hypothetical-75ah');
  });

  it('orders the alternatives by capacity, largest last', () => {
    const result = recommendBattery([large, small, medium], requirement);
    expect(result.alternatives.map((a) => a.assessment.product.id)).toEqual([
      'hypothetical-105ah',
      'hypothetical-200ah',
    ]);
  });

  it('produces the same answer whatever order the catalogue arrives in', () => {
    const orders = [
      [small, medium, large],
      [large, medium, small],
      [medium, large, small],
    ];
    const answers = orders.map((catalogue) => {
      const result = recommendBattery(catalogue, requirement);
      return [result.best!.product.id, ...result.alternatives.map((a) => a.assessment.product.id)];
    });
    expect(answers[1]).toEqual(answers[0]);
    expect(answers[2]).toEqual(answers[0]);
  });

  it('says why the larger option was not selected', () => {
    const result = recommendBattery([small, large], requirement);
    expect(result.alternatives[0]!.whyNotSelected).toMatch(/more capacity than your load needs/i);
  });

  it('never lists an incompatible product as an alternative', () => {
    const result = recommendBattery([...PUBLISHED, small, large], requirement);
    const listed = result.alternatives.map((a) => a.assessment.product.id);
    for (const key of EV_PRODUCT_KEYS) expect(listed).not.toContain(key);
  });
});

/* ------------------------------------------ 10 · beyond the whole catalogue */

describe('10 · a requirement beyond every product yields the support path', () => {
  it('is reported as no catalogue match, not as missing information', () => {
    const result = recommendBattery(PUBLISHED, {
      runningWatts: 1000,
      requiredAh: 600,
      requiredDcWatts: 1177,
      systemVoltage: 12,
      backupHours: 8,
    });
    expect(result.status).toBe('no-catalogue-match');
    expect(result.best).toBeNull();
    expect(result.alternatives).toEqual([]);
  });

  it('proves the claim before making it', () => {
    // "Beyond our range" is only ever said when a capacity or power comparison
    // actually failed — never merely because nothing matched.
    const result = recommendBattery(PUBLISHED, {
      runningWatts: 1000,
      requiredAh: 600,
      requiredDcWatts: 1177,
      systemVoltage: 12,
      backupHours: 8,
    });
    const home = result.considered.find((entry) => entry.product.id === POWERCUBE_1_4)!;
    expect(home.rejections).toContain('capacity-below-requirement');
  });
});

/* ------------------------------------ 11 · every product, intended application */

describe('11 · every real product is checked against its intended application', () => {
  const homeRequirement: SizingRequirement = {
    runningWatts: 200,
    requiredAh: 45,
    requiredDcWatts: 236,
    systemVoltage: 12,
    backupHours: 4,
  };

  it.each(TRONTEK_PRODUCTS.map((p) => p.productKey))(
    '%s is judged on what it documents',
    (key) => {
      const seed = seedFor(key);
      const verdict = assess(domainFor(key), homeRequirement);
      const isHomeStorage = seed.subcategory === 'lithium';

      if (isHomeStorage) {
        // Both Powercubes clear every application barrier; only voltage or
        // capacity may separate them from a match.
        expect(verdict.rejections).not.toContain('not-a-home-backup-subcategory');
        expect(verdict.rejections).not.toContain('declared-vehicle-application');
        expect(verdict.rejections).not.toContain('application-not-documented');
        expect(verdict.spec.documentedApplication).toMatch(/home backup power/i);
      } else {
        expect(verdict.rejections).toContain('declared-vehicle-application');
        expect(verdict.spec.systemVoltage).toBeNull();
      }
    },
  );

  it('documents an application for all eight, so none fails for lack of one', () => {
    for (const seed of TRONTEK_PRODUCTS) {
      expect(
        assess(domainFor(seed.productKey), homeRequirement).spec.documentedApplication,
        `${seed.productKey} states no recommended use`,
      ).not.toBeNull();
    }
  });
});

/* -------------------------------------- 12 · no duplicated product definitions */

describe('12 · the engine holds no product definitions of its own', () => {
  it('names no product, model, slug or capacity in its code', () => {
    const source = readFileSync(join(ROOT, 'src', 'lib', 'sizing', 'recommend.ts'), 'utf8');
    // Comments carry provenance and quote the source documents; the code must
    // not. Stripped the same way `seed-data.test.ts` strips them.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    for (const needle of ['Powercube', 'TK12100', 'TK25100', 'TK-LiFe', 'LiEV', 'trontek']) {
      expect(code, `recommend.ts hardcodes ${needle}`).not.toMatch(new RegExp(needle, 'i'));
    }
    // No capacity or energy literal from the catalogue either. Nominal
    // voltages are the one exception: 12.8 and 25.6 are keys in the fail-closed
    // voltage map, which is a compatibility rule the documents state, not a
    // product definition.
    for (const needle of ['105', '1344', '2688']) {
      expect(code, `recommend.ts hardcodes ${needle}`).not.toContain(needle);
    }
  });

  it('changes its answer when the catalogue changes', () => {
    // The proof that the recommendation is read from data: raise the
    // requirement past the product's documented capacity and the same product
    // stops being recommended, with no code change.
    const product = domainFor(POWERCUBE_1_4);
    const ah = product.facets.batteryAh!;
    const base = {
      runningWatts: 200,
      requiredDcWatts: 236,
      systemVoltage: 12 as const,
      backupHours: 4,
    };

    expect(recommendBattery([product], { ...base, requiredAh: ah }).status).toBe('matched');
    expect(recommendBattery([product], { ...base, requiredAh: ah + 1 }).status).toBe(
      'no-catalogue-match',
    );
  });
});

/* --------------------------------------------- 13 · the original dangerous case */

describe('13 · the original dangerous case, /api/sizing?va=100&ah=45', () => {
  /**
   * The request that produced the bug: an inverter VA and a battery Ah, no
   * system voltage and no running watts. Compatibility cannot be established
   * from those two numbers, so the engine must withhold.
   */
  const requirement: SizingRequirement = {
    runningWatts: 0,
    requiredAh: 45,
    requiredDcWatts: 0,
    systemVoltage: null,
    backupHours: 0,
  };

  it('returns no product at all', () => {
    const result = recommendBattery(PUBLISHED, requirement);
    expect(result.status).toBe('incomplete-request');
    expect(result.best).toBeNull();
    expect(result.alternatives).toEqual([]);
  });

  it('never offers a 51V traction pack as an alternative', () => {
    const result = recommendBattery(PUBLISHED, requirement);
    const fiftyOneVolt = result.considered.filter((entry) => entry.spec.nominalVoltage === 51);
    expect(fiftyOneVolt.length).toBeGreaterThan(0);
    for (const entry of fiftyOneVolt) {
      expect(entry.rejections.length).toBeGreaterThan(0);
    }
  });

  it('still refuses once a voltage is supplied, because 51V is not a home voltage', () => {
    for (const systemVoltage of [12, 24, 48] as const) {
      const result = recommendBattery(PUBLISHED, {
        ...requirement,
        runningWatts: 200,
        requiredDcWatts: 236,
        systemVoltage,
      });
      expect(result.best?.spec.nominalVoltage ?? null).not.toBe(51);
    }
  });
});
