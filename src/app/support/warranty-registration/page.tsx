import type { Metadata } from 'next';
import { SupportShell } from '@/components/support/support-shell';
import { SupportForm } from '@/components/support/support-form';

export const metadata: Metadata = {
  title: 'Register your warranty',
  description:
    'Register your Trontek battery’s serial number so a future warranty claim never depends on finding the original invoice.',
  alternates: { canonical: '/support/warranty-registration' },
};

export default function WarrantyRegistrationPage() {
  return (
    <SupportShell
      title="Register your warranty"
      intro="Registration is not mandatory — your warranty is valid either way. It means a future claim only needs your serial number and mobile number, not the original invoice."
      current="/support/warranty-registration"
    >
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="heading-3">Battery details</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Takes about a minute. The model and serial number are on the label on the side or top of
          the battery.
        </p>
        <div className="mt-6">
          <SupportForm
            kind="warranty"
            submitLabel="Register warranty"
            successTitle="Warranty registered"
            successBody="Keep this reference. A future claim needs only the reference or your serial number and mobile number."
          />
        </div>
      </div>

      <section className="mt-8 rounded-xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="heading-3">What the warranty covers</h2>
        <div className="rich-text mt-3">
          <p>
            The warranty period is stated on every product page in Trontek’s own words — for
            example, 3 years or 1200 cycles on the LiEV e-rickshaw packs, whichever comes first. It
            runs from the date of purchase.
          </p>
          <p>
            It covers manufacturing defects and performance against the rated specification. It
            does not cover physical damage, water damage, a battery that has been opened, or
            charging with a charger not rated for the pack.
          </p>
        </div>
      </section>
    </SupportShell>
  );
}
