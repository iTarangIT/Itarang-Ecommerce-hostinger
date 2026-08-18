import type { Metadata } from 'next';
import { SupportShell } from '@/components/support/support-shell';
import { SupportForm, type FormFieldSpec } from '@/components/support/support-form';

export const metadata: Metadata = {
  title: 'Register your warranty',
  description:
    'Record your iTarang serial number so a future warranty claim never depends on finding the original invoice.',
  alternates: { canonical: '/support/warranty-registration' },
};

const FIELDS: FormFieldSpec[] = [
  { name: 'name', label: 'Your name', type: 'text', required: true },
  { name: 'phone', label: 'Mobile number', type: 'tel', required: true, hint: '10 digits, no country code' },
  { name: 'email', label: 'Email address', type: 'email', required: true },
  { name: 'pincode', label: 'Installation pincode', type: 'pincode', required: true },
  {
    name: 'product',
    label: 'Product type',
    type: 'select',
    required: true,
    options: ['Inverter', 'Battery', 'UPS', 'Inverter + battery combo'],
  },
  { name: 'model', label: 'Model name', type: 'text', required: true, placeholder: 'e.g. Sine Pro 900' },
  {
    name: 'serial',
    label: 'Serial number',
    type: 'text',
    required: true,
    hint: 'On the label on the back or underside of the unit',
    maxLength: 32,
  },
  { name: 'purchaseDate', label: 'Date of purchase', type: 'date', required: true },
  { name: 'invoice', label: 'Invoice or order number', type: 'text' },
];

export default function WarrantyRegistrationPage() {
  return (
    <SupportShell
      title="Register your warranty"
      intro="Registration is not mandatory — your warranty is valid either way. It simply means a future claim never depends on locating the original invoice."
      current="/support/warranty-registration"
    >
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="heading-3">Product details</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Takes about a minute. The serial number is on the label on the back or underside of the
          unit; on batteries it is on the top face beside the terminals.
        </p>
        <div className="mt-6">
          <SupportForm
            fields={FIELDS}
            submitLabel="Register warranty"
            successTitle="Warranty details captured"
            successBody="Keep a copy of these details. Once you have registered, a claim only needs your serial number and mobile number."
          />
        </div>
      </div>

      <section className="mt-8 rounded-xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="heading-3">What the warranty covers</h2>
        <div className="rich-text mt-3">
          <p>
            Warranty length varies by product and is stated on every product page — 24 or 36 months
            on inverters, 36 to 48 months on tubular batteries and 60 months on lithium. Cover runs
            from the date of installation.
          </p>
          <p>
            Cover includes manufacturing defects and performance against the rated specification.
            It does not extend to damage from incorrect installation by a third party, physical
            damage, or use outside the stated operating conditions.
          </p>
        </div>
      </section>
    </SupportShell>
  );
}
