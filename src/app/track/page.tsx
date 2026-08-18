import type { Metadata } from 'next';
import { Package } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { TrackForm } from '@/components/account/track-form';

export const metadata: Metadata = {
  title: 'Track your order',
  description: 'Follow your iTarang order from confirmation through delivery and installation.',
  alternates: { canonical: '/track' },
};

const STAGES = [
  { title: 'Order confirmed', detail: 'Payment received and the order is queued for dispatch.' },
  { title: 'Packed', detail: 'Batteries are crated and the inverter is boxed for transit.' },
  { title: 'Shipped', detail: 'Handed to the carrier with a tracking reference.' },
  { title: 'Out for delivery', detail: 'On the vehicle for delivery to your address.' },
  { title: 'Delivered', detail: 'Received at your address.' },
  { title: 'Installed', detail: 'Commissioned and load-tested by a certified technician.' },
];

export default function TrackPage() {
  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className="container py-6 sm:py-8">
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Track order' }]} />
          <div className="mt-4 flex items-start gap-4">
            <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-lg bg-card text-primary shadow-card sm:grid">
              <Package className="h-6 w-6" />
            </span>
            <div>
              <h1 className="heading-1 text-balance">Track your order</h1>
              <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                No account needed — your order number and the mobile number on the order are
                enough.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container grid gap-8 py-8 lg:grid-cols-12 lg:gap-10 lg:py-10">
        <div className="lg:col-span-7">
          <TrackForm />
        </div>

        <aside className="lg:col-span-5">
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <h2 className="heading-3">What each stage means</h2>
            <ol className="mt-5 space-y-0">
              {STAGES.map((stage, index) => (
                <li key={stage.title} className="relative flex gap-4 pb-6 last:pb-0">
                  {index < STAGES.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className="absolute left-[0.6875rem] top-6 h-full w-px bg-border"
                    />
                  ) : null}
                  <span className="relative z-10 mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-border bg-card">
                    <span className="tabular text-[0.625rem] font-bold text-muted-foreground">
                      {index + 1}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">
                      {stage.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {stage.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </>
  );
}
