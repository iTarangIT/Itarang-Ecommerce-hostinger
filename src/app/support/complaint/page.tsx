import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { SupportShell } from '@/components/support/support-shell';
import { SupportForm } from '@/components/support/support-form';

export const metadata: Metadata = {
  title: 'Register a complaint',
  description:
    'Report a fault with your Trontek battery or charger bought from iTarang and get a reference number straight away.',
  alternates: { canonical: '/support/complaint' },
};

export default function ComplaintPage() {
  return (
    <SupportShell
      title="Register a complaint"
      intro="Tell us what is wrong and you get a reference number straight away. Our team calls you within one working day. The more specific the description, the faster it is fixed."
      current="/support/complaint"
    >
      <div className="rounded-xl border border-warning/40 bg-warning-soft p-4">
        <p className="flex items-start gap-2 text-sm font-semibold text-foreground">
          <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-warning" />
          If a battery is swelling, smoking, unusually hot or smells of burning
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Stop charging, disconnect it if it is safe to do so, move people away, and call us rather
          than using this form.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="heading-3">Complaint details</h2>
        <div className="mt-6">
          <SupportForm
            kind="complaint"
            submitLabel="Register complaint"
            successTitle="Complaint registered"
            successBody="Quote this reference whenever you contact us. If you gave an email address, a copy is on its way."
          />
        </div>
      </div>

      <section className="mt-8 rounded-xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="heading-3">Before you log a fault</h2>
        <div className="rich-text mt-3">
          <h3>The battery is not charging</h3>
          <p>
            Check that the charger is the one made for this pack’s voltage, that both connectors
            are fully seated, and that the charger’s indicator light comes on. A battery protects
            itself by switching off when it is very deeply discharged; leave it on the correct
            charger for an hour before concluding it is faulty.
          </p>
          <h3>Range or backup time has dropped</h3>
          <p>
            Range falls with heavier loads, hills, low tyre pressure and cold weather, and capacity
            reduces slowly with age. A sudden large drop is worth reporting.
          </p>
          <p>
            Still not right?{' '}
            <Link href="/support/faq" className="font-medium text-primary underline-offset-4 hover:underline">
              Read the full FAQ
            </Link>{' '}
            or log the fault above.
          </p>
        </div>
      </section>
    </SupportShell>
  );
}
