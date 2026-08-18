import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { SupportShell } from '@/components/support/support-shell';
import { SupportForm, type FormFieldSpec } from '@/components/support/support-form';

export const metadata: Metadata = {
  title: 'Register a complaint',
  description:
    'Log a fault with your iTarang inverter, battery or UPS and have a technician assigned from the service network covering your pincode.',
  alternates: { canonical: '/support/complaint' },
};

const FIELDS: FormFieldSpec[] = [
  { name: 'name', label: 'Your name', type: 'text', required: true },
  { name: 'phone', label: 'Mobile number', type: 'tel', required: true },
  { name: 'email', label: 'Email address', type: 'email' },
  { name: 'pincode', label: 'Pincode', type: 'pincode', required: true },
  { name: 'model', label: 'Model name', type: 'text', required: true, placeholder: 'e.g. TallTube 150' },
  { name: 'serial', label: 'Serial number', type: 'text', required: true },
  {
    name: 'issue',
    label: 'What is the problem',
    type: 'select',
    required: true,
    options: [
      'Backup time has dropped',
      'Not charging',
      'No output on battery',
      'Unit is beeping or showing a fault',
      'Physical damage or leakage',
      'Installation issue',
      'Something else',
    ],
  },
  {
    name: 'startedOn',
    label: 'When did it start',
    type: 'date',
  },
  {
    name: 'description',
    label: 'Describe what is happening',
    type: 'textarea',
    required: true,
    placeholder:
      'What you observe, when it happens, and anything that changed recently — new appliances, a power surge, a recent service visit.',
  },
];

export default function ComplaintPage() {
  return (
    <SupportShell
      title="Register a complaint"
      intro="Tell us what is wrong and we will assign a technician from the service network covering your pincode. The more specific the description, the more likely the first visit fixes it."
      current="/support/complaint"
    >
      <div className="rounded-xl border border-warning/40 bg-warning-soft p-4">
        <p className="flex items-start gap-2 text-sm font-semibold text-foreground">
          <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-warning" />
          If you can smell burning, see smoke, or a battery is leaking
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Switch the system off at the mains, disconnect the battery if it is safe to do so, keep
          the area ventilated, and call us rather than using this form.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="heading-3">Complaint details</h2>
        <div className="mt-6">
          <SupportForm
            fields={FIELDS}
            submitLabel="Register complaint"
            successTitle="Complaint details prepared"
            successBody="Once the service desk has your details, you receive a reference number you can quote on any follow-up call."
          />
        </div>
      </div>

      <section className="mt-8 rounded-xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="heading-3">Before you log a fault</h2>
        <div className="rich-text mt-3">
          <p>
            Two things account for most reported faults, and both are quick to check yourself.
          </p>
          <h3>Backup time has dropped</h3>
          <p>
            On a flooded lead acid battery, check the electrolyte level first — the float indicators
            on each cell show when a cell needs distilled water. Capacity also falls naturally as a
            battery ages, faster if it is regularly discharged deeply.
          </p>
          <h3>The inverter switches to battery too often</h3>
          <p>
            This is usually the grid, not the inverter. If your supply frequently dips below the
            input window, the unit is doing exactly what it should. Our engineers can confirm from
            the fault log during a visit.
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
