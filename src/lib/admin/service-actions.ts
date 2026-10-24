'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { CATALOG_TAG } from '@/lib/commerce/db/db-provider';
import { invalidateCatalogSnapshot } from '@/lib/commerce';
import {
  REVIEW_STATUSES,
  moderateReview,
  replyToReview,
  type ReviewStatus,
} from '@/lib/reviews/reviews';
import { DealerSheetError, planDealerImport, summariseDealerImport } from '@/lib/support/dealer-import';
import { MAX_DEALER_FILE_BYTES, readDealerFile } from '@/lib/support/dealer-workbook';
import { createDealer, createDealers, listDealerKeys, setDealerActive } from '@/lib/support/dealers';
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

/**
 * Back to the review list the admin was on — same tab, filters and page — so
 * working through a queue does not reset it after every click. Only a path
 * under /admin/reviews is accepted; anything else is the plain list.
 */
function doneReviews(formData: FormData, notice: string): never {
  const back = String(formData.get('back') ?? '');
  const target = /^\/admin\/reviews(\?[^#\s]*)?$/.test(back) ? back : '/admin/reviews';
  const url = new URL(target, 'http://admin.local');
  url.searchParams.set('notice', notice);
  revalidatePath('/admin/reviews');
  redirect(`${url.pathname}${url.search}`);
}

/** Ratings and replies ride on the cached catalogue snapshot, so purge it. */
function refreshStorefront(): void {
  invalidateCatalogSnapshot();
  revalidateTag(CATALOG_TAG);
}

export async function moderateReviewAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor('/admin/reviews');
  const id = Number(formData.get('id'));
  const status = String(formData.get('status') ?? '') as ReviewStatus;
  if (!Number.isInteger(id) || !REVIEW_STATUSES.includes(status)) return;

  await moderateReview(id, status, actor);
  // Publishing or hiding moves the stars on the product page.
  refreshStorefront();
  doneReviews(formData, status === 'published' ? 'Review published.' : `Review marked ${status}.`);
}

/** Post, change or (with empty text) remove the public "Response from iTarang". */
export async function replyToReviewAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor('/admin/reviews');
  const id = Number(formData.get('id'));
  const reply = String(formData.get('reply') ?? '').trim().slice(0, 2000);
  if (!Number.isInteger(id)) return;

  await replyToReview(id, reply, actor);
  refreshStorefront();
  doneReviews(formData, reply ? 'Reply saved.' : 'Reply removed.');
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

/**
 * Bulk upload from an Excel or CSV sheet. Duplicates — against the dealers on
 * file and within the sheet — are skipped and listed, never overwritten; the
 * rest are added in one transaction. See `dealer-import.ts` for the rules.
 */
export async function importDealersAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor('/admin/dealers');
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) done('/admin/dealers', 'Choose an Excel or CSV file to upload.');
  if (file.size > MAX_DEALER_FILE_BYTES) done('/admin/dealers', 'That file is too large (limit 5 MB).');

  let summary: string;
  try {
    const rows = await readDealerFile(await file.arrayBuffer(), file.name);
    const plan = planDealerImport(rows, await listDealerKeys());
    await createDealers(plan.toAdd, actor);
    summary = summariseDealerImport(plan);
  } catch (error) {
    if (error instanceof DealerSheetError) done('/admin/dealers', error.message);
    throw error;
  }
  revalidatePath('/support/dealers');
  done('/admin/dealers', summary);
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
