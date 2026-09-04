'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  BatteryCharging,
  Check,
  Copy,
  Info,
  Minus,
  Plus,
  RotateCcw,
  Zap,
} from 'lucide-react';
import type { SizingRecommendation } from '@/app/api/sizing/route';
import {
  APPLIANCES,
  SIZING_ASSUMPTIONS,
  calculateSizing,
  decodeSelection,
  encodeSelection,
  type Selection,
} from '@/lib/sizing/calculator';
import { summaryToCartItem, useCart } from '@/lib/store/hooks';
import { useUI } from '@/lib/store/ui-provider';
import { Button, ButtonLink } from '@/components/ui/button';
import { ProductCard } from '@/components/product/product-card';
import { PurchaseButton } from '@/components/product/purchase-button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const GROUPS = ['Lighting & fans', 'Entertainment & work', 'Kitchen', 'Heavy loads'] as const;

const PRESETS: Array<{ label: string; description: string; selection: Selection; hours: number }> = [
  {
    label: 'One room',
    description: '2 fans, 4 lights, router',
    selection: { fan: 2, led: 4, router: 1 },
    hours: 4,
  },
  {
    label: 'Two bedrooms',
    description: '4 fans, 6 lights, TV, router',
    selection: { fan: 4, led: 6, tv: 1, router: 1 },
    hours: 5,
  },
  {
    label: 'Family home',
    description: 'Above, plus refrigerator and a mixer',
    selection: { fan: 4, led: 8, tv: 1, router: 1, fridge: 1, mixer: 1 },
    hours: 6,
  },
  {
    label: 'Home office',
    description: 'Desktop, laptop, router, 2 fans, 4 lights',
    selection: { desktop: 1, laptop: 1, router: 1, fan: 2, led: 4 },
    hours: 4,
  },
];

/**
 * "inverters", "inverters and combos", "inverters, combos and batteries".
 *
 * Plural nouns because the sentence is about what the shop stocks, not about
 * one product.
 */
