import type { Metadata } from 'next';
import { Download, Upload } from 'lucide-react';
import { createDealerAction, importDealersAction, toggleDealerAction } from '@/lib/admin/service-actions';
import { listAllDealers } from '@/lib/support/dealers';
import { STATES } from '@/lib/checkout/validation';
import { Button, ButtonLink } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Notice, ServiceNav } from '@/components/admin/service-nav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dealers',
  robots: { index: false, follow: false },
};

export default async function AdminDealersPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const search = await searchParams;
  const dealers = await listAllDealers().catch(() => []);

  return (
    <div className="container py-8">
      <ServiceNav
        current="/admin/dealers"
        title="Dealers"
        description="The dealers and service centres customers find on the dealer locator. Hidden dealers stay here but do not appear on the site."
      />
      <Notice text={search.notice} />

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide">Upload many dealers</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              An Excel (.xlsx) or CSV sheet with the columns Name, Type, Address, City, State, Pincode,
              Phone, WhatsApp, Latitude, Longitude. Duplicates are skipped, not overwritten: the same
              phone number, or the same name at the same pincode, as a dealer already on file (hidden
              ones too) or a row above it in the sheet.
            </p>
            {/* `download` keeps the file route out of the client router, so the
                upload below still posts to this page — see bulk-pricing-form. */}
            <ButtonLink
              href="/admin/dealers/template"
              download
              prefetch={false}
              variant="outline"
              size="sm"
              className="mt-3"
            >
              <Download className="h-4 w-4" />
              Download the template
            </ButtonLink>
            <form action={importDealersAction} className="mt-4 flex flex-wrap items-center gap-3">
              <input
                type="file"
                name="file"
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                required
                className="max-w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-2 file:text-sm"
              />
              <Button type="submit" size="sm">
                <Upload className="h-4 w-4" />
                Upload
              </Button>
            </form>
          </section>

          <form action={createDealerAction} className="space-y-4 rounded-lg border border-border bg-card p-5">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide">Add a dealer</h2>
            <Field label="Name" htmlFor="name" required>
              <Input id="name" name="name" required placeholder="e.g. Sharma Battery House" />
            </Field>
            <Field label="Type" htmlFor="kind">
              <Select id="kind" name="kind" defaultValue="dealer">
                <option value="dealer">Dealer</option>
                <option value="service-centre">Service centre</option>
              </Select>
            </Field>
            <Field label="Address" htmlFor="address" required>
              <Textarea id="address" name="address" rows={2} required placeholder="Shop number, street, area" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City" htmlFor="city" required>
                <Input id="city" name="city" required placeholder="e.g. Gurugram" />
              </Field>
              <Field label="State" htmlFor="state" required>
                <Select id="state" name="state" required defaultValue="">
                  <option value="">Select…</option>
                  {STATES.map((state) => (
                    <option key={state.code} value={state.name}>
                      {state.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Pincode" htmlFor="pincode" required>
                <Input id="pincode" name="pincode" inputMode="numeric" maxLength={6} required placeholder="e.g. 122018" />
              </Field>
              <Field label="Phone" htmlFor="phone">
                <Input id="phone" name="phone" inputMode="tel" placeholder="e.g. 9876543210" />
              </Field>
              <Field label="WhatsApp" htmlFor="whatsapp">
                <Input id="whatsapp" name="whatsapp" inputMode="tel" placeholder="If different from phone" />
              </Field>
              <div />
              <Field label="Latitude" htmlFor="latitude" hint="Optional, for exact directions.">
                <Input id="latitude" name="latitude" inputMode="decimal" placeholder="e.g. 28.4231" />
              </Field>
              <Field label="Longitude" htmlFor="longitude">
                <Input id="longitude" name="longitude" inputMode="decimal" placeholder="e.g. 77.0522" />
              </Field>
            </div>
            <Button type="submit">Add dealer</Button>
          </form>
        </div>

        <section className="lg:col-span-7">
          <p className="text-sm text-muted-foreground">
            {dealers.length} dealer{dealers.length === 1 ? '' : 's'} on file.
          </p>
          {dealers.length > 0 ? (
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
              {dealers.map((dealer) => (
                <li key={dealer.id} className="flex flex-wrap items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      {dealer.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {dealer.kind === 'service-centre' ? 'Service centre' : 'Dealer'}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {dealer.address}, {dealer.city}, {dealer.state} {dealer.pincode}
                    </p>
                    {dealer.phone ? <p className="tabular text-sm text-muted-foreground">{dealer.phone}</p> : null}
                  </div>
                  <form action={toggleDealerAction}>
                    <input type="hidden" name="id" value={dealer.id} />
                    <input type="hidden" name="active" value={dealer.active ? 'false' : 'true'} />
                    <Button type="submit" size="sm" variant={dealer.active ? 'outline' : 'primary'}>
                      {dealer.active ? 'Hide' : 'Show'}
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
