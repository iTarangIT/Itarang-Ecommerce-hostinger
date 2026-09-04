# P1-B-2 — catalogue audit and electrical assumptions

Written before any calculator change, from the repository's own authoritative
sources. Nothing here was inferred from a product name.

## Sources, in order of authority

1. `docs/Trontek_*_Product_Listing.docx` — the eight manufacturer listing
   sheets. The origin of every electrical value.
2. `db/seed/trontek-*.ts` — the reviewed transcription of those eight sheets.
   `src/lib/products/seed-types.ts` states the two rules it follows: an
   `[insert …]` placeholder becomes `null`, and strings are copied verbatim.
   `src/lib/products/seed-data.test.ts` holds it to them.
3. The `products` / `product_variants` / `product_specs` tables
   (`db/migrations/0012_product_catalogue.sql`), which the importer fills from
   (2) and which an administrator then edits. **The database is the live source
   of truth**; the seed is its reviewed initial state and the only version that
   can be read in a unit test.
4. `docs/Trontek_Battery_Images_32.zip` — marketing artwork. **Not** used as a
   source of any electrical, warranty or compatibility value.

The recommendation engine reads (3) at run time, through
`allProducts()` → `catalog()` → `DbCatalogProvider.listPublished`. It reads (2)
only in tests. It contains no product definitions of its own.

## The eight products

`COMMERCE_PROVIDER=db`, so only the seven **published** rows reach the
storefront and therefore the recommender at all. Powercube 2.7 is a draft.

| # | Product | Model | Category / subcategory | Status | Application (documented) | Chemistry | Nominal V | Technical V range | Ah | Energy | Stock | Availability |
|---|---------|-------|------------------------|--------|--------------------------|-----------|-----------|-------------------|----|--------|-------|--------------|
| 1 | Powercube 1.4 Home Battery Storage | TK12100 (12.8V/105Ah) | batteries / lithium | **published** | "Residential energy storage with hybrid / solar / lithium-compatible inverters; home backup power; storing excess PV generation; peak-demand supply; off-grid use" | LiFePO4 (LFP), 4S1P | 12.8 V | 11.2 – 14.6 V ±0.2 V | 105 | 1.344 kWh | `null` (untracked) | in-stock |
| 2 | Powercube 2.7 Home Battery Storage | TK25100 (25.6V/105Ah) | batteries / lithium | **draft** (unpriced) | same wording, 24V | LiFePO4 (LFP), 8S1P | 25.6 V | 21.6 – 29.2 V ±0.2 V | 105 | 2.688 kWh | `null` (untracked) | in-stock |
| 3 | LiEV 51V 45Ah | TK-LiFe-5145 | batteries / ev-2-wheeler | published | "Electric 2-wheelers … running on a 48VV system" | LiFePO4 (LFP) | 51 V | 44.8 – 57.6 V | 45 | 2.29 kWh | `null` | in-stock |
| 4 | LiEV 61V 30Ah | TK-LiFe-6130 (V2) | batteries / ev-2-wheeler | published | "Electric 2-wheelers … 60VV system" | LiFePO4 (LFP) | 61 V | 53 – 69.35 V | 30 | 1.83 kWh | `null` | in-stock |
| 5 | LiEV 60.8V 30Ah Metal Top | TK-LiFe-6130 (Metal Top Cover) | batteries / ev-2-wheeler | published | "Electric 2-wheelers … 60VV system" | LiFePO4 (LFP) | 60.8 V | 53 – 69.35 V | 30 | 1.82 kWh | `null` | in-stock |
| 6 | LiEV 61V 45Ah | TK-LiFe-6145 (60.8V / 45Ah) | batteries / ev-2-wheeler | published | "Electric 2-wheelers … 60VV system"; CAN-enabled | LiFePO4 (LFP) | 60.8 V | 53.2 – 69.35 V | 45 | 2.74 kWh | `null` | in-stock |
| 7 | LiEV 73.6V 32Ah | TK-LiFe-7332 | batteries / ev-2-wheeler | published | "Electric 2-wheelers … 72VV system"; CAN-enabled | LiFePO4 (LFP) | 73.6 V | 60.95 – 83.95 V | 32 | 2.36 kWh | `null` | in-stock |
| 8 | LiEV 51V 105Ah Phase-II | TK LiEV-51105 (Phase-II) | batteries / ev-3-wheeler | published | "Electric 3-wheelers / e-rickshaws and e-loaders running on a 48V system" | LiFePO4 (LFP) | 51 V | 43.2 – 58.4 V | 105 | 5.36 kWh | `null` | in-stock |

Provenance of the electrical columns: nominal voltage, capacity and energy are
the "Rated voltage" / "Rated capacity (0.5CA)" / "Energy" rows of the two
Powercube "Technical specifications" tables and the "Nominal voltage" /
"Nominal capacity" / "Battery pack energy" rows of the six LiEV "Electrical
characteristics" tables. The technical voltage range is the "Voltage range" row
(Powercube) or "Discharge cut-off voltage" → "Max. charge voltage" (LiEV).

