import { describe, expect, it } from "vitest";
import {
  APPLIANCES,
  APPLIANCE_BY_ID,
  DEFAULT_DIVERSITY,
  DIVERSITY_OPTIONS,
  HOME_PRESETS,
  MAX_CUSTOM_APPLIANCES,
  ROOMS,
  appliancesForRoom,
  calculateSizing,
  decodeSelection,
  encodeSelection,
} from "./calculator";

/**
 * Load sizing arithmetic.
 *
 * The property this file exists to hold is the one that is easiest to get
 * wrong and hardest to notice: **the simultaneous-use fraction reduces energy
 * and never power.** An inverter has to carry whatever is switched on when the
 * grid fails, so dividing its VA rating by a diversity factor sizes it for a
 * convenient average and lets it trip on the first evening everything is on.
 * The battery only has to supply the watt-hours actually drawn, which is what
 * the fraction legitimately reduces.
 *
 * The four electrical constants are deliberately not pinned here.
 * `docs/p1-b-2-catalogue-audit.md` records all four as awaiting business
 * confirmation, and a test that fixed one would quietly make it permanent.
 */

const ONE_FAN = { fan: 1 };

describe("diversity applies to energy and never to power", () => {
  it("leaves running watts, peak and VA untouched", () => {
    const full = calculateSizing(ONE_FAN, 4, { diversity: 1 });
    const half = calculateSizing(ONE_FAN, 4, { diversity: 0.5 });

    expect(half.runningWatts).toBe(full.runningWatts);
    expect(half.peakWatts).toBe(full.peakWatts);
    expect(half.requiredVa).toBe(full.requiredVa);
    expect(half.requiredDcWatts).toBe(full.requiredDcWatts);
  });

  it("halves the energy and roughly halves the capacity", () => {
    const full = calculateSizing(ONE_FAN, 4, { diversity: 1 });
    const half = calculateSizing(ONE_FAN, 4, { diversity: 0.5 });

    expect(half.loadEnergyWh).toBe(Math.round(full.loadEnergyWh / 2));
    expect(half.requiredAh).toBeLessThan(full.requiredAh);
    // Rounded up to the nearest 5 Ah, so exact halving is not the contract.
    expect(half.requiredAh).toBeGreaterThanOrEqual(
      Math.floor(full.requiredAh / 2),
    );
  });

  it("defaults to everything running together", () => {
    expect(DEFAULT_DIVERSITY).toBe(1);
    expect(calculateSizing(ONE_FAN, 4).requiredAh).toBe(
      calculateSizing(ONE_FAN, 4, { diversity: 1 }).requiredAh,
    );
  });

  it("fails closed on a value it does not recognise", () => {
    // A hand-edited link must never present a smaller battery than the real
    // requirement. Anything unrecognised falls back to 100%.
    for (const diversity of [0, -1, 0.3, 2, Number.NaN]) {
      expect(calculateSizing(ONE_FAN, 4, { diversity }).diversity).toBe(1);
    }
  });
});

describe("average consumption (20% / 50% / 100%)", () => {
  const LOAD = { fan: 4, led: 6, tv: 1, router: 1 };

  it("offers exactly the three Livguard choices, 100% first", () => {
    expect(DIVERSITY_OPTIONS.map((option) => option.value)).toEqual([
      1, 0.5, 0.2,
    ]);
    expect(DIVERSITY_OPTIONS.map((option) => option.label)).toEqual([
      "100%",
      "50%",
      "20%",
    ]);
  });

  it("scales the load energy linearly", () => {
    const full = calculateSizing(LOAD, 6, { diversity: 1 });
    const fifth = calculateSizing(LOAD, 6, { diversity: 0.2 });

    expect(full.loadEnergyWh).toBe(full.runningWatts * 6);
    expect(fifth.loadEnergyWh).toBe(Math.round(full.runningWatts * 6 * 0.2));
    expect(fifth.diversity).toBe(0.2);
  });

  it("lowers the battery monotonically and never touches the inverter", () => {
    const [full, half, fifth] = [1, 0.5, 0.2].map((diversity) =>
      calculateSizing(LOAD, 6, { diversity }),
    );
    expect(half!.requiredAh).toBeLessThan(full!.requiredAh);
    expect(fifth!.requiredAh).toBeLessThan(half!.requiredAh);
    // Capacity rounds up to the nearest 5 Ah, so 20% is a floor, not an equality.
    expect(fifth!.requiredAh).toBeGreaterThanOrEqual(
      Math.floor(full!.requiredAh * 0.2),
    );

    for (const result of [half!, fifth!]) {
      expect(result.requiredVa).toBe(full!.requiredVa);
      expect(result.peakWatts).toBe(full!.peakWatts);
      expect(result.systemVoltage).toBe(full!.systemVoltage);
      expect(result.requiredDcWatts).toBe(full!.requiredDcWatts);
    }
  });

  it("round-trips 20% through the URL", () => {
    const qs = new URLSearchParams(
      encodeSelection(LOAD, 6, { diversity: 0.2 }),
    );
    expect(qs.get("use")).toBe("0.2");
    expect(
      decodeSelection(
        qs.get("load") ?? undefined,
        qs.get("hours") ?? undefined,
        {
          use: qs.get("use") ?? undefined,
        },
      ).diversity,
    ).toBe(0.2);
  });

  it("treats the retired 75% option as unrecognised and falls back to 100%", () => {
    expect(calculateSizing(LOAD, 6, { diversity: 0.75 }).diversity).toBe(1);
    expect(decodeSelection("fan:1", "4", { use: "0.75" }).diversity).toBe(1);
  });
});