function describeFamilies(families: SizingRecommendation['unavailableFamilies']): string {
  const names: Record<SizingRecommendation['unavailableFamilies'][number], string> = {
    inverter: 'inverters',
    battery: 'home-backup batteries',
    combo: 'inverter and battery combos',
  };
  const list = families.map((family) => names[family]);
  if (list.length <= 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/**
 * Two presentation-only props, added so the same calculator can be mounted on a
 * product page. Neither reaches the arithmetic in `lib/sizing/calculator.ts` or
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
}

export function LoadCalculator({ syncUrl = true, currentProductId }: LoadCalculatorProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cart = useCart();
  const { toast, open } = useUI();

  const initial = React.useMemo(
    () =>
      decodeSelection(
        searchParams.get('load') ?? undefined,
        searchParams.get('hours') ?? undefined,
      ),
    // Read once on mount; later changes are driven by the controls below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [selection, setSelection] = React.useState<Selection>(initial.selection);
  const [backupHours, setBackupHours] = React.useState(initial.backupHours);
  const [recommendation, setRecommendation] = React.useState<SizingRecommendation | null>(null);
  const [loading, setLoading] = React.useState(false);
  const resultRef = React.useRef<HTMLDivElement>(null);

  const sizing = React.useMemo(
    () => calculateSizing(selection, backupHours),
    [selection, backupHours],
  );

  const hasLoad = sizing.runningWatts > 0;

  // Keep the URL in step with the working, so a result can be shared or
  // bookmarked. Skipped when the calculator is embedded: on a product page this
  // would replace the address with `/tools/load-calculator` on the first click.
  React.useEffect(() => {
    if (!syncUrl) return;
    const qs = encodeSelection(selection, backupHours);
    router.replace(qs ? `/tools/load-calculator?${qs}` : '/tools/load-calculator', {
      scroll: false,
    });
  }, [selection, backupHours, router, syncUrl]);

  React.useEffect(() => {
    if (!hasLoad) {
      setRecommendation(null);
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
    hasLoad,
    sizing.requiredVa,
    sizing.requiredAh,
    sizing.systemVoltage,
    sizing.runningWatts,
    sizing.backupHours,
  ]);

  const setQuantity = (id: string, quantity: number) =>
    setSelection((current) => {
      const next = { ...current };
      if (quantity <= 0) delete next[id];
      else next[id] = Math.min(50, quantity);
      return next;
    });

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setSelection(preset.selection);
    setBackupHours(preset.hours);
    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      {/* Appliance picker */}
      <div className="lg:col-span-7">
        <section>
          <h2 className="heading-3">Start from a typical home</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {PRESETS.map((preset) => (
              <li key={preset.label}>
                <button
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="w-full rounded-lg border border-border bg-card p-3.5 text-left transition-colors hover:border-accent/50 hover:bg-surface"
                >
                  <span className="block text-sm font-semibold text-foreground">{preset.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {preset.description}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="heading-3">Or pick your appliances</h2>
            {Object.keys(selection).length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setSelection({})}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            ) : null}
          </div>

          <div className="mt-4 space-y-6">
            {GROUPS.map((group) => (
              <div key={group}>
                <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-accent-600">
                  {group}
                </h3>
                <ul className="mt-2.5 divide-y divide-border rounded-lg border border-border bg-card">
                  {APPLIANCES.filter((a) => a.group === group).map((appliance) => {
                    const quantity = selection[appliance.id] ?? 0;
                    const active = quantity > 0;
                    return (
                      <li
                        key={appliance.id}
                        className={cn(
                          'flex items-center gap-3 p-3 transition-colors sm:p-3.5',
                          active && 'bg-accent-50/60',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{appliance.name}</p>
                          <p className="tabular text-xs text-muted-foreground">
                            {appliance.watts} W each
                            {appliance.surge > 1
                              ? ` · surges to ~${Math.round(appliance.watts * appliance.surge)} W`
                              : ''}
                          </p>
                          {appliance.note && active ? (
                            <p className="mt-1 flex items-start gap-1 text-xs text-warning">
                              <Info className="mt-0.5 h-3 w-3 shrink-0" />
                              {appliance.note}
                            </p>
                          ) : null}
                        </div>

                        {active ? (
                          <div className="inline-flex shrink-0 items-center rounded-md border border-input bg-card">
                            <button
                              type="button"
                              onClick={() => setQuantity(appliance.id, quantity - 1)}
                              aria-label={`Remove one ${appliance.name}`}
                              className="grid h-9 w-9 place-items-center text-foreground hover:bg-secondary"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="tabular w-8 text-center text-sm font-semibold">
                              {quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => setQuantity(appliance.id, quantity + 1)}
                              aria-label={`Add one ${appliance.name}`}
                              className="grid h-9 w-9 place-items-center text-foreground hover:bg-secondary"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() => setQuantity(appliance.id, appliance.defaultQuantity)}
                          >
                            <Plus className="h-4 w-4" />
                            Add
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Result */}
      <div className="lg:col-span-5">
        <div ref={resultRef} className="space-y-4 lg:sticky lg:top-24">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-base font-bold text-card-foreground">
              How long do you need backup for?
            </h2>
            <div className="mt-4 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={12}
                step={1}
                value={backupHours}
                onChange={(e) => setBackupHours(Number(e.target.value))}
                aria-label="Backup hours"
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-[hsl(var(--accent))]"
              />
              <span className="tabular w-20 shrink-0 text-right font-display text-lg font-bold text-foreground">
                {backupHours} {backupHours === 1 ? 'hour' : 'hours'}
              </span>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3">
              <Stat
                icon={<Zap className="h-4 w-4" />}
                label="Running load"
                value={hasLoad ? `${sizing.runningWatts} W` : '—'}
                // Shown for information. No product in the catalogue states a
                // surge rating, so this figure is not part of any sizing check
                // and the copy below does not pretend it is.
                hint={hasLoad ? `momentary peak ~${sizing.peakWatts} W` : undefined}
              />
              <Stat
                icon={<Zap className="h-4 w-4" />}
                label="Inverter needed"
                value={hasLoad ? `${sizing.requiredVa} VA` : '—'}
                hint={hasLoad ? `${sizing.systemVoltage}V system` : undefined}
                highlight
              />
              <Stat
                icon={<BatteryCharging className="h-4 w-4" />}
                label="Battery needed"
                value={hasLoad ? `${sizing.requiredAh} Ah` : '—'}
                hint={
                  hasLoad && sizing.needsBank
                    ? `${sizing.batteriesInSeries} batteries in series`
                    : hasLoad
                      ? 'single battery'
                      : undefined
                }
                highlight
              />
              <Stat
                icon={<Info className="h-4 w-4" />}
                label="Energy needed"
                // Running watts x hours. The shopper's own two inputs
                // multiplied — no efficiency, no depth of discharge, no
                // headroom — so it can be stated as a fact.
                value={hasLoad ? `${sizing.loadEnergyWh} Wh` : '—'}
                hint={hasLoad ? `over ${sizing.backupHours} h` : undefined}
              />
            </dl>

            {hasLoad ? (
              <Button
                variant="outline"
                size="sm"
                fullWidth
                className="mt-4"
                onClick={() => {
                  const url = `${window.location.origin}/tools/load-calculator?${encodeSelection(
                    selection,
                    backupHours,
                  )}`;
                  navigator.clipboard?.writeText(url).then(
                    () => toast({ title: 'Link copied', description: url, tone: 'success' }),
                    () => toast({ title: 'Could not copy the link', tone: 'error' }),
                  );
                }}
              >
                <Copy className="h-4 w-4" />
                Copy a link to this result
              </Button>
            ) : null}
          </div>

          {/* Recommendation */}
          {!hasLoad ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Add the appliances you want running during a cut and we will size the system.
              </p>
            </div>
          ) : loading || !recommendation ? (
            <div className="space-y-3">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              {/*
                One branch per outcome the route distinguishes, because the
                distinction is the point. This panel used to have two states —
                products, or "this load is beyond our standard range" — and the
                second was shown for every input, including a single LED bulb.
                Telling somebody their two-fan load is unusual when the truth is
                that we have not priced the product is a false statement about
                their home.
              */}
              {recommendation.status === 'matched' && recommendation.battery ? (
                <>
                  <div className="rounded-xl border-2 border-accent bg-card p-4">
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-2xs font-bold uppercase tracking-wide text-accent-foreground">
                      <Check className="h-3 w-3" />
                      Recommended
                    </p>
                    <div className="mt-3">
                      <ProductCard product={recommendation.battery.product} />
                    </div>
                    {/* Said only when it is true, and only ever after the fact.
                        The engine picked this product from the catalogue on the
                        load alone; `currentProductId` is not sent to the API and
                        cannot influence what comes back. A product page that
                        nominated itself would be worthless as an answer. */}
                    {currentProductId && recommendation.battery.product.id === currentProductId ? (
                      <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-success">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        That is the product you are looking at.
                      </p>
                    ) : null}
                    <p className="tabular mt-3 text-xs font-medium text-foreground">
                      {recommendation.battery.capacityLabel}
                    </p>
                    <h3 className="mt-3 font-display text-sm font-semibold text-card-foreground">
                      Why this one
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {/* Every line is a statement the product itself makes.
                          The engine builds them from the catalogue row, so this
                          list cannot claim something the specification does not
                          say. */}
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
                    {/* Purchase is switched off site-wide; the button stays,
                        disabled. See lib/commerce/purchase.ts. */}
                    <PurchaseButton
                      variant="accent"
                      fullWidth
                      className="mt-4"
                      onClick={() => {
                        cart.addItem(summaryToCartItem(recommendation.battery!.product));
                        toast({
                          title: 'Added to cart',
                          description: recommendation.battery!.product.title,
                          tone: 'success',
                          action: { label: 'View cart', onClick: () => open('cart') },
                        });
                      }}
                    >
                      Add this battery to cart
                    </PurchaseButton>
                  </div>

                  {recommendation.alternatives.length > 0 ? (
                    <div className="rounded-xl border border-border bg-card p-4">
                      <h3 className="font-display text-sm font-semibold text-card-foreground">
                        Also compatible
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Shown only where the product satisfies the same documented
                        requirements. The recommendation above is the smallest that does.
                      </p>
                      <ul className="mt-3 space-y-4">
                        {recommendation.alternatives.map((alternative) => (
                          <li key={alternative.product.id}>
                            <ProductCard product={alternative.product} />
                            <p className="mt-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">Not selected:</span>{' '}
                              {alternative.whyNotSelected}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <NoMatch
                  status={recommendation.status}
                  unavailableMatch={recommendation.unavailableMatch}
                  requiredAh={sizing.requiredAh}
                  requiredDcWatts={sizing.requiredDcWatts}
                  systemVoltage={sizing.systemVoltage}
                />
              )}

              {/* The rest of the system, where the catalogue holds it. */}
              {recommendation.combo || recommendation.inverter ? (
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

              {/* Which families we stock nothing in at all — named, rather
                  than silently omitted, so a battery-only answer does not read
                  as the whole system. */}
              {recommendation.unavailableFamilies.length > 0 ? (
                <p className="rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
                  We are not currently stocking{' '}
                  {describeFamilies(recommendation.unavailableFamilies)} — our team can source
                  that part.
                </p>
              ) : null}
            </div>
          )}

          {/* Assumptions */}
          <details className="rounded-lg border border-border bg-surface p-4">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              How this is calculated
            </summary>
            <div className="mt-3 space-y-3 text-xs leading-relaxed text-muted-foreground">
              <p>
                <strong className="text-foreground">Inverter VA</strong> = running watts ÷ power
                factor, with headroom so the unit is not permanently at full output.
              </p>
              <p>
                <strong className="text-foreground">Battery Ah</strong> = (running watts × hours) ÷
                (system voltage × efficiency × usable depth of discharge).
              </p>
              <p>
                {/* Says exactly what happens to the surge figure, and no more.
                    No battery in our range publishes a surge or peak discharge
                    rating, so there is nothing to check the peak against and
                    this tool does not pretend otherwise. */}
                <strong className="text-foreground">Momentary peak</strong> is the running load plus
                the largest single appliance&rsquo;s start-up surge, shown for information. It is
                not used to size the inverter and is not checked against a battery, because none of
                our batteries publishes a surge rating.
              </p>
              <p>
                <strong className="text-foreground">The recommendation</strong> is a separate step.
                A battery is only offered when its own published specification satisfies the system
                voltage, the capacity and the continuous discharge your load needs, and it is in
                stock. Where nothing does, we say so rather than offer the nearest size.
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
                Appliance wattages and the four factors above are typical planning figures, not
                product specifications. If your appliance rating plate says something different,
                size against that number and check with our engineers.
              </p>
            </div>
          </details>
        </div>
      </div>
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
}: {
  status: SizingRecommendation['status'];
  unavailableMatch: SizingRecommendation['unavailableMatch'];
  requiredAh: number;
  requiredDcWatts: number;
  systemVoltage: number;
}) {
  const requirement = `Your load needs about ${requiredAh} Ah at a ${systemVoltage}V battery input, delivering around ${requiredDcWatts} W continuously.`;

  const { title, body } =
    status === 'not-available' && unavailableMatch
      ? {
          title: `${unavailableMatch.product.title} fits, but is not available right now`,
          body: `${unavailableMatch.capacityLabel}. It satisfies everything your load needs; we simply cannot ship it today.`,
        }
      : status === 'information-missing'
        ? {
            title: 'We want to confirm a specification before recommending anything',
            body: `${requirement} One of our batteries is the right kind of product, but its published specification is missing a figure this check needs, and we would rather confirm it than guess.`,
          }
        : status === 'incomplete-request'
          ? {
              title: 'We need a little more before we can recommend a battery',
              body: 'Choose the appliances you want running and a backup window, and we will check them against what we stock.',
            }
          : {
              title: 'No matching iTarang battery is currently available for this requirement',
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
        Please contact our support team and we can help you find the right solution.
      </p>
      <ButtonLink href="/support" variant="primary" size="sm" className="mt-4">
        Talk to our support team
      </ButtonLink>
    </div>
  );
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
        'rounded-lg border p-3',
        highlight ? 'border-accent/40 bg-accent-50' : 'border-border bg-surface',
      )}
    >
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={highlight ? 'text-accent-600' : 'text-muted-foreground'}>{icon}</span>
        {label}
      </dt>
      <dd className="tabular mt-1 font-display text-xl font-bold text-foreground">{value}</dd>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