`stock` is `null` on all eight variants — inventory is not tracked — so
availability comes from the `availability` column, which reads `in-stock` for
every one. `to-domain.ts` substitutes a sentinel quantity of 99 for an
untracked count; **this is why the recommender must use
`productAvailability()` and never a raw `stock > 0` comparison.**

### System voltage and inverter/system requirements (documented, verbatim)

| Product | "Number of batteries" | "Inverter compatibility" / "Compatibility" | Charging profile |
|---|---|---|---|
| Powercube 1.4 | "1 × 12V battery required" | "Lithium-ready inverters with 12V battery input and 14.6V charging profile" | 14.6 V ±0.2 V, CC/CV, max 0.5C (≈52.5 A) |
| Powercube 2.7 | "1 × 24V battery required" | "Lithium-ready inverters with 24V battery input and 29.2V charging profile" | 29.2 V ±0.2 V, CC/CV, max 0.5C (≈52.5 A) |
| TK-LiFe-5145 | "1 × battery pack" | "48VV EV drivetrain with 57.6V charging profile" | 57.6 V CC-CV, std 0.3C (≈13.5 A) |
| TK-LiFe-6130 V2 | "1 × battery pack" | "60VV EV drivetrain with 69.35V charging profile" | 69.35 V |
| TK-LiFe-6130 Metal Top | "1 × battery pack" | "60VV EV drivetrain with 69.35V charging profile" | 69.35 V |
| TK-LiFe-6145 | "1 × battery pack" | "60VV EV drivetrain with 69.35V charging profile; CAN-enabled BMS" | 69.35 V |
| TK-LiFe-7332 | "1 × battery pack" | "72VV EV drivetrain with 83.95V charging profile; CAN-enabled BMS" | 83.95 V |
| TK LiEV-51105 | "1 × battery pack" | "48VV EV drivetrain with 58.4V charging profile" | 58.4 V |

This table is the origin of the fail-closed nominal → system-voltage map in
`src/lib/sizing/recommend.ts`. Only 12.8 V and 25.6 V map to a **home** system
voltage, because only those two products state a battery *input* voltage for an
inverter. Every LiEV voltage is absent from the map and therefore unmatchable
for home backup even if every other barrier were bypassed.

### Documented electrical limits used by the recommender

| Product | Max continuous discharge | Peak instant | Implied continuous power at nominal V |
|---|---|---|---|
| Powercube 1.4 | "Max. discharge current: 1C (≈105 A)" | not stated | 105 A × 12.8 V ≈ **1344 W** |
| Powercube 2.7 | "Max. discharge current: 1C (≈105 A)" | not stated | 105 A × 25.6 V ≈ **2688 W** |
| TK-LiFe-5145 | 45 A (max. 1.5C) | 90 A for 5 s | — (EV, not a home candidate) |
| TK-LiFe-6130 V2 | 30 A | 60 A | — |
| TK-LiFe-6130 Metal Top | 15 A | 30 A | — |
| TK-LiFe-6145 | 25 A | 55 A | — |
| TK-LiFe-7332 | 32 A | 64 A | — |
| TK LiEV-51105 | 25 A | 75 A | — |

Neither Powercube states a **peak/surge** discharge rating. The recommender
therefore checks continuous power only, and the UI does not claim that surge is
part of the sizing.

### DoD, cycle life and charging

| Product | DoD (documented) | Cycle life | Design life | Charge window | Discharge window |
|---|---|---|---|---|---|
| Powercube 1.4 | ">4000 cycles at **80% DOD**"; FAQ 2 "80–100% usable"; FAQ 3 worked example "~90% usable capacity" — **three figures, see conflict C-1** | >4000 cycles (80% DOD, 25°C, 0.5C/0.5C) | 12 years @35°C | 0 °C to +45 °C | −10 °C to +60 °C |
| Powercube 2.7 | identical wording | >4000 cycles | 12 years @35°C | 0 °C to +45 °C | −10 °C to +60 °C |
| All six LiEV | not stated | 2000 cycles at 0.5C, 25°C | not stated | per BMS table | −20 °C to 60 °C |

Cross-check: nominal V × Ah reproduces the documented energy exactly for both
Powercubes (12.8 × 105 = 1344 Wh; 25.6 × 105 = 2688 Wh). Deriving energy from
the two facets is therefore consistent with the source documents, not an
assumption.

## Conflicts found

**C-1 — Powercube usable depth of discharge has three documented values.**
The specification table's cycle-life condition is 80% DOD; FAQ 2 says
"80–100% usable depth of discharge"; FAQ 3's own worked example ("300 W …
about 4 hours") only reconciles at ~90% usable and with no inverter loss at
all. One source is not explicitly authoritative over the others.
→ **Business Confirmation Required.** Nothing was changed. The recommender
does not adopt any of the three: it compares the customer's required Ah — which
the existing, unchanged calculator already derates — against the product's
documented rated Ah, which is more conservative than all three figures and can
only ever refuse a match, never manufacture one.

