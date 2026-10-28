"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  MessageSquare,
  Bath,
  BatteryCharging,
  BedDouble,
  Briefcase,
  Building,
  Building2,
  Castle,
  Check,
  Clock,
  CookingPot,
  Copy,
  Gauge,
  House,
  Info,
  Lightbulb,
  Minus,
  Plus,
  Refrigerator,
  RotateCcw,
  SlidersHorizontal,
  Sofa,
  Tv,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { SizingRecommendation } from "@/app/api/sizing/route";
import {
  APPLIANCES,
  APPLIANCE_GROUPS,
  DIVERSITY_OPTIONS,
  HOME_PRESETS,
  MAX_CUSTOM_APPLIANCES,
  ROOMS,
  SIZING_ASSUMPTIONS,
  appliancesForRoom,
  calculateSizing,
  decodeSelection,
  encodeSelection,
  type Appliance,
  type ApplianceGroup,
  type CustomAppliance,
  type HomePreset,
  type RoomId,
  type Selection,
} from "@/lib/sizing/calculator";
import { summaryToCartItem, useCart } from "@/lib/store/hooks";
import { formatPrice } from "@/lib/catalog/pricing";
import { useUI } from "@/lib/store/ui-provider";
import { Button, ButtonLink } from "@/components/ui/button";
import { ProductCard } from "@/components/product/product-card";
import { PurchaseButton } from "@/components/product/purchase-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/** Digits only, for the custom-appliance wattage field. */
const NON_DIGITS = /[^0-9]/g;

/** Presentation only: one icon per property type, smallest home first. */
const PRESET_ICONS: Record<HomePreset["id"], LucideIcon> = {
  "1bhk": House,
  "2bhk": Building,
  "3bhk": Building2,
  "4bhk": Building2,
  villa: Castle,
};

const ROOM_ICONS: Record<RoomId, LucideIcon> = {
  bedroom: BedDouble,
  living: Sofa,
  kitchen: CookingPot,
  bathroom: Bath,
  study: Briefcase,
};

const GROUP_ICONS: Record<ApplianceGroup, LucideIcon> = {
  "Lighting & fans": Lightbulb,
  "Entertainment & work": Tv,
  Kitchen: Refrigerator,
  "Heavy loads": Zap,
};

/** Running watts for each preset, computed once, for the card subtitle. */
const PRESET_WATTS: Record<HomePreset["id"], number> = Object.fromEntries(
  HOME_PRESETS.map((preset) => [
    preset.id,
    calculateSizing(preset.selection, preset.hours).runningWatts,
  ]),
) as Record<HomePreset["id"], number>;

const MIN_HOURS = 1;
const MAX_HOURS = 12;

/**
 * Arrow-key handling for a WAI-ARIA radio group or tab list.
 *
 * Moves focus to the previous / next item (wrapping) and selects it, which is
 * what both patterns specify. The items are found from the DOM rather than
 * held in refs so the same helper serves the three groups on this screen.
 */
function onRovingKeyDown(
  event: React.KeyboardEvent<HTMLElement>,
  role: "radio" | "tab",
  select: (index: number) => void,
) {
  const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
  const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
  const home = event.key === "Home";
  const end = event.key === "End";
  if (!forward && !back && !home && !end) return;

  const container = event.currentTarget.closest(
    role === "radio" ? '[role="radiogroup"]' : '[role="tablist"]',
  );
  if (!container) return;
  const items = Array.from(
    container.querySelectorAll<HTMLElement>(`[role="${role}"]`),
  );
  const current = items.indexOf(event.currentTarget);
  if (current < 0) return;

  event.preventDefault();
  const next = home
    ? 0
    : end
      ? items.length - 1
      : (current + (forward ? 1 : -1) + items.length) % items.length;
  items[next]?.focus();
  select(next);
}

/** "0.37 kWh", "2.6 kWh", "14 kWh". */
function formatKwh(wh: number): string {
  const kwh = wh / 1000;
  if (kwh >= 10) return `${Math.round(kwh)} kWh`;
  if (kwh >= 1) return `${kwh.toFixed(1)} kWh`;
  return `${kwh.toFixed(2)} kWh`;
}

/**
 * "inverters", "inverters and combos", "inverters, combos and batteries".
 *
 * Plural nouns because the sentence is about what the shop stocks, not about
 * one product.
 */
