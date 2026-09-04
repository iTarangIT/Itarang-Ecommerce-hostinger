import { ShieldCheck } from 'lucide-react';
import type { Product } from '@/lib/commerce/types';

/**
 * "Product Specifications" — the trust line and the full attribute grid.
 *
 * Two columns of label-over-value pairs rather than the label-beside-value
 * table this replaced: in a narrow buy column a long value ("Over-current,
 * over-voltage, under-voltage, short circuit") has nowhere to go beside its
 * label, and setting it underneath lets both stay legible.
 *
 * Every specification the catalogue states is here, nothing is folded away.
 * Group titles survive only as quiet rules between blocks — they order the
 * list without competing with it.
 */
export function ProductSpecs({ product }: { product: Product }) {
  const care = product.careInstructions?.join(' ');
  // Read from the column, never from a specification row. `net_quantity` is a
  // structured product field the Information tab edits; it used to *also* exist
  // as a row in the "Product details" group written by the import, and the two
  // drifted the moment an administrator edited one of them — the admin read
  // "2 Count" while the product page still said "1 Count". `to-domain.ts` now
  // drops any stored row with this label so only this line can render it.
  const netQuantity = product.netQuantity;
  const hasSpecs = product.specGroups.some((group) => group.specs.length > 0);
  if (!care && !netQuantity && !hasSpecs) return null;

  return (
    <section aria-labelledby="specs-heading">
      <h2 id="specs-heading" className="heading-3">
        Product Specifications
      </h2>

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-50 text-accent-600">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">iTarang assured</span> — certified
            installation and a documented warranty on every product.
          </p>
        </div>

        <div className="px-4 py-1">
          {/* Care leads, as it does on the reference page: it is the one
              instruction a buyer has to follow rather than merely know. */}
          {care || netQuantity ? (
            <dl>
              {care ? <SpecPair label="Care instructions" value={care} /> : null}
              {netQuantity ? <SpecPair label="Net quantity" value={netQuantity} /> : null}
            </dl>
          ) : null}

          {product.specGroups.map((group) => (
            <div key={group.title}>
              <p className="border-b border-border pb-1.5 pt-4 text-2xs font-bold uppercase tracking-wide text-accent-600">
                {group.title}
              </p>
              {/* Three columns from `lg`. This table is the longest thing on
                  the page — around forty rows for a battery — and it now sits
                  at the full width of the container rather than in the narrow
                  column beside the gallery, so a third column costs no
                  legibility and takes roughly a third off its height. */}
              <dl className="grid sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-3 lg:gap-x-8">
                {group.specs.map((spec) => (
                  <SpecPair key={spec.label} label={spec.label} value={spec.value} />
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SpecPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border py-3 last:border-b-0">
      <dt className="text-xs font-medium text-accent-600">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold leading-snug text-foreground">{value}</dd>
    </div>
  );
}
