import { Suspense } from 'react';
import { Calculator } from 'lucide-react';
import type { Product } from '@/lib/commerce/types';
import { HOME_BACKUP_SUBCATEGORIES } from '@/lib/sizing/recommend';
import { LoadCalculator } from '@/components/tools/load-calculator';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The load calculator, on a product page.
 *
 * **The same calculator, not a second one.** This renders
 * `components/tools/load-calculator.tsx` — the component `/tools/load-calculator`
 * renders — which posts to `/api/sizing` and is answered by the recommendation
 * engine in `lib/sizing/recommend.ts` reading the published database catalogue.
 * Nothing here duplicates a formula, a constant, an appliance wattage or a
 * product; the only things this file adds are a heading and the sentences
 * around it.
 *
 * Two props are passed, both presentational:
 *
 *   `syncUrl={false}` — the standalone tool mirrors the working into the
 *   address bar, which on a product page would rewrite the URL to
 *   `/tools/load-calculator` the moment a shopper added an appliance and take
 *   them off the product they were reading.
 *
 *   `currentProductId` — lets the result say whether the product it arrived at
 *   is the one being viewed. It is never sent to the API. The recommendation is
 *   made from the load and the catalogue, exactly as it is on the tool page, so
 *   a product page cannot nominate itself and an answer of "something else" or
 *   "nothing" is reached and shown unchanged.
 */
export function ProductLoadCalculator({ product }: { product: Product }) {
  /**
   * Which of the two things this product is, for copy purposes only.
   *
   * The same allow-list the recommendation engine matches on, imported rather
   * than restated so the two cannot disagree about what a home battery is. It
   * decides which paragraph is printed and nothing else — the engine applies
   * its own barriers to this product regardless of what is written here.
   */
  const isHomeStorage = HOME_BACKUP_SUBCATEGORIES.has(product.subcategory);

  return (
    <section aria-labelledby="load-calculator-heading" className="mt-10 lg:mt-14">
      <div className="flex items-start gap-3">
        <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground sm:grid">
          <Calculator className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 id="load-calculator-heading" className="heading-3">
            Load Calculator
          </h2>

          {isHomeStorage ? (
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Check your home load and see which battery is suitable. Tick the appliances you
              want running during a cut and how long you need them for — the calculator sizes the
              requirement and checks it against what we actually stock, including whether{' '}
              <span className="font-medium text-foreground">{product.title}</span> is the right
              fit. If something else suits your load better, or if nothing we stock does, it says
              so.
            </p>
          ) : (
            /*
             * An EV pack's page gets the calculator with its scope stated
             * plainly, because the honest answer here is "this tool is not
             * about this product".
             *
             * `lib/sizing/recommend.ts` will not return a traction pack for a
             * home load under any input — the subcategory allow-list, the
             * product type and the fail-closed nominal-voltage table each
             * refuse it independently. So this section can never suggest this
             * battery, and copy that implied otherwise would be setting up a
             * result the engine is built to prevent.
             *
             * There is no vehicle sizing here and none is implied: the
             * repository holds no vehicle compatibility data, which is why the
             * EV selector is still a deferred item rather than a guess.
             */
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              This calculator sizes a{' '}
              <span className="font-medium text-foreground">home backup</span> battery — lights,
              fans, a fridge during a power cut. It does not size a traction pack for a vehicle,
              and it will not suggest{' '}
              <span className="font-medium text-foreground">{product.title}</span> for a household
              load: an EV pack runs at a voltage no home inverter accepts. For which vehicles this
              pack fits, confirm the controller, charger and connector with our team.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6">
        {/* `useSearchParams` inside the calculator opts its subtree out of
            prerendering, so the boundary is required here exactly as it is on
            the tool page. */}
        <Suspense
          fallback={
            <div className="grid gap-8 lg:grid-cols-12">
              <Skeleton className="h-[28rem] w-full lg:col-span-7" />
              <Skeleton className="h-[22rem] w-full lg:col-span-5" />
            </div>
          }
        >
          <LoadCalculator syncUrl={false} currentProductId={product.id} />
        </Suspense>
      </div>
    </section>
  );
}
