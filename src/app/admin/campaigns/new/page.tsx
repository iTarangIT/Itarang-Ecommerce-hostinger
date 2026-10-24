import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createCampaignAction } from '@/lib/admin/campaign-actions';
import { loadCategoryOptions } from '@/lib/catalog/category-store';
import { CampaignForm } from '@/components/admin/campaign-form';
import { Notice } from '@/components/admin/service-nav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'New campaign',
  robots: { index: false, follow: false },
};

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const categories = await loadCategoryOptions();

  return (
    <div className="container max-w-3xl py-8">
      <Link
        href="/admin/campaigns"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Campaigns
      </Link>
      <h1 className="heading-2 mt-4">New campaign</h1>
      <Notice text={error} tone="error" />
      <CampaignForm
        campaign={null}
        categories={categories}
        action={createCampaignAction}
        submitLabel="Create campaign"
      />
    </div>
  );
}
