'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { currentUser } from '@/lib/auth/session';
import { addressSchema, contactSchema, fieldErrors, gstinSchema } from '@/lib/checkout/validation';
import { orders } from '@/lib/orders/postgres-repository';
import { placeStaffOrder, sendPaymentLink } from '@/lib/orders/staff-order';
import { markCalled } from './callbacks';

/**
 * Admin → New order (R-18) and the Call-backs tick (R-13). The admin check is
 * repeated in each action for the reason `actions.ts` gives: a Server Action is
 * its own endpoint.
 */

async function requireAdminActor(): Promise<string> {
  const user = await currentUser();
  if (!user || user.role !== 'admin') redirect('/login?next=%2Fadmin%2Forders%2Fnew');
  return user.email;
}

export interface StaffOrderFormState {
  error?: string;
  fields?: Record<string, string>;
}

const MAX_LINES = 10;

const staffOrderSchema = z.object({
  contact: contactSchema,
  address: addressSchema,
  gstin: gstinSchema.optional().or(z.literal('')),
  lines: z
    .array(z.object({ variantId: z.string().min(1).max(200), quantity: z.number().int().min(1).max(50) }))
    .min(1, 'Add at least one product.')
    .max(MAX_LINES),
});

/** Lines arrive as `variant_<n>` / `quantity_<n>` pairs; blank rows are skipped. */
function readLines(formData: FormData): Array<{ variantId: string; quantity: number }> {
  const byVariant = new Map<string, number>();
  for (let index = 0; index < MAX_LINES; index += 1) {
    const variantId = String(formData.get(`variant_${index}`) ?? '').trim();
    if (!variantId) continue;
    const quantity = Number(formData.get(`quantity_${index}`) ?? 1);
    // The same product picked twice is one line, not two reservations.
    byVariant.set(variantId, (byVariant.get(variantId) ?? 0) + (Number.isInteger(quantity) ? quantity : 0));
  }
  return [...byVariant].map(([variantId, quantity]) => ({ variantId, quantity }));
}

export async function createStaffOrderAction(
  _previous: StaffOrderFormState,
  formData: FormData,
): Promise<StaffOrderFormState> {
  const actor = await requireAdminActor();
  const text = (name: string) => String(formData.get(name) ?? '');

  const parsed = staffOrderSchema.safeParse({
    contact: { name: text('name'), phone: text('phone').replace(/\D/g, '').slice(-10), email: text('email') },
    address: {
      line1: text('line1'),
      line2: text('line2'),
      landmark: text('landmark'),
      city: text('city'),
      state: text('state'),
      pincode: text('pincode'),
    },
    gstin: text('gstin').trim().toUpperCase(),
    lines: readLines(formData),
  });
  if (!parsed.success) {
    return { error: 'Check the highlighted fields.', fields: fieldErrors(parsed.error) };
  }

  const result = await placeStaffOrder({
    actor,
    lines: parsed.data.lines,
    contact: parsed.data.contact,
    address: parsed.data.address,
    gstin: parsed.data.gstin || undefined,
  });
  if (!result.ok) return { error: result.message };

  revalidatePath('/admin');
  redirect(`/admin/orders/${result.order.orderNumber}?notice=${encodeURIComponent(result.message)}`);
}

/** Retry from the order page when the first link could not be created. */
export async function sendPaymentLinkAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const orderNumber = String(formData.get('orderNumber') ?? '');
  const back = `/admin/orders/${orderNumber}`;

  const order = await orders().findByOrderNumber(orderNumber);
  if (!order) return;

  const sent = await sendPaymentLink(order, actor);
  revalidatePath(back);
  redirect(`${back}?notice=${encodeURIComponent(sent.message)}`);
}

/** The "Called" tick on Admin → Call-backs (R-13). */
export async function markCalledAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user || user.role !== 'admin') redirect('/login?next=%2Fadmin%2Fcallbacks');

  const kind = formData.get('kind') === 'account' ? 'account' : 'order';
  const subjectId = Number(formData.get('subjectId'));
  const note = String(formData.get('note') ?? '').trim().slice(0, 500) || undefined;
  if (!Number.isSafeInteger(subjectId) || subjectId <= 0) return;

  await markCalled({ kind, subjectId, calledBy: user.email, note });
  revalidatePath('/admin/callbacks');
  redirect(`/admin/callbacks?notice=${encodeURIComponent('Marked as called.')}`);
}