function describeFamilies(
  families: SizingRecommendation["unavailableFamilies"],
): string {
  const names: Record<
    SizingRecommendation["unavailableFamilies"][number],
    string
  > = {
    inverter: "inverters",
    battery: "home-backup batteries",
    combo: "inverter and battery combos",
  };
  const list = families.map((family) => names[family]);
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

/**
 * Presentation-only props, added so the same calculator can be mounted on a
 * product page. None reaches the arithmetic in `lib/sizing/calculator.ts` or
 * the barriers in `lib/sizing/recommend.ts` — the request sent to
 * `/api/sizing` is byte-for-byte the one the standalone tool sends.
 */
export interface LoadCalculatorProps {
  /**
   * Whether to mirror the working into the address bar.
   *
   * True on `/tools/load-calculator`, where a shareable URL is the point.
   * False on a product page, where the effect would rewrite the address to
   * `/tools/load-calculator` and silently move the shopper off the product
   * they are reading.
   */
  syncUrl?: boolean;
  /**
   * The product whose page this is mounted on, when it is on one.
   *
   * Used for a single line of copy: whether the recommendation the engine
   * returned happens to be this product. It is never sent to the API and never
   * influences the result — a product page cannot nominate itself.
   */
  currentProductId?: string;
  /**
   * The running-total bar pinned to the bottom of a phone screen.
   *
   * Defaults to `syncUrl`: on for the standalone tool, off when embedded on a
   * product page, whose own sticky buy bar already occupies that strip.
   */
  stickySummary?: boolean;
}

/**
 * The home load calculator, in Livguard's order:
 *
 *   1. property type (1–4 BHK, Villa, Custom) pre-fills a typical list;
 *   2. adjust appliances, by device or by room, with −/+ steppers;
 *   3. hours of backup;
 *   4. average consumption (100% / 50% / 20%);
 *   → "Let's plan" shows the sizing and the recommendation.
 *
 * The running total is always visible: in the side panel on desktop and in a
 * bar pinned to the bottom of the screen on a phone.
 *
 * Everything the shopper chose is mirrored into the URL (`load`, `hours`,
 * `use`, `custom` — see `encodeSelection`), and a link that arrives already
 * carrying a load, such as the "size it for a 2 BHK" links on the home page,
 * opens straight on the plan.
 */
export function LoadCalculator({
  syncUrl = true,
  currentProductId,
  stickySummary = syncUrl,
}: LoadCalculatorProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cart = useCart();
  const { toast, open } = useUI();
  const id = React.useId();

  const initial = React.useMemo(
    () =>
      decodeSelection(
        searchParams.get("load") ?? undefined,
        searchParams.get("hours") ?? undefined,
        {
          use: searchParams.get("use") ?? undefined,
          custom: searchParams.get("custom") ?? undefined,
        },
      ),
    // Read once on mount; later changes are driven by the controls below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [selection, setSelection] = React.useState<Selection>(
    initial.selection,
  );
  const [backupHours, setBackupHours] = React.useState(initial.backupHours);
  const [diversity, setDiversity] = React.useState(initial.diversity);
  const [custom, setCustom] = React.useState<CustomAppliance[]>(initial.custom);
  /** Which way into the appliance list: straight at the devices, or by room. */
  const [mode, setMode] = React.useState<"devices" | "rooms">("devices");
  /** The shopper chose "Custom" explicitly — starting from an empty list. */
  const [customChosen, setCustomChosen] = React.useState(false);
  /**
   * Whether "Let's plan" has been pressed.
   *
   * A link that already carries a load is a link to a plan, so it opens with
   * the results showing. Once planned, the results stay and follow every edit.
   */
  const [planned, setPlanned] = React.useState(
    Object.keys(initial.selection).length > 0 || initial.custom.length > 0,
  );
  const [scrollNonce, setScrollNonce] = React.useState(0);
  const [recommendation, setRecommendation] =
    React.useState<SizingRecommendation | null>(null);
  const [loading, setLoading] = React.useState(false);
  const resultRef = React.useRef<HTMLElement>(null);
  const listRef = React.useRef<HTMLElement>(null);

  const sizing = React.useMemo(
    () => calculateSizing(selection, backupHours, { diversity, custom }),
    [selection, backupHours, diversity, custom],
  );

  const hasLoad = sizing.runningWatts > 0;
  const showResults = planned && hasLoad;

  // Keep the URL in step with the working, so a result can be shared or
  // bookmarked. Skipped when the calculator is embedded: on a product page this
  // would replace the address with `/tools/load-calculator` on the first click.
  React.useEffect(() => {
    if (!syncUrl) return;
    const qs = encodeSelection(selection, backupHours, { diversity, custom });
    router.replace(
      qs ? `/tools/load-calculator?${qs}` : "/tools/load-calculator",
      {
        scroll: false,
      },
    );
  }, [selection, backupHours, diversity, custom, router, syncUrl]);

  // Only asks the server once there is a plan to show.
  React.useEffect(() => {
    if (!showResults) {
      setRecommendation(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      /**
       * Four numbers, all of them load-bearing.
       *
       * `v` decides which products are electrically compatible — capacity alone
       * cannot tell a 12V home battery from a 51V traction pack, which is how a
       * 51V e-scooter pack once came to be offered for a home battery. `w` is
       * what each product's documented maximum discharge current is checked
       * against. Without either, the route withholds a recommendation rather
       * than falling back to matching on Ah.
       */
      const query = new URLSearchParams({
        va: String(sizing.requiredVa),
        ah: String(sizing.requiredAh),
        v: String(sizing.systemVoltage),
        w: String(sizing.runningWatts),
        h: String(sizing.backupHours),
      });
      fetch(`/api/sizing?${query}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data: SizingRecommendation) => setRecommendation(data))
        .catch(() => setRecommendation(null))
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    showResults,
    sizing.requiredVa,
    sizing.requiredAh,
    sizing.systemVoltage,
    sizing.runningWatts,
    sizing.backupHours,
  ]);

  // Scrolls to the results after "Let's plan" has rendered them.
  React.useEffect(() => {
    if (scrollNonce === 0) return;
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    resultRef.current?.focus({ preventScroll: true });
  }, [scrollNonce]);

  const setQuantity = (applianceId: string, quantity: number) =>
    setSelection((current) => {
      const next = { ...current };
      if (quantity <= 0) delete next[applianceId];
      else next[applianceId] = Math.min(50, quantity);
      return next;
    });

  const applyPreset = (preset: HomePreset) => {
    setSelection(preset.selection);
    // Starting again from a property type means starting again: a custom
    // appliance left over from a previous attempt would be silently added to a
    // preset that says nothing about it.
    setCustom([]);
    setBackupHours(preset.hours);
    setCustomChosen(false);
  };

  /**
   * Which property type is currently showing, if any.
   *
   * **Derived, not stored.** Remembering which button was pressed would leave
   * "3 BHK" highlighted after the shopper had added an air conditioner and two
   * more fans, which is a claim about their home that the screen can no longer
   * support. Comparing the actual selection means the highlight is true by
   * construction: it lights up when a preset is applied and goes out the moment
   * the working diverges from it — at which point "Custom" lights up instead.
   */
  const activePreset = React.useMemo(() => {
    if (custom.length > 0) return null;
    const ids = Object.keys(selection);
    if (ids.length === 0) return null;

    return (
      HOME_PRESETS.find((preset) => {
        const keys = Object.keys(preset.selection);
        return (
          keys.length === ids.length &&
          keys.every((key) => preset.selection[key] === selection[key])
        );
      })?.id ?? null
    );
  }, [selection, custom]);

  const isCustom =
    activePreset === null &&
    (customChosen || Object.keys(selection).length > 0 || custom.length > 0);

  const chooseCustom = () => {
    // From a preset, "Custom" means a blank list to build up. When the list is
    // already the shopper's own, pressing it again must not throw that away.
    if (!isCustom) {
      setSelection({});
      setCustom([]);
    }
    setCustomChosen(true);
  };

  /** How many appliances are switched on, for the summary line. */
  const deviceCount =
    Object.values(selection).reduce((sum, quantity) => sum + quantity, 0) +
    custom.reduce((sum, entry) => sum + entry.quantity, 0);

  const clampHours = (value: number) =>
    Math.min(MAX_HOURS, Math.max(MIN_HOURS, value));

  const plan = () => {
    if (!hasLoad) {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setPlanned(true);
    setScrollNonce((n) => n + 1);
  };

  const reset = () => {
    setSelection({});
    setCustom([]);
    setCustomChosen(false);
    setPlanned(false);
  };

  const presetItems: Array<{ key: string; select: () => void }> = [
    ...HOME_PRESETS.map((preset) => ({
      key: preset.id,
      select: () => applyPreset(preset),
    })),
    { key: "custom", select: chooseCustom },
  ];
  const checkedPresetKey = activePreset ?? (isCustom ? "custom" : null);

  const tabs = [
    ["devices", "Select by devices"],
    ["rooms", "Select by rooms"],
  ] as const;

  const deviceSummary =
    deviceCount === 0
      ? "Nothing selected yet"
      : `${deviceCount} appliance${deviceCount === 1 ? "" : "s"} on backup`;

  return (
    <div>
      {/* The inputs. Wrapped on their own so the phone summary bar below can
          stick to the bottom of the screen while the shopper is choosing, and
          let go once they scroll on to the plan. */}
      <div>
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="min-w-0 lg:col-span-7">
            {/* Step 1 — property type */}
            <section aria-labelledby={`${id}-type`}>
              <StepHeading id={`${id}-type`} step={1}>
                Choose your property type
              </StepHeading>
              <p className="mt-1.5 text-sm text-muted-foreground">
                We fill in what a typical home of that size keeps on backup.
                Change anything you like — it is a starting point, not a guess
                about your home.
              </p>
              {/* A radio group: exactly one answer to "what kind of home is
                  this", announced as such. The selected card is filled, not
                  merely outlined — a tint on a white card is easy to miss on a
                  phone in daylight. */}
              <div
                role="radiogroup"
                aria-labelledby={`${id}-type`}
                className="mt-3 grid grid-cols-3 gap-2 sm:gap-3 xl:grid-cols-6"
              >
                {presetItems.map((item, index) => {
                  const preset = HOME_PRESETS.find((p) => p.id === item.key);
                  const Icon = preset
                    ? PRESET_ICONS[preset.id]
                    : SlidersHorizontal;
                  const checked = checkedPresetKey === item.key;
                  const focusable =
                    checked || (checkedPresetKey === null && index === 0);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      tabIndex={focusable ? 0 : -1}
                      onClick={item.select}
                      onKeyDown={(event) =>
                        onRovingKeyDown(event, "radio", (next) =>
                          presetItems[next]?.select(),
                        )
                      }
                      className={cn(
                        "group flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:py-4",
                        checked
                          ? "border-accent bg-accent text-accent-foreground shadow-card"
                          : "border-border bg-card hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-card",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-10 w-10 place-items-center rounded-full transition-colors",
                          checked
                            ? "bg-accent-foreground/20"
                            : "bg-accent-50 text-accent-600 group-hover:bg-accent/15",
                        )}
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="text-sm font-semibold leading-tight">
                        {preset ? preset.label : "Custom"}
                      </span>
                      <span
                        className={cn(
                          "tabular text-2xs leading-tight",
                          checked
                            ? "text-accent-foreground/80"
                            : "text-muted-foreground",
                        )}
                      >
                        {preset
                          ? `~${PRESET_WATTS[preset.id]} W`
                          : "Build your own"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p
                className="mt-2 text-xs text-muted-foreground"
                aria-live="polite"
              >
                {activePreset
                  ? `${HOME_PRESETS.find((p) => p.id === activePreset)?.label}: ${
                      HOME_PRESETS.find((p) => p.id === activePreset)
                        ?.description
                    }.`
                  : isCustom
                    ? "Your own list — add appliances below."
                    : "Household appliances only. This tool sizes home backup, not electric-vehicle batteries."}
              </p>
            </section>

            {/* Step 2 — appliances */}
            <section
              ref={listRef}
              aria-labelledby={`${id}-list`}
              className="mt-8 scroll-mt-24"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <StepHeading id={`${id}-list`} step={2}>
                  Adjust your appliances
                </StepHeading>
                {Object.keys(selection).length > 0 || custom.length > 0 ? (
                  <Button variant="ghost" size="sm" onClick={reset}>
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                ) : null}
              </div>

              {/* Two ways into one list. Choosing in a room changes the same
                  `selection`, so the paths cannot disagree about the arithmetic
                  and a shopper can start in one and finish in the other. */}
              <div
                role="tablist"
                aria-label="How to choose appliances"
                className="mt-3 grid grid-cols-2 rounded-lg border border-border bg-surface p-1 sm:inline-grid"
              >
                {tabs.map(([tabId, label]) => (
                  <button
                    key={tabId}
                    id={`${id}-tab-${tabId}`}
                    role="tab"
                    type="button"
                    aria-selected={mode === tabId}
                    aria-controls={`${id}-panel`}
                    tabIndex={mode === tabId ? 0 : -1}
                    onClick={() => setMode(tabId)}
                    onKeyDown={(event) =>
                      onRovingKeyDown(event, "tab", (next) =>
                        setMode(tabs[next]?.[0] ?? tabId),
                      )
                    }
                    className={cn(
                      "rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      mode === tabId
                        ? "bg-accent text-accent-foreground shadow-card"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div
                id={`${id}-panel`}
                role="tabpanel"
                aria-labelledby={`${id}-tab-${mode}`}
                className="mt-4 space-y-6"
              >
                {mode === "rooms" ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Counts are for the whole home: an appliance that belongs
                      in several rooms (fans, lights, chargers) shows the same
                      total in each of them.
                    </p>
                    {ROOMS.map((room) => (
                      <ApplianceList
                        key={room.id}
                        title={room.name}
                        icon={ROOM_ICONS[room.id]}
                        appliances={appliancesForRoom(room.id)}
                        selection={selection}
                        onChange={setQuantity}
                      />
                    ))}
                  </>
                ) : (
                  APPLIANCE_GROUPS.map((group) => (
                    <ApplianceList
                      key={group}
                      title={group}
                      icon={GROUP_ICONS[group]}
                      appliances={APPLIANCES.filter((a) => a.group === group)}
                      selection={selection}
                      onChange={setQuantity}
                    />
                  ))
                )}
              </div>

              {/* Anything the list does not cover. The wattage is the shopper's,
                  because we do not know their appliance and will not invent a
                  rating for it. */}
              <CustomAppliances custom={custom} onChange={setCustom} />
            </section>
          </div>

          {/* Side panel — the live total, backup hours, average consumption and
              the button. Sticky on desktop so the total stays beside whichever
              row is being changed. */}
          <aside className="lg:col-span-5" aria-label="Your load">
            <div className="space-y-4 lg:sticky lg:top-24">
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
                {/* The number the shopper is adding up in their head, printed
                    once and large. */}
                <div className="bg-primary px-5 py-4 text-primary-foreground">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary-foreground/75">
                    Total connected load
                  </p>
                  <p
                    className="mt-1 flex items-baseline gap-1.5"
                    aria-live="polite"
                  >
                    <span className="tabular font-display text-4xl font-bold">
                      {sizing.runningWatts}
                    </span>
                    <span className="text-lg font-semibold">Watts</span>
                  </p>
                  <p className="mt-0.5 text-xs text-primary-foreground/75">
                    {deviceSummary}
                  </p>
                </div>

                <div className="space-y-6 p-5">
                  {/* Step 3 — hours */}
                  <section aria-labelledby={`${id}-hours`}>
                    <StepHeading id={`${id}-hours`} step={3} small>
                      Hours of backup needed
                    </StepHeading>
                    {/* A stepper rather than a bare slider. Backup hours is a
                        small whole number a shopper has an opinion about, and
                        on a phone a twelve-stop slider is a guess. */}
                    <div className="mt-3 flex items-center gap-3">
                      <Stepper
                        value={backupHours}
                        min={MIN_HOURS}
                        max={MAX_HOURS}
                        onChange={(value) => setBackupHours(clampHours(value))}
                        decreaseLabel="One hour less of backup"
                        increaseLabel="One hour more of backup"
                        groupLabel="Hours of backup"
                        large
                      />
                      <span className="text-sm text-card-foreground">
                        {backupHours === 1 ? "hour" : "hours"} per power cut
                      </span>
                      <Clock
                        className="ml-auto h-5 w-5 text-muted-foreground"
                        aria-hidden
                      />
                    </div>
                    <input
                      type="range"
                      min={MIN_HOURS}
                      max={MAX_HOURS}
                      step={1}
                      value={backupHours}
                      onChange={(e) =>
                        setBackupHours(clampHours(Number(e.target.value)))
                      }
                      aria-label="Backup hours"
                      className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-[hsl(var(--accent))]"
                    />
                  </section>

                  {/* Step 4 — average consumption. Reduces the battery, never
                      the inverter — see `DIVERSITY_OPTIONS`. Defaulted to 100%
                      so the shopper opts in to the assumption. */}
                  <section aria-labelledby={`${id}-use`}>
                    <StepHeading id={`${id}-use`} step={4} small>
                      Average consumption
                    </StepHeading>
                    <p className="mt-1 text-xs text-muted-foreground">
                      How much of that load is actually running at any one time?
                    </p>
                    <div
                      role="radiogroup"
                      aria-labelledby={`${id}-use`}
                      className="mt-2 grid grid-cols-3 gap-1 rounded-lg border border-input bg-surface p-1"
                    >
                      {DIVERSITY_OPTIONS.map((option) => {
                        const checked = diversity === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            tabIndex={checked ? 0 : -1}
                            onClick={() => setDiversity(option.value)}
                            onKeyDown={(event) =>
                              onRovingKeyDown(event, "radio", (next) =>
                                setDiversity(
                                  DIVERSITY_OPTIONS[next]?.value ??
                                    option.value,
                                ),
                              )
                            }
                            title={option.description}
                            className={cn(
                              "rounded-md px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              checked
                                ? "bg-accent text-accent-foreground shadow-card"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {
                        DIVERSITY_OPTIONS.find(
                          (option) => option.value === diversity,
                        )?.description
                      }
                      {diversity < 1
                        ? " — this lowers the battery size, not the inverter. If more does run together, the backup lasts proportionally less."
                        : "."}
                    </p>
                  </section>

                  <Button
                    variant="accent"
                    size="lg"
                    fullWidth
                    onClick={plan}
                    aria-describedby={hasLoad ? undefined : `${id}-plan-hint`}
                  >
                    {planned && hasLoad ? "Update my plan" : "Let's plan"}
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                  {!hasLoad ? (
                    <p
                      id={`${id}-plan-hint`}
                      className="-mt-3 text-center text-xs text-muted-foreground"
                    >
                      Pick a property type or add an appliance first.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Phone summary bar. Sits above the site's bottom navigation, sticks
            while the inputs are on screen and lets go at the end of them. */}
        {stickySummary ? (
          <div className="sticky bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px))] z-30 -mx-4 mt-6 border-t border-border bg-card/95 px-4 py-3 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.2)] backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="tabular font-display text-xl font-bold leading-tight text-foreground">
                  {sizing.runningWatts} W
                  <span className="ml-1.5 text-xs font-medium text-muted-foreground">
                    · {backupHours} h · {Math.round(diversity * 100)}% use
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {deviceSummary}
                </p>
              </div>
              <Button
                variant="accent"
                onClick={plan}
                disabled={!hasLoad}
                className="shrink-0"
              >
                {planned && hasLoad ? "View plan" : "Let's plan"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* The plan */}
      {showResults ? (
        <section
          ref={resultRef}
          tabIndex={-1}
          aria-labelledby={`${id}-plan`}
          className="mt-10 scroll-mt-24 border-t border-border pt-8 outline-none lg:mt-12"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Your backup plan</p>
              <h2 id={`${id}-plan`} className="heading-2 mt-1">
                {sizing.runningWatts} W for {sizing.backupHours}{" "}
                {sizing.backupHours === 1 ? "hour" : "hours"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {deviceSummary}
                {diversity < 1
                  ? `, about ${Math.round(diversity * 100)}% running at once`
                  : ""}
                .
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const url = `${window.location.origin}/tools/load-calculator?${encodeSelection(
                  selection,
                  backupHours,
                  { diversity, custom },
                )}`;
                navigator.clipboard?.writeText(url).then(
                  () =>
                    toast({
                      title: "Link copied",
                      description: url,
                      tone: "success",
                    }),
                  () =>
                    toast({ title: "Could not copy the link", tone: "error" }),
                );
              }}
            >
              <Copy className="h-4 w-4" />
              Copy a link to this plan
            </Button>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              icon={<BatteryCharging className="h-4 w-4" />}
              label="Battery needed"
              value={`${sizing.requiredAh} Ah`}
              hint={`at ${sizing.systemVoltage} V · ≈ ${formatKwh(
                sizing.requiredAh * sizing.systemVoltage,
              )} nominal`}
              highlight
            />
            <Stat
              icon={<Gauge className="h-4 w-4" />}
              label="System voltage"
              value={`${sizing.systemVoltage} V`}
              hint={`${sizing.requiredVa} VA inverter or larger`}
              highlight
            />
            <Stat
              icon={<Info className="h-4 w-4" />}
              label="Energy needed"
              // Running watts × hours × average consumption — the shopper's own
              // inputs multiplied, no efficiency or depth of discharge.
              value={formatKwh(sizing.loadEnergyWh)}
              hint={`${sizing.loadEnergyWh} Wh over ${sizing.backupHours} h`}
            />
            <Stat
              icon={<Zap className="h-4 w-4" />}
              label="Running load"
              value={`${sizing.runningWatts} W`}
              // Shown for information. No product in the catalogue states a
              // surge rating, so this figure is not part of any sizing check.
              hint={`momentary peak ~${sizing.peakWatts} W`}
            />
          </dl>

          <div className="mt-6 grid gap-6 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-7">
              {loading || !recommendation ? (
                <div className="space-y-3">
                  <Skeleton className="h-48 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : (recommendation.status === "matched" ||
                  recommendation.status === "nearest") &&
                recommendation.battery ? (
                /*
                  One branch per outcome the route distinguishes, because the
                  distinction is the point. Telling somebody their two-fan load
                  is unusual when the truth is that we have not priced the
                  product is a false statement about their home.
                */
                <div className="space-y-4">
                  <div
                    className={cn(
                      "rounded-xl border-2 bg-card p-4 sm:p-5",
                      recommendation.status === "nearest"
                        ? "border-warning/60"
                        : "border-accent",
                    )}
                  >
                    {recommendation.status === "nearest" ? (
                      <p className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-2xs font-bold uppercase tracking-wide text-warning">
                        <Info className="h-3 w-3" />
                        Nearest option
                      </p>
                    ) : (
                      <p className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-2xs font-bold uppercase tracking-wide text-accent-foreground">
                        <Check className="h-3 w-3" />
                        Recommended
                      </p>
                    )}
                    {/* The headline the shopper buys: N × product, combined
                        price, and how much of their window it covers (R-06). */}
                    <p className="mt-3 font-display text-base font-bold text-foreground">
                      {recommendation.battery.units > 1
                        ? `${recommendation.battery.units} × `
                        : ""}
                      {recommendation.battery.product.title}
                      <span className="tabular ml-2 text-sm font-semibold text-muted-foreground">
                        {formatPrice(
                          recommendation.battery.product.price *
                            recommendation.battery.units,
                        )}
                      </span>
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-sm",
                        recommendation.status === "nearest"
                          ? "font-semibold text-warning"
                          : "text-muted-foreground",
                      )}
                    >
                      {recommendation.status === "nearest"
                        ? `Covers about ${recommendation.coversHours} of your ${sizing.backupHours} hours of backup at this load. Nothing in our range covers all of it.`
                        : `Covers your ${sizing.backupHours} hours of backup.`}
                    </p>
                    {recommendation.inverterNote ? (
                      <p className="mt-2 rounded-md border border-border bg-surface p-2.5 text-xs text-foreground">
                        {recommendation.inverterNote}
                      </p>
                    ) : null}
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <ProductCard product={recommendation.battery.product} />
                      <div>
                        {/* Said only when it is true, and only ever after the
                            fact. `currentProductId` is not sent to the API and
                            cannot influence what comes back. */}
                        {currentProductId &&
                        recommendation.battery.product.id ===
                          currentProductId ? (
                          <p className="mb-2 flex items-start gap-1.5 text-xs font-semibold text-success">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            That is the product you are looking at.
                          </p>
                        ) : null}
                        {/* The bank, when the load needs more than one pack.
                            Batteries in parallel add capacity at an unchanged
                            voltage. */}
                        {recommendation.battery.units > 1 ? (
                          <p className="mb-3 rounded-md bg-accent-50 p-2.5 text-xs font-semibold text-foreground">
                            {recommendation.battery.units} of these, wired in
                            parallel at{" "}
                            {recommendation.systemVoltage ?? sizing.systemVoltage} V.
                          </p>
                        ) : null}
                        <p className="tabular text-xs font-medium text-foreground">
                          {recommendation.battery.capacityLabel}
                          {recommendation.battery.units > 1
                            ? ` · ${recommendation.battery.units} required`
                            : ""}
                        </p>
                        <h3 className="mt-3 font-display text-sm font-semibold text-card-foreground">
                          Why this one
                        </h3>
                        <ul className="mt-2 space-y-1.5">
                          {/* Every line is a statement the product itself
                              makes, built by the engine from the catalogue row. */}
                          {recommendation.battery.reasons.map((reason) => (
                            <li
                              key={reason}
                              className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground"
                            >
                              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                        {/* Purchase is switched off site-wide; the button
                            stays, disabled. See lib/commerce/purchase.ts. */}
                        <PurchaseButton
                          variant="accent"
                          fullWidth
                          className="mt-4"
                          onClick={() => {
                            // The whole bank, so what lands in the cart is what
                            // the recommendation actually said.
                            const units = recommendation.battery!.units;
                            const item = summaryToCartItem(
                              recommendation.battery!.product,
                              units,
                            );
                            cart.addItem(item);
                            toast({
                              title:
                                units > 1
                                  ? `${units} added to cart`
                                  : "Added to cart",
                              description:
                                recommendation.battery!.product.title,
                              tone: "success",
                              action: {
                                label: "View cart",
                                onClick: () => open("cart"),
                              },
                            });
                          }}
                        >
                          {recommendation.battery.units > 1
                            ? `Add all ${recommendation.battery.units} to cart`
                            : "Add this battery to cart"}
                        </PurchaseButton>
                        <ButtonLink
                          href={enquiryHref(
                            recommendation.battery.product.title,
                            sizing,
                          )}
                          variant="outline"
                          fullWidth
                          className="mt-2"
                        >
                          <MessageSquare className="h-4 w-4" />
                          Send an enquiry
                        </ButtonLink>
                      </div>
                    </div>
                  </div>

                  {recommendation.alternatives.length > 0 ? (
                    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
                      <h3 className="font-display text-sm font-semibold text-card-foreground">
                        Also compatible
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Shown only where the product satisfies the same
                        documented requirements. The recommendation above is the
                        smallest that does.
                      </p>
                      <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                        {recommendation.alternatives.map((alternative) => (
                          <li key={alternative.product.id}>
                            <ProductCard product={alternative.product} />
                            <p className="mt-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">
                                Not selected:
                              </span>{" "}
                              {alternative.whyNotSelected}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : (
                <NoMatch
                  status={recommendation.status}
                  unavailableMatch={recommendation.unavailableMatch}
                  requiredAh={sizing.requiredAh}
                  requiredDcWatts={sizing.requiredDcWatts}
                  systemVoltage={sizing.systemVoltage}
                  enquiry={enquiryHref(undefined, sizing)}
                />
              )}
            </div>

            <div className="space-y-4 lg:col-span-5">
              {/* The rest of the system, where the catalogue holds it. */}
              {recommendation &&
              (recommendation.combo || recommendation.inverter) ? (
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="font-display text-sm font-semibold text-card-foreground">
                    For the rest of the system
                  </h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {recommendation.combo ? (
                      <ProductCard product={recommendation.combo} />
                    ) : null}
                    {recommendation.inverter ? (
                      <ProductCard product={recommendation.inverter} />
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* The inverter half of the system, stated as a specification
                  rather than omitted. We stock no inverters, so there is no
                  product to show — but the VA figure and the battery input
                  voltage are things a shopper can take to a supplier, and both
                  come from their own load. */}
              {recommendation && !recommendation.inverter ? (
                <div className="rounded-xl border border-border bg-surface p-4">
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    The inverter you would pair with it
                  </h3>
                  <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between gap-3">
                      <dt>Rating</dt>
                      <dd className="tabular font-semibold text-foreground">
                        {sizing.requiredVa} VA or larger
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Battery input</dt>
                      <dd className="tabular font-semibold text-foreground">
                        {recommendation.systemVoltage ?? sizing.systemVoltage} V
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Type</dt>
                      <dd className="font-semibold text-foreground">
                        Pure sine wave, lithium-ready
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Look for &ldquo;lithium-ready&rdquo; on the specification: a
                    LiFePO4 pack needs an inverter with a lithium charging
                    profile.{" "}
                    <span className="font-medium text-foreground">
                      We do not stock inverters today
                    </span>
                    , so this is a specification to buy against rather than a
                    product; our team can source one.
                  </p>
                </div>
              ) : null}

              {/* Which families we stock nothing in at all — named, rather than
                  silently omitted, so a battery-only answer does not read as
                  the whole system. */}
              {recommendation &&
              recommendation.unavailableFamilies.filter(
                (family) => family !== "inverter",
              ).length > 0 ? (
                <p className="rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
                  We are not currently stocking{" "}
                  {describeFamilies(
                    recommendation.unavailableFamilies.filter(
                      (family) => family !== "inverter",
                    ),
                  )}{" "}
                  — our team can source that part.
                </p>
              ) : null}

              <Assumptions />
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** "How this is calculated", kept beside the plan so the number is auditable. */
function Assumptions() {
  return (
    <details className="rounded-lg border border-border bg-surface p-4">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        How this is calculated
      </summary>
      <div className="mt-3 space-y-3 text-xs leading-relaxed text-muted-foreground">
        <p>
          <strong className="text-foreground">Inverter VA</strong> = running
          watts ÷ power factor, with headroom so the unit is not permanently at
          full output.
        </p>
        <p>
          <strong className="text-foreground">Energy</strong> = running watts ×
          hours × average consumption. Average consumption lowers the battery
          only — the inverter is always sized for everything you selected
          running at once.
        </p>
        <p>
          <strong className="text-foreground">Battery Ah</strong> = energy ÷
          (system voltage × efficiency × usable depth of discharge), rounded up
          to the next 5 Ah.
        </p>
        <p>
          {/* Says exactly what happens to the surge figure, and no more. No
              battery in our range publishes a surge or peak discharge rating. */}
          <strong className="text-foreground">Momentary peak</strong> is the
          running load plus the largest single appliance&rsquo;s start-up surge,
          shown for information. It is not used to size the inverter and is not
          checked against a battery, because none of our batteries publishes a
          surge rating.
        </p>
        <p>
          <strong className="text-foreground">The recommendation</strong> is a
          separate step. A battery is only offered when its own published
          specification satisfies the system voltage, the capacity and the
          continuous discharge your load needs, and it is in stock. Where
          nothing does, we say so rather than offer the nearest size.
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-border pt-3">
          {SIZING_ASSUMPTIONS.map((assumption) => (
            <React.Fragment key={assumption.label}>
              <dt>{assumption.label}</dt>
              <dd className="tabular text-right font-medium text-foreground">
                {assumption.value}
              </dd>
            </React.Fragment>
          ))}
        </dl>
        <p>
          Appliance wattages and the four factors above are typical planning
          figures, not product specifications. If your appliance rating plate
          says something different, size against that number and check with our
          engineers.
        </p>
      </div>
    </details>
  );
}

function StepHeading({
  id,
  step,
  small,
  children,
}: {
  id: string;
  step: number;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className={cn(
        "flex items-center",
        small
          ? "font-display text-base font-bold text-card-foreground"
          : "heading-3",
      )}
    >
      <span
        aria-hidden
        className="mr-2 inline-grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-2xs font-bold text-accent-foreground"
      >
        {step}
      </span>
      <span className="sr-only">Step {step}: </span>
      {children}
    </h2>
  );
}

/** A −/+ quantity control with a live value between the buttons. */
function Stepper({
  value,
  min = 0,
  max = 50,
  onChange,
  decreaseLabel,
  increaseLabel,
  groupLabel,
  large,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  groupLabel: string;
  large?: boolean;
}) {
  const size = large ? "h-10 w-10" : "h-9 w-9";
  return (
    <div
      role="group"
      aria-label={groupLabel}
      className="inline-flex shrink-0 items-center rounded-full border border-input bg-card"
    >
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={decreaseLabel}
        className={cn(
          "grid place-items-center rounded-full text-foreground transition-colors hover:bg-secondary disabled:opacity-40",
          size,
        )}
      >
        <Minus className="h-4 w-4" />
      </button>
      <span
        aria-live="polite"
        className={cn(
          "tabular text-center font-semibold text-foreground",
          large ? "w-10 font-display text-lg font-bold" : "w-8 text-sm",
        )}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={increaseLabel}
        className={cn(
          "grid place-items-center rounded-full text-foreground transition-colors hover:bg-secondary disabled:opacity-40",
          size,
        )}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Every outcome that is not a recommendation, said accurately.
 *
 * "No matching battery" and "your load is too high" are different statements
 * about somebody's home, and only one of them is ever true. The route decides
 * which by proving it — a capacity or power comparison actually failed — so
 * this component only has to render the answer it is given, and every branch
 * ends at a human.
 */
function NoMatch({
  status,
  unavailableMatch,
  requiredAh,
  requiredDcWatts,
  systemVoltage,
  enquiry,
}: {
  status: SizingRecommendation["status"];
  unavailableMatch: SizingRecommendation["unavailableMatch"];
  requiredAh: number;
  requiredDcWatts: number;
  systemVoltage: number;
  enquiry: string;
}) {
  const requirement = `Your load needs about ${requiredAh} Ah at a ${systemVoltage}V battery input, delivering around ${requiredDcWatts} W continuously.`;

  const { title, body } =
    status === "not-available" && unavailableMatch
      ? {
          title: `${unavailableMatch.product.title} fits, but is not available right now`,
          body: `${unavailableMatch.capacityLabel}. It satisfies everything your load needs; we simply cannot ship it today.`,
        }
      : status === "information-missing"
        ? {
            title:
              "We want to confirm a specification before recommending anything",
            body: `${requirement} One of our batteries is the right kind of product, but its published specification is missing a figure this check needs, and we would rather confirm it than guess.`,
          }
        : status === "incomplete-request"
          ? {
              title: "We need a little more before we can recommend a battery",
              body: "Choose the appliances you want running and a backup window, and we will check them against what we stock.",
            }
          : {
              title:
                "No matching iTarang battery is currently available for this requirement",
              body: `${requirement} Nothing in our current range satisfies all of that, and we will not offer you a battery that does not.`,
            };

  return (
    <div className="rounded-xl border border-warning/40 bg-warning-soft p-5">
      <p className="flex items-start gap-2 text-sm font-semibold text-foreground">
        <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-warning" />
        {title}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Please contact our support team and we can help you find the right
        solution.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <ButtonLink href={enquiry} variant="primary" size="sm">
          <MessageSquare className="h-4 w-4" />
          Send an enquiry
        </ButtonLink>
        <ButtonLink href="/support" variant="outline" size="sm">
          Talk to our support team
        </ButtonLink>
      </div>
    </div>
  );
}

/** `/support/enquiry`, prefilled with what the calculator showed (R-06). */
function enquiryHref(
  product: string | undefined,
  sizing: {
    runningWatts: number;
    backupHours: number;
    requiredAh: number;
    systemVoltage: number;
  },
): string {
  const query = new URLSearchParams({
    load: `Load calculator: ${sizing.runningWatts} W running for ${sizing.backupHours} h, about ${sizing.requiredAh} Ah at ${sizing.systemVoltage} V.`,
  });
  if (product) query.set("product", product);
  return `/support/enquiry?${query}`;
}

function Stat({
  icon,
  label,
  value,
  hint,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        highlight
          ? "border-accent/40 bg-accent-50"
          : "border-border bg-surface",
      )}
    >
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className={highlight ? "text-accent-600" : "text-muted-foreground"}
        >
          {icon}
        </span>
        {label}
      </dt>
      <dd className="tabular mt-1 font-display text-xl font-bold text-foreground">
        {value}
      </dd>
      {hint ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------- appliance list */

/**
 * One titled block of appliances with quantity steppers.
 *
 * Extracted so the device path and the room path render the identical control
 * over the identical `selection`. Two copies would be two places for the
 * stepper's clamping to drift, and the room path exists precisely so a shopper
 * can switch between them mid-edit without losing anything.
 */
function ApplianceList({
  title,
  icon: Icon,
  appliances,
  selection,
  onChange,
}: {
  title: string;
  icon: LucideIcon;
  appliances: Appliance[];
  selection: Selection;
  onChange: (id: string, quantity: number) => void;
}) {
  if (appliances.length === 0) return null;

  const groupWatts = appliances.reduce(
    (sum, appliance) => sum + appliance.watts * (selection[appliance.id] ?? 0),
    0,
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-accent-600">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-50">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          {title}
        </h3>
        {groupWatts > 0 ? (
          <span className="tabular rounded-full bg-accent-50 px-2 py-0.5 text-xs font-semibold text-foreground">
            {groupWatts} W
          </span>
        ) : null}
      </div>

      {/* Column headings on wider screens, so the rows read as a table. Hidden
          from assistive technology: each row already names its own figures. */}
      <div
        aria-hidden
        className="mt-2.5 hidden grid-cols-[1fr_6.5rem_8rem_5.5rem] gap-3 px-3.5 pb-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid"
      >
        <span>Device</span>
        <span className="text-right">Usage per device</span>
        <span className="text-center">Quantity</span>
        <span className="text-right">Total</span>
      </div>

      <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card sm:mt-0">
        {appliances.map((appliance) => {
          const quantity = selection[appliance.id] ?? 0;
          const active = quantity > 0;
          return (
            <li
              key={appliance.id}
              className={cn(
                "flex items-center gap-3 p-3 transition-colors sm:grid sm:grid-cols-[1fr_6.5rem_8rem_5.5rem] sm:p-3.5",
                // The selected row is tinted and marked down its leading edge.
                // The stripe survives at a glance and on a small screen, where
                // a pale tint on one row of twenty does not.
                active &&
                  "border-l-[3px] border-l-accent bg-accent-50/70 pl-[calc(0.75rem-3px)] sm:pl-[calc(0.875rem-3px)]",
              )}
            >
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm text-foreground",
                    active ? "font-semibold" : "font-medium",
                  )}
                >
                  {appliance.name}
                </p>
                {/* On a phone the wattage and the row total share one line
                    under the name; the columns carry them from `sm` up. */}
                <p className="tabular text-xs text-muted-foreground sm:hidden">
                  {appliance.watts} W each
                  {active ? (
                    <span className="font-semibold text-foreground">
                      {" "}
                      · {appliance.watts * quantity} W
                    </span>
                  ) : null}
                </p>
                {appliance.surge > 1 ? (
                  <p className="tabular hidden text-xs text-muted-foreground sm:block">
                    surges to ~{Math.round(appliance.watts * appliance.surge)} W
                    on start-up
                  </p>
                ) : null}
                {appliance.note && active ? (
                  <p className="mt-1 flex items-start gap-1 text-xs text-warning">
                    <Info className="mt-0.5 h-3 w-3 shrink-0" />
                    {appliance.note}
                  </p>
                ) : null}
              </div>

              <p className="tabular hidden text-right text-sm text-muted-foreground sm:block">
                {appliance.watts} W
              </p>

              <div className="flex shrink-0 justify-end sm:justify-center">
                <Stepper
                  value={quantity}
                  min={0}
                  max={50}
                  onChange={(next) => onChange(appliance.id, next)}
                  decreaseLabel={`Remove one ${appliance.name}`}
                  increaseLabel={`Add one ${appliance.name}`}
                  groupLabel={`${appliance.name} quantity`}
                />
              </div>

              <p
                className={cn(
                  "tabular hidden text-right text-sm sm:block",
                  active
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {active ? `${appliance.watts * quantity} W` : "—"}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------ custom appliances */

/**
 * Appliances the shopper describes themselves.
 *
 * The wattage is theirs. Nothing here suggests a figure, because an appliance
 * we have never listed has no typical rating we could honestly offer — and a
 * guessed number would flow straight into the battery size.
 *
 * No surge multiplier is collected either: it is treated as 1, and the panel
 * says so rather than quietly under-stating the peak.
 */
function CustomAppliances({
  custom,
  onChange,
}: {
  custom: CustomAppliance[];
  onChange: (next: CustomAppliance[]) => void;
}) {
  const [name, setName] = React.useState("");
  const [watts, setWatts] = React.useState("");

  const parsedWatts = Number(watts);
  const canAdd =
    name.trim().length > 0 &&
    Number.isFinite(parsedWatts) &&
    parsedWatts > 0 &&
    parsedWatts <= 10000 &&
    custom.length < MAX_CUSTOM_APPLIANCES;

  const add = () => {
    if (!canAdd) return;
    onChange([
      ...custom,
      {
        name: name.trim().slice(0, 40),
        watts: Math.round(parsedWatts),
        quantity: 1,
      },
    ]);
    setName("");
    setWatts("");
  };

  const setQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) {
      onChange(custom.filter((_, i) => i !== index));
      return;
    }
    onChange(
      custom.map((entry, i) => (i === index ? { ...entry, quantity } : entry)),
    );
  };

  return (
    <div className="mt-6">
      <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-accent-600">
        Add a device
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Anything the lists above do not cover. Household appliances only — this
        tool sizes home backup.
      </p>

      {custom.length > 0 ? (
        <ul className="mt-2.5 divide-y divide-border rounded-lg border border-border bg-card">
          {custom.map((entry, index) => (
            <li
              key={`${entry.name}-${index}`}
              className="flex items-center gap-3 bg-accent-50/60 p-3 sm:p-3.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {entry.name}
                </p>
                <p className="tabular text-xs text-muted-foreground">
                  {entry.watts} W each
                  <span className="font-semibold text-foreground">
                    {" "}
                    · {entry.watts * entry.quantity} W total
                  </span>
                  <span> · no surge allowance</span>
                </p>
              </div>
              <Stepper
                value={entry.quantity}
                min={0}
                max={50}
                onChange={(next) => setQuantity(index, next)}
                decreaseLabel={`Remove one ${entry.name}`}
                increaseLabel={`Add one ${entry.name}`}
                groupLabel={`${entry.name} quantity`}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {custom.length < MAX_CUSTOM_APPLIANCES ? (
        <form
          className="mt-2.5 flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-xs text-muted-foreground">
              Appliance
            </span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Sewing machine"
              maxLength={40}
              className="h-10"
            />
          </label>
          <label className="w-28">
            <span className="mb-1 block text-xs text-muted-foreground">
              Watts
            </span>
            <Input
              inputMode="numeric"
              value={watts}
              onChange={(event) =>
                setWatts(event.target.value.replace(NON_DIGITS, ""))
              }
              placeholder="150"
              className="h-10"
              aria-label="Watts per unit"
            />
          </label>
          <Button
            type="submit"
            variant="outline"
            className="h-10"
            disabled={!canAdd}
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </form>
      ) : null}

      <p className="mt-2 text-xs text-muted-foreground">
        Check the rating plate on the appliance. We do not guess a wattage for
        something we have not listed, and anything added here is counted without
        a start-up surge allowance.
      </p>
    </div>
  );
}