describe("custom appliances", () => {
  it("add to the running load", () => {
    const base = calculateSizing({}, 4);
    const withCustom = calculateSizing({}, 4, {
      custom: [{ name: "Sewing machine", watts: 100, quantity: 2 }],
    });

    expect(base.runningWatts).toBe(0);
    expect(withCustom.runningWatts).toBe(200);
  });

  it("carry no surge allowance, because we do not know one", () => {
    const result = calculateSizing({}, 4, {
      custom: [{ name: "Mystery box", watts: 500, quantity: 1 }],
    });
    // Peak equals running: nothing was invented for start-up.
    expect(result.peakWatts).toBe(result.runningWatts);
  });

  it("ignore entries with a nonsensical rating or count", () => {
    const result = calculateSizing({}, 4, {
      custom: [
        { name: "Zero", watts: 0, quantity: 3 },
        { name: "Negative", watts: -50, quantity: 1 },
        { name: "No units", watts: 100, quantity: 0 },
        { name: "Not a number", watts: Number.NaN, quantity: 1 },
      ],
    });
    expect(result.runningWatts).toBe(0);
  });
});

describe("the sizing itself is unchanged", () => {
  it("still counts only the largest single surge", () => {
    // Two appliances that both surge; only one realistically starts at the
    // same instant, so peak is running plus the largest single delta.
    const fan = APPLIANCE_BY_ID.get("fan")!;
    const fridge = APPLIANCE_BY_ID.get("fridge")!;
    const result = calculateSizing({ fan: 1, fridge: 1 }, 4);

    const largest = Math.max(
      fan.watts * fan.surge - fan.watts,
      fridge.watts * fridge.surge - fridge.watts,
    );
    expect(result.peakWatts).toBe(Math.round(result.runningWatts + largest));
  });

  it("returns zero for an empty selection rather than dividing by nothing", () => {
    const result = calculateSizing({}, 6);
    expect(result.runningWatts).toBe(0);
    expect(result.requiredAh).toBe(0);
    expect(result.requiredVa).toBe(0);
  });

  it("picks the system voltage from the VA thresholds", () => {
    // VA is running watts / 0.8 * 1.2, so the 1800 and 3000 VA thresholds fall
    // at 1200 W and 2000 W of running load.
    expect(calculateSizing({ led: 1 }, 4).systemVoltage).toBe(12);
    expect(calculateSizing({ ac: 1 }, 4).requiredVa).toBe(1800);
    expect(calculateSizing({ ac: 1 }, 4).systemVoltage).toBe(12);
    expect(calculateSizing({ ac: 1, fan: 1 }, 4).systemVoltage).toBe(24);
    expect(calculateSizing({ ac: 2 }, 4).systemVoltage).toBe(48);
  });
});

describe("rooms are a second way into one list", () => {
  it("gives every room at least one appliance", () => {
    for (const room of ROOMS) {
      expect(appliancesForRoom(room.id).length, room.id).toBeGreaterThan(0);
    }
  });

  it("files every appliance in at least one room", () => {
    // Otherwise the room path silently hides part of the catalogue of loads.
    for (const appliance of APPLIANCES) {
      expect(appliance.rooms.length, appliance.id).toBeGreaterThan(0);
    }
  });

  it("names only rooms that exist", () => {
    const known = new Set(ROOMS.map((room) => room.id));
    for (const appliance of APPLIANCES) {
      for (const room of appliance.rooms)
        expect(known.has(room), `${appliance.id}/${room}`).toBe(true);
    }
  });
});

