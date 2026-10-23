'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import {
  CAMPAIGNS_TAG,
  campaignInputSchema,
  createCampaign,
  setCampaignActive,
  setCustomerType,
  updateCampaign,
} from '@/lib/offers/campaign-store';
import { CUSTOMER_TYPES } from '@/lib/offers/campaigns';

/**
 * Campaign management. Each action re-checks the admin role (a Server Action
 * is its own POST endpoint) and reports back on the query string, like the
 * rest of the console's plain forms.
 */

const BASE = '/admin/campaigns';

async function requireAdminActor(back: string): Promise<string> {
  const user = await currentUser();
  if (!user || user.role !== 'admin') redirect(`/login?next=${encodeURIComponent(back)}`);
  return user.email;
}

function parse(formData: FormData) {
  return campaignInputSchema.safeParse({
    ...Object.fromEntries(formData),
    isActive: formData.get('isActive') === 'on',
    showOnSite: formData.get('showOnSite') === 'on',
    firstOrderOnly: formData.get('firstOrderOnly') === 'on',
    categories: formData.getAll('categories').join(','),
    subcategories: formData.getAll('subcategories').join(','),
    customerTypes: formData.getAll('customerTypes').join(','),
    states: formData.getAll('states').join(','),
  });
}

/** The storefront lists live campaigns on /offers and the home page. */
function refreshStorefront(): void {
  revalidateTag(CAMPAIGNS_TAG);
  revalidatePath(BASE);
  revalidatePath('/offers');
  revalidatePath('/', 'layout');
}

export async function createCampaignAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor(`${BASE}/new`);
  const parsed = parse(formData);
  if (!parsed.success) {
    redirect(`${BASE}/new?error=${encodeURIComponent(parsed.error.issues.map((i) => i.message).join(' '))}`);
  }
  const result = await createCampaign(parsed.data, actor);
  if (!result.ok) redirect(`${BASE}/new?error=${encodeURIComponent(result.error)}`);
  refreshStorefront();
  redirect(`${BASE}?notice=${encodeURIComponent(`Campaign ${parsed.data.code} created.`)}`);
}

export async function updateCampaignAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const back = `${BASE}/${id}`;
  const actor = await requireAdminActor(back);
  if (!Number.isInteger(id) || id <= 0) redirect(BASE);
  const parsed = parse(formData);
  if (!parsed.success) {
    redirect(`${back}?error=${encodeURIComponent(parsed.error.issues.map((i) => i.message).join(' '))}`);
  }
  const result = await updateCampaign(id, parsed.data, actor);
  if (!result.ok) redirect(`${back}?error=${encodeURIComponent(result.error)}`);
  refreshStorefront();
  redirect(`${BASE}?notice=${encodeURIComponent(`Campaign ${parsed.data.code} saved.`)}`);
}

export async function toggleCampaignAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor(BASE);
  const id = Number(formData.get('id'));
  const active = formData.get('active') === 'true';
  if (!Number.isInteger(id) || id <= 0) redirect(BASE);
  await setCampaignActive(id, active, actor);
  refreshStorefront();
  redirect(`${BASE}?notice=${encodeURIComponent(active ? 'Campaign switched on.' : 'Campaign paused.')}`);
}

/** Set on /admin/customers/[userId]; used by campaigns limited to a customer type. */
export async function setCustomerTypeAction(formData: FormData): Promise<void> {
  const userId = Number(formData.get('userId'));
  const back = `/admin/customers/${userId}`;
  await requireAdminActor(back);
  if (!Number.isInteger(userId) || userId <= 0) redirect('/admin/customers');
  const raw = String(formData.get('customerType') ?? '');
  const type = (CUSTOMER_TYPES as readonly string[]).includes(raw) ? raw : null;
  await setCustomerType(userId, type);
  revalidatePath(back);
  redirect(`${back}?notice=${encodeURIComponent('Customer type saved.')}`);
}
