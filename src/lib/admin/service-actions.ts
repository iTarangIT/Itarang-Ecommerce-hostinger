'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { CATALOG_TAG } from '@/lib/commerce/db/db-provider';
import { invalidateCatalogSnapshot } from '@/lib/commerce';
import { moderateReview, type ReviewStatus } from '@/lib/reviews/reviews';
import { createDealer, setDealerActive } from '@/lib/support/dealers';
import { updateSupportRequest, type SupportRequestStatus } from '@/lib/support/requests';
import { parseCoverageCsv, upsertCoverage } from '@/lib/support/serviceability-server';

/**
 * Admin actions for the Service area: support requests, review moderation,
 * delivery coverage and dealers.
 *
 * Each re-checks the admin role — a Server Action is its own POST endpoint and
 * the admin layout's guard does not protect it — and reports back on the query
 * string, like the rest of the console's plain forms.
 */

async function requireAdminActor(back: string): Promise<string> {
  const user = await currentUser();
  if (!user || user.role !== 'admin') redirect(`/login?next=${encodeURIComponent(back)}`);
  return user.email;
}

function done(path: string, notice: string): never {
  revalidatePath(path);
  redirect(`${path}?notice=${encodeURIComponent(notice)}`);
}

/* ---------------------------------------------------------------- support */

const REQUEST_STATUSES = new Set<SupportRequestStatus>(['open', 'in_progress', 'resolved', 'closed']);

export async function updateSupportRequestAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor('/admin/support');
  const id = Number(formData.get('id'));
  const status = String(formData.get('status') ?? '') as SupportRequestStatus;
  const note = String(formData.get('adminNote') ?? '').trim().slice(0, 2000);
  if (!Number.isInteger(id) || !REQUEST_STATUSES.has(status)) return;

  await updateSupportRequest(id, { status, adminNote: note || undefined }, actor);
  done('/admin/support', 'Request updated.');
}

/* ---------------------------------------------------------------- reviews */

const REVIEW_STATUSES = new Set<ReviewStatus>(['pending', 'published', 'hidden']);

export async function moderateReviewAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor('/admin/reviews');
  const id = Number(formData.get('id'));
  const status = String(formData.get('status') ?? '') as ReviewStatus;
  if (!Number.isInteger(id) || !REVIEW_STATUSES.has(status)) return;

  await moderateReview(id, status, actor);
  // Ratings ride on the cached catalogue snapshot, so publishing or hiding a
  // review has to purge it, or the stars on the product page would not move.
  invalidateCatalogSnapshot();
  revalidateTag(CATALOG_TAG);
  done('/admin/reviews', status === 'published' ? 'Review published.' : `Review marked ${status}.`);
}

/* --------------------------------------------------------------- coverage */

/** About 5 MB of CSV — every pincode in India is roughly 19,000 rows. */
const MAX_CSV_BYTES = 5 * 1024 * 1024;

export async function importCoverageAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor('/admin/coverage');
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    done('/admin/coverage', 'Choose a CSV file to upload.');
  }
  if (file.size > MAX_CSV_BYTES) done('/admin/coverage', 'That file is too large (limit 5 MB).');

  const { rows, rejected } = parseCoverageCsv(await file.text());
  if (rows.length === 0) {
    done('/admin/coverage', 'No valid rows found. Check the column order: pincode, city, state, delivery_days.');
  }

  const written = await upsertCoverage(rows, actor);
  const skipped = rejected.length
    ? ` ${rejected.length} line${rejected.length === 1 ? '' : 's'} skipped (${rejected.slice(0, 10).join(', ')}${rejected.length > 10 ? '…' : ''}).`
    : '';
  done('/admin/coverage', `${written} pincode${written === 1 ? '' : 's'} saved.${skipped}`);
}

/* ---------------------------------------------------------------- dealers */

function text(formData: FormData, key: string, max = 200): string {
  return String(formData.get(key) ?? '').trim().slice(0, max);
}

function coordinate(value: string, limit: number): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

export async function createDealerAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor('/admin/dealers');
  const pincode = text(formData, 'pincode', 6);
  const input = {
    name: text(formData, 'name', 160),
    kind: text(formData, 'kind') === 'service-centre' ? ('service-centre' as const) : ('dealer' as const),
    address: text(formData, 'address', 400),
    city: text(formData, 'city', 80),
    state: text(formData, 'state', 80),
    pincode,
    phone: text(formData, 'phone', 20) || null,
    whatsapp: text(formData, 'whatsapp', 20) || null,
    latitude: coordinate(text(formData, 'latitude', 20), 90),
    longitude: coordinate(text(formData, 'longitude', 20), 180),
  };

  if (!input.name || !input.address || !input.city || !input.state) {
    done('/admin/dealers', 'Name, address, city and state are required.');
  }
  if (!/^[1-9]\d{5}$/.test(pincode)) done('/admin/dealers', 'Enter a valid 6-digit pincode.');

  await createDealer(input, actor);
  revalidatePath('/support/dealers');
  done('/admin/dealers', `${input.name} added.`);
}

export async function toggleDealerAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor('/admin/dealers');
  const id = Number(formData.get('id'));
  const active = formData.get('active') === 'true';
  if (!Number.isInteger(id)) return;

  await setDealerActive(id, active, actor);
  revalidatePath('/support/dealers');
  done('/admin/dealers', active ? 'Dealer shown again.' : 'Dealer hidden from the locator.');
}