describe("home presets", () => {
  it("reference only appliances that exist", () => {
    for (const preset of HOME_PRESETS) {
      for (const id of Object.keys(preset.selection)) {
        expect(APPLIANCE_BY_ID.has(id), `${preset.id} references ${id}`).toBe(
          true,
        );
      }
    }
  });

  it("all produce a real load and a sane backup window", () => {
    for (const preset of HOME_PRESETS) {
      const result = calculateSizing(preset.selection, preset.hours);
      expect(result.runningWatts, preset.id).toBeGreaterThan(0);
      expect(preset.hours).toBeGreaterThanOrEqual(1);
      expect(preset.hours).toBeLessThanOrEqual(12);
    }
  });

  it("are the five Livguard property types, in order", () => {
    // "Custom" is the empty list and lives in the component, not here.
    expect(HOME_PRESETS.map((preset) => preset.id)).toEqual([
      "1bhk",
      "2bhk",
      "3bhk",
      "4bhk",
      "villa",
    ]);
  });

  it("start a 1 BHK from the documented list", () => {
    expect(
      HOME_PRESETS.find((preset) => preset.id === "1bhk")!.selection,
    ).toEqual({
      fan: 2,
      led: 3,
      tube: 1,
      tv: 1,
      settop: 1,
      router: 1,
      charger: 1,
    });
  });

  it("keep heavy and surge-heavy loads off by default", () => {
    for (const preset of HOME_PRESETS) {
      for (const id of [
        "ac",
        "geyser",
        "iron",
        "induction",
        "microwave",
        "mixer",
        "washing",
      ]) {
        expect(
          preset.selection[id],
          `${preset.id} includes ${id}`,
        ).toBeUndefined();
      }
    }
  });

  it("grow monotonically from 1 BHK to villa", () => {
    // They are described to the shopper as home sizes; a 3 BHK drawing less
    // than a 1 BHK would be visibly wrong.
    const order = ["1bhk", "2bhk", "3bhk", "4bhk", "villa"];
    const watts = order.map(
      (id) =>
        calculateSizing(HOME_PRESETS.find((p) => p.id === id)!.selection, 4)
          .runningWatts,
    );
    expect([...watts].sort((a, b) => a - b)).toEqual(watts);
  });
});

describe("the URL round-trip", () => {
  it("carries the selection and hours", () => {
    const qs = encodeSelection({ fan: 4, led: 6 }, 5);
    const decoded = decodeSelection(
      new URLSearchParams(qs).get("load") ?? undefined,
      new URLSearchParams(qs).get("hours") ?? undefined,
    );
    expect(decoded.selection).toEqual({ fan: 4, led: 6 });
    expect(decoded.backupHours).toBe(5);
  });

  it("omits the diversity factor at its default", () => {
    // A short link for the ordinary case, and a link that *does* carry it is
    // visibly a link with an assumption in it.
    expect(
      new URLSearchParams(encodeSelection({ fan: 1 }, 4, { diversity: 1 })).has(
        "use",
      ),
    ).toBe(false);
  });

  it("round-trips a non-default diversity factor", () => {
    const qs = new URLSearchParams(
      encodeSelection({ fan: 1 }, 4, { diversity: 0.5 }),
    );
    expect(qs.get("use")).toBe("0.5");
    expect(
      decodeSelection(
        qs.get("load") ?? undefined,
        qs.get("hours") ?? undefined,
        {
          use: qs.get("use") ?? undefined,
        },
      ).diversity,
    ).toBe(0.5);
  });

  it("falls back to 100% for a mangled diversity value", () => {
    expect(decodeSelection("fan:1", "4", { use: "nonsense" }).diversity).toBe(
      1,
    );
    expect(decodeSelection("fan:1", "4", { use: "0.01" }).diversity).toBe(1);
  });

  it("round-trips custom appliances", () => {
    const custom = [{ name: "Sewing machine", watts: 120, quantity: 2 }];
    const qs = new URLSearchParams(encodeSelection({}, 4, { custom }));
    expect(
      decodeSelection(undefined, "4", { custom: qs.get("custom") ?? undefined })
        .custom,
    ).toEqual(custom);
  });

  it("strips the delimiters out of a custom name rather than escaping them", () => {
    const qs = new URLSearchParams(
      encodeSelection({}, 4, {
        custom: [{ name: "A,B~C", watts: 10, quantity: 1 }],
      }),
    );
    const decoded = decodeSelection(undefined, "4", {
      custom: qs.get("custom") ?? undefined,
    });
    expect(decoded.custom).toHaveLength(1);
    expect(decoded.custom[0]!.name).not.toMatch(/[,~]/);
  });

  it("caps how many custom appliances a link can carry", () => {
    const many = Array.from({ length: MAX_CUSTOM_APPLIANCES + 5 }, (_, i) => ({
      name: `Device ${i}`,
      watts: 10,
      quantity: 1,
    }));
    const qs = new URLSearchParams(encodeSelection({}, 4, { custom: many }));
    expect(
      decodeSelection(undefined, "4", { custom: qs.get("custom") ?? undefined })
        .custom.length,
    ).toBe(MAX_CUSTOM_APPLIANCES);
  });

  it("drops a custom entry with an implausible wattage", () => {
    expect(
      decodeSelection(undefined, "4", { custom: "Reactor~999999~1" }).custom,
    ).toEqual([]);
  });

  it("ignores an appliance id that does not exist", () => {
    expect(decodeSelection("not-an-appliance:3,fan:2", "4").selection).toEqual({
      fan: 2,
    });
  });
});
