import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Calculator } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadCalculator } from '@/components/tools/load-calculator';
import { SupportTeaser } from '@/components/support/support-teaser';

export const metadata: Metadata = {
  title: 'Inverter & battery load calculator',
  description:
    'Work out the inverter VA and battery Ah your home needs from the appliances you actually run — and see the matching iTarang systems.',
  alternates: { canonical: '/tools/load-calculator' },
};

export default function LoadCalculatorPage() {
  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className="container py-6 sm:py-8">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Tools', href: '/tools/load-calculator' },
              { label: 'Load calculator' },
            ]}
          />
          <div className="mt-4 flex items-start gap-4">
            <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground sm:grid">
              <Calculator className="h-6 w-6" />
            </span>
            <div>
              <p className="eyebrow">Free sizing tool</p>
              <h1 className="heading-1 mt-1 text-balance">
                Size your inverter and battery properly
              </h1>
              <p className="mt-3 max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                Tick what you want running during a power cut and how long you need it for. We work
                out the inverter capacity and battery size, show the arithmetic, and take you to
                the iTarang systems that match. Nothing here needs an email address.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 lg:py-10">
        <Suspense
          fallback={
            <div className="grid gap-8 lg:grid-cols-12">
              <Skeleton className="h-[32rem] w-full lg:col-span-7" />
              <Skeleton className="h-[26rem] w-full lg:col-span-5" />
            </div>
          }
        >
          <LoadCalculator />
        </Suspense>
      </div>

      <SupportTeaser />
    </>
  );
}
