import { BatteryCharging, BatteryLow, Building2, Home, Sun, Timer, Zap } from 'lucide-react';
import { DEMO_SECTIONS } from '@/lib/commerce/demo/demo-product';

/* ===========================================================================
 * TEMPORARY DEMO COMPONENT — UI/REFERENCE ONLY
 * ===========================================================================
 *
 * Renders the battery-specific sections of the DEMO product page. Every value
 * shown here is illustrative dummy data from `lib/commerce/demo/demo-product.ts`
 * and describes no real product; none of it comes from the Hostinger catalogue.
 *
 * This component is rendered ONLY for the demo product, behind an `isDemoSlug`
 * check in `app/p/[slug]/page.tsx`. Real catalogue products never reach it and
 * never receive invented specifications.
 *
 * Delete this file together with `lib/commerce/demo/` to remove the demo.
 *
 * Built entirely from the existing token layer and utility classes — no new
 * colours, no new radii, no second design system.
 * ------------------------------------------------------------------------ */

const APPLICATION_ICONS = [Home, Sun, Building2, Zap];

export function DemoBatterySections() {
  return (
    <>
      {/* ------------------------------------------------ recommended use */}
      <section aria-labelledby="applications-heading" className="mt-10 lg:mt-14">
        <h2 id="applications-heading" className="heading-3">
          Recommended applications
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Where this battery is a good fit, and what it is doing well in each case.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DEMO_SECTIONS.applications.map((application, index) => {
            const Icon = APPLICATION_ICONS[index % APPLICATION_ICONS.length];
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

      {/* --------------------------------------------- charging + discharge */}
      <section aria-labelledby="power-heading" className="mt-10 lg:mt-14">
        <h2 id="power-heading" className="heading-3">
          Charging and discharge
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
              <BatteryCharging className="h-5 w-5 text-success" />
              Charging
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {DEMO_SECTIONS.charging.summary}
            </p>
            <dl className="mt-4 divide-y divide-border border-t border-border">
              {DEMO_SECTIONS.charging.points.map((point) => (
                <div key={point.label} className="flex gap-4 py-2.5 text-sm">
                  <dt className="w-2/5 shrink-0 text-muted-foreground">{point.label}</dt>
                  <dd className="flex-1 font-medium text-foreground">{point.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
              <BatteryLow className="h-5 w-5 text-accent-600" />
              Discharge
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {DEMO_SECTIONS.discharge.summary}
            </p>
            <dl className="mt-4 divide-y divide-border border-t border-border">
              {DEMO_SECTIONS.discharge.points.map((point) => (
                <div key={point.label} className="flex gap-4 py-2.5 text-sm">
                  <dt className="w-2/5 shrink-0 text-muted-foreground">{point.label}</dt>
                  <dd className="flex-1 font-medium text-foreground">{point.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- run times */}
      <section aria-labelledby="sizing-heading" className="mt-10 lg:mt-14">
        <h2 id="sizing-heading" className="heading-3">
          How long it will run
        </h2>
        <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
          {DEMO_SECTIONS.sizing.summary}
        </p>

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
              {DEMO_SECTIONS.sizing.scenarios.map((scenario, index) => (
                <tr
                  key={scenario.load}
                  className={index % 2 === 1 ? 'bg-surface/50' : undefined}
                >
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
          Indicative figures for a fully charged battery. Actual run time depends on your
          appliances, their age and the ambient temperature.
        </p>
      </section>

      {/* ------------------------------------------- compatibility + care */}
      <section aria-labelledby="compatibility-heading" className="mt-10 lg:mt-14">
        <h2 id="compatibility-heading" className="heading-3">
          Compatibility and care
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-display text-base font-semibold text-foreground">
              What it works with
            </h3>
            <ul className="mt-3 space-y-2">
              {DEMO_SECTIONS.compatibility.map((entry) => (
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

          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-display text-base font-semibold text-foreground">
              Looking after it
            </h3>
            <ul className="mt-3 space-y-2">
              {DEMO_SECTIONS.care.map((entry) => (
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
        </div>
      </section>
    </>
  );
}
