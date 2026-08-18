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

export function LoadCalculator() {
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

  // Keep the URL in step with the working, so a result can be shared or bookmarked.
  React.useEffect(() => {
    const qs = encodeSelection(selection, backupHours);
    router.replace(qs ? `/tools/load-calculator?${qs}` : '/tools/load-calculator', {
      scroll: false,
    });
  }, [selection, backupHours, router]);

  React.useEffect(() => {
    if (!hasLoad) {
      setRecommendation(null);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/sizing?va=${sizing.requiredVa}&ah=${sizing.requiredAh}`, {
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((data: SizingRecommendation) => setRecommendation(data))
        .catch(() => setRecommendation(null))
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [hasLoad, sizing.requiredVa, sizing.requiredAh]);

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
                hint={hasLoad ? `peaks near ${sizing.peakWatts} W` : undefined}
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
                label="Appliances"
                value={String(Object.values(selection).reduce((n, q) => n + q, 0))}
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

          {/* Recommendations */}
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
          ) : recommendation.exceedsRange ? (
            <div className="rounded-xl border border-warning/40 bg-warning-soft p-5">
              <p className="flex items-start gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-warning" />
                This load is beyond our standard range
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                A {sizing.requiredVa} VA system with {sizing.requiredAh} Ah of storage needs a
                custom specification. Our engineers will design it around your site.
              </p>
              <ButtonLink href="/support" variant="primary" size="sm" className="mt-4">
                Talk to an engineer
              </ButtonLink>
            </div>
          ) : (
            <div className="space-y-4">
              {recommendation.combo ? (
                <div className="rounded-xl border-2 border-accent bg-card p-4">
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-2xs font-bold uppercase tracking-wide text-accent-foreground">
                    <Check className="h-3 w-3" />
                    Best match
                  </p>
                  <div className="mt-3">
                    <ProductCard product={recommendation.combo} />
                  </div>
                  <Button
                    variant="accent"
                    fullWidth
                    className="mt-3"
                    onClick={() => {
                      cart.addItem(summaryToCartItem(recommendation.combo!));
                      toast({
                        title: 'Added to cart',
                        description: recommendation.combo!.title,
                        tone: 'success',
                        action: { label: 'View cart', onClick: () => open('cart') },
                      });
                    }}
                  >
                    Add this system to cart
                  </Button>
                </div>
              ) : null}

              {recommendation.inverter || recommendation.battery ? (
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="font-display text-sm font-semibold text-card-foreground">
                    Or buy the parts separately
                  </h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {recommendation.inverter ? (
                      <ProductCard product={recommendation.inverter} />
                    ) : null}
                    {recommendation.battery ? (
                      <ProductCard product={recommendation.battery} />
                    ) : null}
                  </div>
                </div>
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
                factor, with headroom so the unit is not permanently at full output. Surge is
                checked separately against the largest single appliance, because two motors rarely
                start at the same instant.
              </p>
              <p>
                <strong className="text-foreground">Battery Ah</strong> = (running watts × hours) ÷
                (system voltage × efficiency × usable depth of discharge).
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
                Appliance wattages are typical figures. If your appliance rating plate says
                something different, size against that number and check with our engineers.
              </p>
            </div>
          </details>
        </div>
      </div>
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
