import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';
import { SupportShell } from '@/components/support/support-shell';
import { SupportForm, type FormFieldSpec } from '@/components/support/support-form';

export const metadata: Metadata = {
  title: 'Book an installation',
  description:
    'Book a certified iTarang technician to install and commission your inverter, battery or combo.',
  alternates: { canonical: '/support/installation' },
};

const FIELDS: FormFieldSpec[] = [
  { name: 'name', label: 'Your name', type: 'text', required: true },
  { name: 'phone', label: 'Mobile number', type: 'tel', required: true },
  { name: 'pincode', label: 'Installation pincode', type: 'pincode', required: true },
  { name: 'order', label: 'Order number', type: 'text', hint: 'If you have already ordered' },
  {
    name: 'product',
    label: 'What needs installing',
    type: 'select',
    required: true,
    options: [
      'Inverter only',
      'Battery only',
      'Inverter + battery',
      '24V or 48V battery bank',
      'Solar-ready system',
    ],
  },
  { name: 'preferredDate', label: 'Preferred date', type: 'date', required: true },
  {
    name: 'slot',
    label: 'Preferred slot',
    type: 'select',
    required: true,
    options: ['Morning (9 AM – 12 PM)', 'Afternoon (12 PM – 4 PM)', 'Evening (4 PM – 7 PM)'],
  },
  {
    name: 'address',
    label: 'Installation address',
    type: 'textarea',
    required: true,
    placeholder: 'Flat / house number, street, landmark, city',
  },
  {
    name: 'notes',
    label: 'Anything the technician should know',
    type: 'textarea',
    placeholder: 'Access constraints, existing wiring, where the battery will sit…',
  },
];

const WHAT_HAPPENS = [
  'The technician confirms the slot by phone the day before.',
  'Cabling is routed, the system is mounted and connections are torqued.',
  'The charger profile is set for your battery chemistry — tubular, flat plate or lithium.',
  'A load test is run before the technician leaves, and you are shown how to read the panel.',
];

export default function InstallationPage() {
  return (
    <SupportShell
      title="Book an installation"
      intro="Installation is included with iTarang inverters, batteries and combos. Pick a slot and a certified technician will install and commission the system."
      current="/support/installation"
    >
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="heading-3">Installation request</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          High-capacity systems from 2200VA upward, and any solar installation, need a short site
          survey first — we will arrange that before confirming the installation date.
        </p>
        <div className="mt-6">
          <SupportForm
            fields={FIELDS}
            submitLabel="Request this slot"
            successTitle="Installation request prepared"
            successBody="Slots are confirmed by phone once the service desk has assigned a technician for your pincode."
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
        <p className="mt-4 text-sm text-muted-foreground">
          A standard single-battery installation takes roughly 60–90 minutes. A 24V or 48V bank
          takes longer.
        </p>
      </section>
    </SupportShell>
  );
}
