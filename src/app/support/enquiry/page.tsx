import type { Metadata } from 'next';
import { SupportShell } from '@/components/support/support-shell';
import { SupportForm } from '@/components/support/support-form';

export const metadata: Metadata = {
  title: 'Send an enquiry',
  description: 'Ask the iTarang team which battery suits your home, vehicle or business.',
  alternates: { canonical: '/support/enquiry' },
};

/** A query value, trimmed to what the form field accepts. */
function param(value: string | string[] | undefined, max: number): string | undefined {
  const text = (Array.isArray(value) ? value[0] : value)?.trim();
  return text ? text.slice(0, max) : undefined;
}

/**
 * "Send an enquiry", reached from every load-calculator result (R-06). The
 * calculator passes the product it showed and the load it sized, so the team
 * calls back knowing what the shopper saw.
 */
export default async function EnquiryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const initialValues: Record<string, string> = {};
  const product = param(query.product, 160);
  const requirement = param(query.load, 2000);
  if (product) initialValues.product = product;
  if (requirement) initialValues.requirement = requirement;

  return (
    <SupportShell
      title="Send an enquiry"
      intro="Tell us what you need to run and for how long. Our team calls you back within one working day with the battery that fits — or the nearest we can offer."
      current="/support/enquiry"
    >
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="heading-3">Your enquiry</h2>
        <div className="mt-6">
          <SupportForm
            kind="enquiry"
            submitLabel="Send enquiry"
            successTitle="Enquiry received"
            successBody="Our team will call you within one working day. Quote this reference if you call us first."
            initialValues={initialValues}
          />
        </div>
      </div>
    </SupportShell>
  );
}
