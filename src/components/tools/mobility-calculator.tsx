'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, BatteryCharging, Copy, Gauge, Info, Plug, Route, Zap } from 'lucide-react';
import type { MobilityResponse } from '@/app/api/mobility/route';
import {
  DEFAULTS,
  LIMITS,
  MOBILITY_ASSUMPTIONS,
  MOTOR_PRESETS,
  VEHICLE_TYPES,
  VOLTAGE_PRESETS,
  calculateMobility,
  decodeMobility,
  encodeMobility,
  type MobilityInput,
  type VehicleType,
} from '@/lib/sizing/mobility';
import { useUI } from '@/lib/store/ui-provider';
import { Button, ButtonLink } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { ProductCard } from '@/components/product/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const PATH = '/tools/mobility-calculator';

/**
 * EV battery calculator for 2-wheelers and e-rickshaws.
 *
 * The arithmetic is `lib/sizing/mobility.ts`, run here for instant figures and
 * again by `/api/mobility`, which adds the catalogue packs. This component
 * holds no formula of its own, so the figures on screen and the packs chosen
 * can never be computed two different ways.
 */
export function MobilityCalculator() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useUI();

  const initial = React.useMemo(
    () => decodeMobility((key) => searchParams.get(key)),
    // Read once on mount; later changes are driven by the controls below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [vehicleType, setVehicleType] = React.useState<VehicleType | null>(initial.vehicleType);
  const [motorWatts, setMotorWatts] = React.useState<number>(
    initial.input?.motorWatts ?? DEFAULTS['2w'].motorWatts,
  );
  const [systemVoltage, setSystemVoltage] = React.useState<number>(
    initial.input?.systemVoltage ?? DEFAULTS['2w'].systemVoltage,
  );
  const [dailyKm, setDailyKm] = React.useState<number>(
    initial.input?.dailyKm ?? DEFAULTS['2w'].dailyKm,
  );
  const [vehicleAgeYears, setVehicleAgeYears] = React.useState<number>(
    initial.input?.vehicleAgeYears ?? 0,
  );
  const [response, setResponse] = React.useState<MobilityResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const step2Ref = React.useRef<HTMLElement>(null);

  const errors = {
    motorWatts: within(motorWatts, LIMITS.motorWatts)
      ? undefined
      : `Enter ${LIMITS.motorWatts.min}–${LIMITS.motorWatts.max} W`,
    systemVoltage: within(systemVoltage, LIMITS.systemVoltage)
      ? undefined
      : `Enter ${LIMITS.systemVoltage.min}–${LIMITS.systemVoltage.max} V`,
    dailyKm: within(dailyKm, LIMITS.dailyKm)
      ? undefined
      : `Enter ${LIMITS.dailyKm.min}–${LIMITS.dailyKm.max} km`,
  };
  const valid = !errors.motorWatts && !errors.systemVoltage && !errors.dailyKm;

  const input: MobilityInput | null = React.useMemo(
    () =>
      vehicleType && valid
        ? { vehicleType, motorWatts, systemVoltage, dailyKm, vehicleAgeYears }
        : null,
    [vehicleType, valid, motorWatts, systemVoltage, dailyKm, vehicleAgeYears],
  );

  const result = React.useMemo(() => (input ? calculateMobility(input) : null), [input]);

  // Shareable URL: the working lives in the address bar.
  React.useEffect(() => {
    if (!input) return;
    router.replace(`${PATH}?${encodeMobility(input)}`, { scroll: false });
  }, [input, router]);

  // Catalogue packs, debounced so dragging a slider is one request, not forty.
  React.useEffect(() => {
    if (!input) {
      setResponse(null);
      return;
    }
    setLoading(true);
    setFailed(false);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch('/api/mobility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: controller.signal,
      })
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        })
        .then((data: MobilityResponse) => setResponse(data))
        .catch((error: unknown) => {
          if ((error as { name?: string })?.name === 'AbortError') return;
          setResponse(null);
          setFailed(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [input]);

  const chooseVehicle = (type: VehicleType) => {
    if (type === vehicleType) return;
    // A new vehicle type starts from that type's defaults: a 2-wheeler's 72 V
    // and 2000 W are not sensible starting points for an e-rickshaw.
    const d = DEFAULTS[type];
    setVehicleType(type);
    setMotorWatts(d.motorWatts);
    setSystemVoltage(d.systemVoltage);
    setDailyKm(d.dailyKm);
    setVehicleAgeYears(d.vehicleAgeYears);
    window.setTimeout(
      () => step2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
      50,
    );
  };

  const kwh = result ? (result.requiredAh * result.nominalVoltage) / 1000 : 0;

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-7">
        {/* Step 1 — vehicle type */}
        <section aria-labelledby="mobility-step-1">
          <h2 id="mobility-step-1" className="heading-3">
            <StepNumber n={1} />
            What do you drive?
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {VEHICLE_TYPES.map((type) => {
              const active = vehicleType === type.id;
              return (
                <li key={type.id}>
                  <button
                    type="button"
                    onClick={() => chooseVehicle(type.id)}
                    aria-pressed={active}
                    className={cn(
                      'flex h-full w-full flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-colors sm:p-6',
                      active
                        ? 'border-accent bg-accent text-accent-foreground shadow-card'
                        : 'border-border bg-card hover:border-accent/50 hover:bg-surface',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-16 w-16 place-items-center rounded-full sm:h-20 sm:w-20',
                        active ? 'bg-accent-foreground/15' : 'bg-accent-50 text-accent-600',
                      )}
                    >
                      {type.id === '2w' ? (
                        <ScooterIcon className="h-10 w-10 sm:h-12 sm:w-12" />
                      ) : (
                        <RickshawIcon className="h-10 w-10 sm:h-12 sm:w-12" />
                      )}
                    </span>
                    <span className="font-display text-base font-bold sm:text-lg">{type.label}</span>
                    <span
                      className={cn(
                        'text-xs sm:text-sm',
                        active ? 'text-accent-foreground/80' : 'text-muted-foreground',
                      )}
                    >
                      {type.description}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Step 2 — vehicle details */}
        {vehicleType ? (
          <section ref={step2Ref} aria-labelledby="mobility-step-2" className="mt-8 scroll-mt-24">
            <h2 id="mobility-step-2" className="heading-3">
              <StepNumber n={2} />
              Tell us about the vehicle
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Motor power and voltage are usually printed on the motor, the controller or the
              existing battery. Pick the closest figure or type your own.
            </p>

            <div className="mt-4 space-y-6 rounded-xl border border-border bg-card p-4 sm:p-5">
              <ChipField
                id="mobility-motor"
                label="Motor power"
                unit="W"
                presets={MOTOR_PRESETS[vehicleType]}
                value={motorWatts}
                onChange={setMotorWatts}
                min={LIMITS.motorWatts.min}
                max={LIMITS.motorWatts.max}
                step={50}
                error={errors.motorWatts}
                hint="Rated (continuous) power, not peak."
              />

              <ChipField
                id="mobility-voltage"
                label="System voltage"
                unit="V"
                presets={VOLTAGE_PRESETS[vehicleType]}
                value={systemVoltage}
                onChange={setSystemVoltage}
                min={LIMITS.systemVoltage.min}
                max={LIMITS.systemVoltage.max}
                step={1}
                error={errors.systemVoltage}
                hint="The battery must match the vehicle's voltage exactly — we only suggest packs that do."
              />

              <SliderField
                id="mobility-km"
                label="Distance needed on one charge"
                unit="km"
                value={dailyKm}
                onChange={setDailyKm}
                min={LIMITS.dailyKm.min}
                max={LIMITS.dailyKm.max}
                error={errors.dailyKm}
                hint={
                  vehicleType === '3w'
                    ? 'A city e-rickshaw typically does 80–120 km a day.'
                    : 'Your longest normal day, between charges.'
                }
              />

              <SliderField
                id="mobility-age"
                label="Age of the vehicle"
                unit={vehicleAgeYears === 1 ? 'year' : 'years'}
                value={vehicleAgeYears}
                onChange={setVehicleAgeYears}
                min={LIMITS.vehicleAgeYears.min}
                max={LIMITS.vehicleAgeYears.max}
                hint="Older vehicles use a little more energy per km — worn bearings, tyres and controllers."
              />
            </div>
          </section>
        ) : null}
      </div>

      {/* Results */}
      <div className="lg:col-span-5">
        <div className="space-y-4 lg:sticky lg:top-24" aria-live="polite">
          {!vehicleType ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Choose a 2-wheeler or a 3-wheeler to start. Your battery size and matching Trontek
                packs appear here.
              </p>
            </div>
          ) : !result ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Correct the highlighted field to see your result.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="font-display text-base font-bold text-card-foreground">
                  <StepNumber n={3} />
                  Your estimated battery
                </h2>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <Stat
                    icon={<BatteryCharging className="h-4 w-4" />}
                    label="Capacity needed"
                    value={`${result.requiredAh} Ah`}
                    hint={`${kwh.toFixed(2)} kWh at ${result.nominalVoltage} V`}
                    highlight
                  />
                  <Stat
                    icon={<Gauge className="h-4 w-4" />}
                    label="Estimated use"
                    value={`${result.whPerKm} Wh/km`}
                    hint={
                      result.ageFactor > 1
                        ? `${result.baseWhPerKm} new + ${Math.round((result.ageFactor - 1) * 100)}% age`
                        : 'new vehicle'
                    }
                  />
                  <Stat
                    icon={<Zap className="h-4 w-4" />}
                    label="Motor current"
                    value={`${Math.round(result.continuousCurrentA)} A`}
                    hint="continuous, at rated power"
                  />
                  <Stat
                    icon={<Route className="h-4 w-4" />}
                    label="Range on this size"
                    value={`~${result.estimatedRangeForAh(result.requiredAh)} km`}
                    hint={`for ${dailyKm} km needed`}
                  />
                </dl>

                {result.notes.length > 1 ? (
                  <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                    {result.notes.slice(1).map((note) => (
                      <li key={note} className="flex items-start gap-1.5">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {note}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  className="mt-4"
                  onClick={() => {
                    const url = `${window.location.origin}${PATH}?${encodeMobility(result.input)}`;
                    navigator.clipboard?.writeText(url).then(
                      () => toast({ title: 'Link copied', description: url, tone: 'success' }),
                      () => toast({ title: 'Could not copy the link', tone: 'error' }),
                    );
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Copy a link to this result
                </Button>
              </div>

              <p className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3 text-xs leading-relaxed text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <span>
                  <strong className="text-foreground">These are estimates.</strong> Payload,
                  gradients, traffic, tyre pressure and riding style change real-world range. Check
                  the pack&rsquo;s connector and dimensions against your vehicle, or ask us before
                  you buy.
                </span>
              </p>

              {/* Recommendations */}
              {loading || (!response && !failed) ? (
                <div className="space-y-3">
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : failed || !response ? (
                <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  We could not load matching packs just now. Your battery size above is still
                  correct — try again in a moment.
                </div>
              ) : response.packs.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">
                    We do not list a {result.nominalVoltage} V{' '}
                    {vehicleType === '2w' ? '2-wheeler' : 'e-rickshaw'} pack right now.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We never suggest a pack of a different voltage — it can damage the controller.
                    Our team can tell you what is available for your vehicle.
                  </p>
                  <ButtonLink href="/support" variant="outline" size="sm" className="mt-3">
                    Ask our team
                  </ButtonLink>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-display text-base font-bold text-foreground">
                    {response.packs[0]!.shortfall
                      ? 'Our largest matching pack'
                      : response.packs.length === 1
                        ? 'Recommended Trontek pack'
                        : 'Recommended Trontek packs'}
                  </h3>
                  {response.packs.map((pack, index) => (
                    <div
                      key={pack.product.id}
                      className={cn(
                        'rounded-xl bg-card p-4',
                        index === 0 && !pack.shortfall
                          ? 'border-2 border-accent'
                          : 'border border-border',
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {index === 0 && !pack.shortfall ? (
                          <span className="rounded-full bg-accent px-2.5 py-1 text-2xs font-bold uppercase tracking-wide text-accent-foreground">
                            Closest fit
                          </span>
                        ) : null}
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-600">
                          <Route className="h-3.5 w-3.5" />~{pack.estimatedRangeKm} km per charge
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{pack.capacityLabel}</p>
                      {pack.shortfall ? (
                        <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-warning">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          Below the {result.requiredAh} Ah you need — about {pack.estimatedRangeKm}{' '}
                          km against your {dailyKm} km. Plan a top-up charge, or ask us about a
                          larger pack.
                        </p>
                      ) : null}
                      <div className="mt-3">
                        <ProductCard product={pack.product} />
                      </div>
                      {pack.chargers.length > 0 ? (
                        <div className="mt-4 border-t border-border pt-3">
                          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <Plug className="h-3.5 w-3.5" />
                            Matching charger
                          </p>
                          <div className="mt-2 space-y-3">
                            {pack.chargers.map((charger) => (
                              <ProductCard key={charger.id} product={charger} layout="compact" />
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              <details className="rounded-lg border border-border bg-surface p-4">
                <summary className="cursor-pointer text-sm font-semibold text-foreground">
                  Assumptions used
                </summary>
                <dl className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  {MOBILITY_ASSUMPTIONS.map((assumption) => (
                    <div key={assumption.label} className="flex justify-between gap-3">
                      <dt>{assumption.label}</dt>
                      <dd className="tabular text-right font-medium text-foreground">
                        {assumption.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- parts */

function within(value: number, range: { min: number; max: number }): boolean {
  return Number.isFinite(value) && value >= range.min && value <= range.max;
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-accent text-2xs font-bold text-accent-foreground">
      {n}
    </span>
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

/**
 * Preset chips plus a number box for anything else.
 *
 * The chips are a radio-like group (`aria-pressed`), the box is the labelled
 * control, and both write the same value — so typing 1100 simply leaves no
 * chip selected.
 */
function ChipField({
  id,
  label,
  unit,
  presets,
  value,
  onChange,
  min,
  max,
  step,
  error,
  hint,
}: {
  id: string;
  label: string;
  unit: string;
  presets: readonly number[];
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  error?: string;
  hint?: string;
}) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <div className="flex flex-wrap gap-2" role="group" aria-label={`${label} presets`}>
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={value === preset}
            onClick={() => onChange(preset)}
            className={cn(
              'tabular h-10 min-w-[4.5rem] rounded-full border px-4 text-sm font-semibold transition-colors',
              value === preset
                ? 'border-accent bg-accent text-accent-foreground'
                : 'border-input bg-card text-foreground hover:border-accent/50 hover:bg-surface',
            )}
          >
            {preset.toLocaleString('en-IN')} {unit}
          </button>
        ))}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : ''}
          onChange={(event) => onChange(event.target.value === '' ? NaN : Number(event.target.value))}
          aria-invalid={error ? true : undefined}
          className="tabular max-w-[9rem]"
        />
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
    </Field>
  );
}

function SliderField({
  id,
  label,
  unit,
  value,
  onChange,
  min,
  max,
  error,
  hint,
}: {
  id: string;
  label: string;
  unit: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  error?: string;
  hint?: string;
}) {
  const sliderValue = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={sliderValue}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={`${label} (slider)`}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-[hsl(var(--accent))]"
        />
        <div className="flex items-center gap-1.5">
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={1}
            value={Number.isFinite(value) ? value : ''}
            onChange={(event) =>
              onChange(event.target.value === '' ? NaN : Math.round(Number(event.target.value)))
            }
            aria-invalid={error ? true : undefined}
            className="tabular w-20"
          />
          <span className="w-10 text-sm text-muted-foreground">{unit}</span>
        </div>
      </div>
    </Field>
  );
}

/* ---------------------------------------------------------------- icons */

function ScooterIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="11" cy="35" r="5" />
      <circle cx="37" cy="35" r="5" />
      <path d="M30 10h4l3 25" />
      <path d="M31 10l-2-3" />
      <path d="M16 35h14l3-10H20a8 8 0 0 0-8 7" />
      <path d="M18 25l-1-5h8" />
    </svg>
  );
}

function RickshawIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 12h26a6 6 0 0 1 6 6v2" />
      <path d="M10 12v20M30 12v20" />
      <path d="M6 32h36l-2-12h-6" />
      <path d="M16 22h10v6H16z" />
      <circle cx="12" cy="36" r="4" />
      <circle cx="36" cy="36" r="4" />
    </svg>
  );
}
