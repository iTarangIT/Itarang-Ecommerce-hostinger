import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { updateCampaignAction } from '@/lib/admin/campaign-actions';
import { loadCategoryOptions } from '@/lib/catalog/category-store';
import { campaignProductOptions } from '@/lib/offers/campaign-products';
import { findCampaignById } from '@/lib/offers/campaign-store';
import { CampaignForm } from '@/components/admin/campaign-form';
import { Notice } from '@/components/admin/service-nav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Edit campaign',
  robots: { index: false, follow: false },
};

export default async function EditCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const campaignId = Number(id);
  if (!Number.isInteger(campaignId) || campaignId <= 0) notFound();

  const [campaign, categories, products] = await Promise.all([
    findCampaignById(campaignId),
    loadCategoryOptions(),
    campaignProductOptions(),
  ]);
  if (!campaign) notFound();

  return (
    <div className="container max-w-3xl py-8">
      <Link
        href="/admin/campaigns"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Campaigns
      </Link>
      <h1 className="heading-2 mt-4">{campaign.code}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Changes apply from the next checkout. Orders already placed keep the discount they were
        given.
      </p>
      <Notice text={error} tone="error" />
      <CampaignForm
        campaign={campaign}
        categories={categories}
        products={products}
        action={updateCampaignAction}
        submitLabel="Save campaign"
      />
    </div>
  );
}
