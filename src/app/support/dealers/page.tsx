import type { Metadata } from 'next';
import { MapPin, MessageCircle, Navigation, Phone, Search, Store, Wrench } from 'lucide-react';
import { SupportShell } from '@/components/support/support-shell';
import { Button } from '@/components/ui/button';
import { dealerCount, dialable, searchDealers } from '@/lib/support/dealers';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Find a dealer',
  description:
    'Find an iTarang dealer or service centre near you by pincode or city, with phone, WhatsApp and directions.',
  alternates: { canonical: '/support/dealers' },
};

export const dynamic = 'force-dynamic';

/**
 * Dealer and service-centre locator.
 *
 * A plain GET form, so a search is a shareable URL and works without
 * JavaScript. Until dealers are added in the admin console the page says so
 * and offers the phone line instead of an empty search box that can only fail.
 */
export default async function DealersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const term = q.trim().slice(0, 60);
  const [total, dealers] = await Promise.all([dealerCount(), searchDealers(term)]);

  return (
    <SupportShell
      title="Find a dealer"
      intro="Buy, fit and service your battery locally. Search by pincode or city for the nearest iTarang dealers and service centres."
      current="/support/dealers"
    >
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        {total === 0 ? (
          <div>
            <h2 className="heading-3">Our dealer list is coming soon</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Call us and we will put you in touch with the nearest dealer or service centre.
            </p>
            <a
              href={SITE.phoneHref}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              <Phone className="h-4 w-4" />
              {SITE.phone}
            </a>
          </div>
        ) : (
          <>
            <form method="get" className="flex max-w-lg gap-2" role="search">
              <label htmlFor="dealer-q" className="sr-only">
                Pincode or city
              </label>
              <div className="relative flex-1">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="dealer-q"
                  name="q"
                  defaultValue={term}
                  placeholder="Pincode or city, e.g. 122018 or Gurugram"
                  className="h-11 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm"
                />
              </div>
              <Button type="submit" variant="primary">
                <Search className="h-4 w-4" />
                Search
              </Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">
              {total} dealer{total === 1 ? '' : 's'} and service centres across India.
            </p>
          </>
        )}
      </div>

      {term && total > 0 ? (
        dealers.length === 0 ? (
          <p className="mt-6 rounded-lg border border-border bg-surface p-5 text-sm text-muted-foreground">
            No dealers found for “{term}”. Try a nearby city, or call us on{' '}
            <a href={SITE.phoneHref} className="font-medium text-primary">
              {SITE.phone}
            </a>
            .
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {dealers.map((dealer) => {
              const maps =
                dealer.latitude !== null && dealer.longitude !== null
                  ? `https://www.google.com/maps/dir/?api=1&destination=${dealer.latitude},${dealer.longitude}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${dealer.name} ${dealer.address} ${dealer.pincode}`)}`;
              return (
                <li key={dealer.id} className="flex flex-col rounded-lg border border-border bg-card p-4">
                  <p className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-primary-600">
                    {dealer.kind === 'service-centre' ? (
                      <Wrench className="h-3.5 w-3.5" />
                    ) : (
                      <Store className="h-3.5 w-3.5" />
                    )}
                    {dealer.kind === 'service-centre' ? 'Service centre' : 'Dealer'}
                  </p>
                  <p className="mt-1 font-display text-base font-semibold text-foreground">{dealer.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {dealer.address}, {dealer.city}, {dealer.state} {dealer.pincode}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    {dealer.phone ? (
                      <a
                        href={`tel:+${dialable(dealer.phone)}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary"
                      >
                        <Phone className="h-4 w-4" />
                        Call
                      </a>
                    ) : null}
                    {dealer.whatsapp ? (
                      <a
                        href={`https://wa.me/${dialable(dealer.whatsapp)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary"
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </a>
                    ) : null}
                    <a
                      href={maps}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary"
                    >
                      <Navigation className="h-4 w-4" />
                      Directions
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </SupportShell>
  );
}
