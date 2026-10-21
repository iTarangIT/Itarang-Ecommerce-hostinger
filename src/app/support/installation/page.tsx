import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';
import { SupportShell } from '@/components/support/support-shell';
import { SupportForm } from '@/components/support/support-form';

export const metadata: Metadata = {
  title: 'Book an installation',
  description: 'Ask for help installing a Trontek home battery bought from iTarang.',
  alternates: { canonical: '/support/installation' },
};

const WHAT_HAPPENS = [
  'We call you to confirm the slot and check your inverter is lithium-ready.',
  'The battery is mounted and connected to the inverter’s battery input.',
  'The inverter’s charging setting is checked for a lithium battery.',
  'The system is tested on battery before the technician leaves.',
];

export default function InstallationPage() {
  return (
    <SupportShell
      title="Book an installation"
      intro="For home inverter batteries. Tell us your order and preferred time, and we will call to confirm. Whether installation is included in the price is stated on each product page."
      current="/support/installation"
    >
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="heading-3">Installation request</h2>
        <div className="mt-6">
          <SupportForm
            kind="installation"
            submitLabel="Request installation"
            successTitle="Installation request received"
            successBody="We call you to confirm the slot. Quote this reference if you need to change it."
          />
        </div>
      </div>

      <section className="mt-8 rounded-xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="heading-3">What happens on the day</h2>
        <ul className="mt-4 space-y-2.5">
          {WHAT_HAPPENS.map((step) => (
            <li key={step} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-success" />
              {step}
            </li>
          ))}
        </ul>
      </section>
    </SupportShell>
  );
}
