import type { Metadata } from 'next';
import { SupportShell } from '@/components/support/support-shell';
import { TechnicianLookup } from '@/components/support/technician-lookup';

export const metadata: Metadata = {
  title: 'Find a technician',
  description:
    'Check whether the iTarang service network covers your pincode, and book an installation or service visit.',
  alternates: { canonical: '/support/dealers' },
};

export default function DealersPage() {
  return (
    <SupportShell
      title="Find a technician"
      intro="Installation and service are carried out by certified technicians in our network. Check whether your pincode is covered before you book."
      current="/support/dealers"
    >
      <TechnicianLookup />

      <section className="mt-8 rounded-xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="heading-3">What a certified technician does</h2>
        <div className="rich-text mt-3">
          <p>
            Installation is more than mounting a box on a wall. The technician sizes and routes the
            cabling for the current the system will actually draw, sets the charger profile to match
            your battery chemistry, confirms the deep-discharge cut-off, and runs a load test before
            leaving.
          </p>
          <p>
            Getting the charger profile wrong is the single most common cause of premature battery
            failure — a lithium pack charged on a tubular profile will be undercharged, and a
            tubular battery on a lithium profile will be overcharged. It is worth having someone do
            it properly.
          </p>
          <h3>For service visits</h3>
          <p>
            Have your serial number and a description of the fault ready. If the system is showing a
            fault code, note it down — it usually tells the technician what to bring.
          </p>
        </div>
      </section>
    </SupportShell>
  );
}
