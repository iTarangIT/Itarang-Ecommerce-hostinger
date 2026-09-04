import { BatteryCharging, BatteryLow, Building2, Home, Sun, Timer, Zap } from 'lucide-react';
import type { ProductSection } from '@/lib/commerce/types';

/**
 * The page blocks below the fold.
 *
 * This began as `demo-battery-sections.tsx`, which rendered a hard-coded
 * fixture for the demonstration product alone — the only product that had
 * anywhere to keep applications, charging figures, run times, compatibility and
 * care, because the `Product` type had no home for them. It has one now
 * (`Product.sections`, backed by `product_sections`), so the markup is the same
 * and the data is real.
 *
 * A product renders the sections it has and no others. There is no placeholder
 * and no empty state: a home storage battery has no discharge cut-off to
 * discuss and simply does not show a Discharge block, rather than showing one
 * with nothing in it.
 */

const APPLICATION_ICONS = [Home, Sun, Building2, Zap];

function find<K extends 'applications' | 'runtime'>(
  sections: readonly ProductSection[],
  kind: K,
): Extract<ProductSection, { kind: K }> | undefined {
  return sections.find(
    (section): section is Extract<ProductSection, { kind: K }> => section.kind === kind,
  );
}

/**
 * Charging and discharge share one member of the union, as do compatibility and
 * care, so `Extract<…, { kind: 'charging' }>` resolves to `never` for them —
 * the member's `kind` is the wider union. Narrowing with the same predicate the
 * type is written with is what works.
 */
function findSummary(sections: readonly ProductSection[], kind: 'charging' | 'discharge') {
  const section = sections.find((entry) => entry.kind === kind);
  return section && (section.kind === 'charging' || section.kind === 'discharge')
    ? section
    : undefined;
}

function findItems(sections: readonly ProductSection[], kind: 'compatibility' | 'care') {
  const section = sections.find((entry) => entry.kind === kind);
  return section && (section.kind === 'compatibility' || section.kind === 'care')
    ? section
    : undefined;
}

function PointList({ points }: { points: ReadonlyArray<{ label: string; value: string }> }) {
  if (points.length === 0) return null;
  return (
    <dl className="mt-4 divide-y divide-border border-t border-border">
      {points.map((point) => (
        <div key={point.label} className="flex gap-4 py-2.5 text-sm">
          <dt className="w-2/5 shrink-0 text-muted-foreground">{point.label}</dt>
          <dd className="flex-1 font-medium text-foreground">{point.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function BulletCard({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((entry) => (
          <li
            key={entry}
            className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground"
          >
            <span
              aria-hidden="true"
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
            />
            {entry}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProductSections({ sections }: { sections: readonly ProductSection[] }) {
  const applications = find(sections, 'applications');
  const charging = findSummary(sections, 'charging');
  const discharge = findSummary(sections, 'discharge');
  const runtime = find(sections, 'runtime');
  const compatibility = findItems(sections, 'compatibility');
  const care = findItems(sections, 'care');

  if (sections.length === 0) return null;

  return (
    <>
      {/* ------------------------------------------------ recommended use */}
      {applications && applications.items.length > 0 ? (
        <section aria-labelledby="applications-heading" className="mt-10 lg:mt-14">
          <h2 id="applications-heading" className="heading-3">
            Recommended applications
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Where this product is a good fit, and what it is doing well in each case.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {applications.items.map((application, index) => {
              const Icon = APPLICATION_ICONS[index % APPLICATION_ICONS.length] ?? Zap;
              return (
                <li
                  key={application.title}
                  className="flex h-full flex-col rounded-lg border border-border bg-card p-4"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-3 font-display text-sm font-semibold text-foreground">
                    {application.title}
                  </h3>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {application.description}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* --------------------------------------------- charging + discharge */}
      {charging || discharge ? (
        <section aria-labelledby="power-heading" className="mt-10 lg:mt-14">
          <h2 id="power-heading" className="heading-3">
            {charging && discharge ? 'Charging and discharge' : charging ? 'Charging' : 'Discharge'}
          </h2>
          {/* One column when only one of the two is stated, so a single card
              does not sit in half a row with a gap beside it. */}
          <div className={`mt-4 grid gap-4 ${charging && discharge ? 'lg:grid-cols-2' : ''}`}>
            {charging ? (
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
                  <BatteryCharging className="h-5 w-5 text-success" />
                  Charging
                </h3>
                {charging.summary ? (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {charging.summary}
                  </p>
                ) : null}
                <PointList points={charging.points} />
              </div>
            ) : null}

            {discharge ? (
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
                  <BatteryLow className="h-5 w-5 text-accent-600" />
                  Discharge
                </h3>
                {discharge.summary ? (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {discharge.summary}
                  </p>
                ) : null}
                <PointList points={discharge.points} />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------- run times */}
      {runtime && runtime.scenarios.length > 0 ? (
        <section aria-labelledby="sizing-heading" className="mt-10 lg:mt-14">
          <h2 id="sizing-heading" className="heading-3">
            How long it will run
          </h2>
          {runtime.summary ? (
            <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">{runtime.summary}</p>
          ) : null}

          {/* Wide content scrolls inside its own container rather than the page. */}
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="bg-surface text-left">
                  <th scope="col" className="px-4 py-3 font-display font-semibold text-foreground">
                    Typical load
                  </th>
                  <th scope="col" className="px-4 py-3 font-display font-semibold text-foreground">
                    Draw
                  </th>
                  <th scope="col" className="px-4 py-3 font-display font-semibold text-foreground">
                    Estimated run time
                  </th>
                </tr>
              </thead>
              <tbody>
                {runtime.scenarios.map((scenario, index) => (
                  <tr key={scenario.load} className={index % 2 === 1 ? 'bg-surface/50' : undefined}>
                    <td className="border-t border-border px-4 py-3 text-foreground">
                      {scenario.load}
                    </td>
                    <td className="tabular border-t border-border px-4 py-3 text-muted-foreground">
                      {scenario.draw}
                    </td>
                    <td className="tabular border-t border-border px-4 py-3 font-semibold text-foreground">
                      {scenario.runtime}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Timer className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Indicative figures for a fully charged battery. Actual run time depends on the load,
            its age and the ambient temperature.
          </p>
        </section>
      ) : null}

      {/* ------------------------------------------- compatibility + care */}
      {compatibility || care ? (
        <section aria-labelledby="compatibility-heading" className="mt-10 lg:mt-14">
          <h2 id="compatibility-heading" className="heading-3">
            {compatibility && care
              ? 'Compatibility and care'
              : compatibility
                ? 'Compatibility'
                : 'Care'}
          </h2>
          <div className={`mt-4 grid gap-4 ${compatibility && care ? 'lg:grid-cols-2' : ''}`}>
            {compatibility ? (
              <BulletCard title="What it works with" items={compatibility.items} />
            ) : null}
            {care ? <BulletCard title="Looking after it" items={care.items} /> : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
