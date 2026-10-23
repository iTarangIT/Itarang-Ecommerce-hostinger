import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import { toggleCampaignAction } from '@/lib/admin/campaign-actions';
import { formatPrice } from '@/lib/catalog/pricing';
import { describeRestrictions, type Campaign } from '@/lib/offers/campaigns';
import { listCampaigns, redemptionCounts } from '@/lib/offers/campaign-store';
import { Button, ButtonLink } from '@/components/ui/button';
import { Notice } from '@/components/admin/service-nav';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Campaigns',
  robots: { index: false, follow: false },
};

function discountOf(campaign: Campaign): string {
  if (campaign.kind === 'flat') return `${formatPrice(campaign.value)} off`;
  if (campaign.kind === 'percent') {
    const cap = campaign.maxDiscount ? ` (up to ${formatPrice(campaign.maxDiscount)})` : '';
    return `${campaign.value}% off${cap}`;
  }
  return 'Free delivery';
}

function statusOf(campaign: Campaign, now: Date): { label: string; live: boolean } {
  if (!campaign.isActive) return { label: 'Paused', live: false };
  if (campaign.startsAt && now < campaign.startsAt) return { label: 'Scheduled', live: false };
  if (campaign.endsAt && now >= campaign.endsAt) return { label: 'Ended', live: false };
  return { label: 'Live', live: true };
}

/**
 * Coupon campaigns. Each is a code a customer types in the cart, with its own
 * discount, dates, limits and who-can-use-it rules. The discount is always
 * worked out again on the server when the order is placed.
 */
export default async function AdminCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const search = await searchParams;
  const [campaigns, uses] = await Promise.all([listCampaigns(), redemptionCounts()]);
  const now = new Date();

  return (
    <div className="container py-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Orders
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="heading-2">Campaigns</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Coupon codes and their rules. One code per order; the ₹200 UPI discount still applies on
            top. Pausing a code stops it at once, including in carts that already have it.
          </p>
        </div>
        <ButtonLink href="/admin/campaigns/new" size="sm">
          <Plus className="h-4 w-4" />
          New campaign
        </ButtonLink>
      </div>
      <Notice text={search.notice} />
      <Notice text={search.error} tone="error" />

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[48rem] border-collapse text-sm">
          <thead>
            <tr className="bg-surface text-left">
              <th scope="col" className="px-4 py-2.5 font-display font-semibold">
                Code
              </th>
              <th scope="col" className="px-4 py-2.5 font-display font-semibold">
                Discount
              </th>
              <th scope="col" className="px-4 py-2.5 font-display font-semibold">
                Rules
              </th>
              <th scope="col" className="px-4 py-2.5 font-display font-semibold">
                Uses
              </th>
              <th scope="col" className="px-4 py-2.5 font-display font-semibold">
                Status
              </th>
              <th scope="col" className="px-4 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => {
              const status = statusOf(campaign, now);
              // Negative ids are the built-in fallback codes (no campaigns table yet).
              const editable = campaign.id > 0;
              return (
                <tr key={campaign.code} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    {editable ? (
                      <Link
                        href={`/admin/campaigns/${campaign.id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {campaign.code}
                      </Link>
                    ) : (
                      <span className="font-semibold">{campaign.code}</span>
                    )}
                    <span className="block text-xs text-muted-foreground">{campaign.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    {discountOf(campaign)}
                    {campaign.minCart ? (
                      <span className="block text-xs text-muted-foreground">
                        Min. {formatPrice(campaign.minCart)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {describeRestrictions(campaign).join(' · ') || 'Anyone'}
                  </td>
                  <td className="tabular px-4 py-3">
                    {uses.get(campaign.code) ?? 0}
                    {campaign.maxRedemptionsTotal ? ` / ${campaign.maxRedemptionsTotal}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        status.live ? 'bg-success-soft text-success' : 'bg-secondary text-muted-foreground',
                      )}
                    >
                      {status.label}
                    </span>
                    {campaign.showOnSite ? (
                      <span className="mt-1 block text-xs text-muted-foreground">On the site</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editable ? (
                      <form action={toggleCampaignAction}>
                        <input type="hidden" name="id" value={campaign.id} />
                        <input type="hidden" name="active" value={campaign.isActive ? 'false' : 'true'} />
                        <Button type="submit" size="sm" variant="outline">
                          {campaign.isActive ? 'Pause' : 'Switch on'}
                        </Button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  No campaigns yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