**C-2 — TK-LiFe-6145 title says 61V, its model name and spec table say 60.8V.**
`title: 'Trontek LiEV LiFePO4 EV Battery 61V 45Ah (2.74 kWh)'` against
`modelName: 'TK-LiFe-6145 (60.8V / 45Ah)'` and `Nominal voltage: 60.8 V`.
The specification table is the electrical source, so `facets.voltage` is 60.8.
→ **Business Confirmation Required** for the title copy. No electrical impact:
neither 61 nor 60.8 is a home system voltage.

**C-3 — `48VV`, `60VV`, `72VV` in the six EV compatibility rows.** Transcribed
verbatim from the source documents. → **Business Confirmation Required** (copy
fix in the admin console). No electrical impact.

**C-4 — TK-LiFe-6145 "CAN resistance < 60 kΩ" vs TK-LiFe-7332's differing
unit.** Already flagged in the seed comments. → **Business Confirmation
Required.** Not read by the recommender.

**C-5 — no product states a surge/peak rating for home backup.** The two
Powercubes document continuous discharge only. → the recommender checks
continuous power; the UI makes no surge claim.

## Electrical assumptions audit

Every constant in `src/lib/sizing/calculator.ts`, checked against the four
sources above.

| Constant | Value | Documented anywhere? | Action |
|---|---|---|---|
| `POWER_FACTOR` | 0.8 | No. No source document mentions inverter power factor; we stock no inverters. | **Unchanged.** Business Confirmation Required. |
| `EFFICIENCY` | 0.85 | No. The Powercube documents state the *battery's* "Ah efficiency >95%", which is a different quantity. FAQ 3's worked example implies no inverter derate at all. | **Unchanged.** Business Confirmation Required. |
| `DEPTH_OF_DISCHARGE` | 0.6 | No, and it conflicts with C-1 in the conservative direction. | **Unchanged.** Business Confirmation Required. |
| `HEADROOM` | 1.2 | No. | **Unchanged.** Business Confirmation Required. |
| Diversity factor | not implemented | No source. | **Not introduced.** |
| Surge handling | largest single surge delta, displayed only | No product surge rating exists (C-5). | **Unchanged**, and the UI copy corrected to stop implying a check. |
| Voltage thresholds | `requiredVa > 3000 → 48V`, `> 1800 → 24V`, else 12V | No source. | **Unchanged.** Business Confirmation Required. |
| Appliance wattages / surge multipliers | 17 entries | No source; described in code as "typical figures for Indian households". | **Unchanged.** Business Confirmation Required. |
| Backup-duration calculation | `Ah = W·h / (V · eff · DoD)` | Formula is standard; its three inputs are the unconfirmed constants above. | **Unchanged.** |
| Nominal → system voltage map | 12/12.8 → 12, 24/25.6 → 24, 48/51.2 → 48 | **Yes** — the "Number of batteries" and "Inverter compatibility" rows above. | Kept, fails closed. |
| Battery usable energy = V × Ah | — | **Yes** — reproduces both documented `Energy` rows exactly. | Used. |
| Max continuous discharge power = A × nominal V | — | **Yes** — from the "Max. discharge current" row. | Used. |

Two derived values were **added** to the calculator, both from the existing
unchanged constants — no new number was invented:

- `loadEnergyWh` = running watts × hours. A plain product of the shopper's own
  inputs, no assumption at all.
- `requiredDcWatts` = running watts ÷ `EFFICIENCY`. Reuses the existing
  constant so the recommender's power check has a single source for it.

## EV pack selector (Step 9) — deferred, with the reason

The repository has, for all six packs: voltage, Ah, energy, charge profile,
continuous and peak discharge, connector type and pin map, dimensions, weight
and the full BMS protection table. That is enough to *describe* a pack.

It is **not** enough to *select* one, because the one input a selector needs is
absent: there is no vehicle or model compatibility list anywhere in the
repository. Every EV document states compatibility as a controller requirement
and then explicitly defers: *"Any 48VV-system electric scooter or motorcycle
whose controller accepts a 51V nominal LFP pack with a 57.6V charge voltage and
44.8V cut-off. **Confirm connector type … and charger rating with iTarang
before purchase**; controller and charger must match."* Three of the six also
require a specific connector (Chogori 6-pin, PG-7 glands, front-mounted) with
no mapping from any vehicle to any of them.

A selector built on this would have to guess which vehicles run at 48 V, 60 V
or 72 V and which connector each uses. That is exactly the class of guess this
phase exists to remove, so **the EV selector is not implemented in P1-B-2** and
is recorded as a future item. What it needs first: a vehicle → system voltage →
connector compatibility table, business-confirmed.
