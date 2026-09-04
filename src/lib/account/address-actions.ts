'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { currentUser } from '@/lib/auth/session';
import { LIMITS, consume } from '@/lib/security/rate-limit';
import { PhoneInUseError, updateProfile } from '@/lib/auth/users';
import { fieldErrors } from '@/lib/checkout/validation';
import { profileSchema, savedAddressSchema } from './address-validation';
import {
  DuplicateAddressError,
  addAddress,
  archiveAddress,
  setDefaultAddress,
  updateAddress,
} from './addresses';

/**
 * The address book and profile, as Server Actions.
 *
 * Server Actions rather than route handlers, which gets Next.js's built-in
 * Origin↔Host check without any CSRF token plumbing — the same reason the auth
 * actions are written this way.
 *
 * **Authorization is re-read here, on every call, and never passed in.** Each
 * action calls `currentUser()` itself and hands the resulting id to the data
 * layer, where every statement filters on it. A `userId` accepted from the form
 * would be an invitation to edit somebody else's address book by changing a
 * number in a request, and no amount of care in the UI would fix that. There is
 * no code path here in which the caller chooses whose rows are touched.
 *
 * Ids that do not belong to the caller are answered the same way as ids that do
 * not exist. Distinguishing them would confirm that a row exists and belongs to
 * somebody, which is a small leak with no upside.
 */

export type AccountFormState =
  | { ok: true; message?: string }
  | { ok: false; error: string; fields?: Record<string, string> }
  | null;

const NOT_YOURS: AccountFormState = {
  ok: false,
  error: 'That address could not be found.',
};

const THROTTLED: AccountFormState = {
  ok: false,
  error: 'Too many changes just now. Please wait a moment and try again.',
};

const SIGNED_OUT: AccountFormState = {
  ok: false,
  error: 'Your session has ended. Sign in again to make changes.',
};

/** Address ids are `bigserial`; anything else never reaches a query. */
const addressIdSchema = z.coerce.number().int().positive();

/**
 * The caller, plus their rate-limit slot.
 *
 * Returns null rather than redirecting: these actions are posted from a form
 * on a page the visitor is already looking at, so a thrown redirect would
 * replace an inline "you have been signed out" with a jump they did not ask
 * for while their typing is still in the field.
 */
async function actor(): Promise<{ id: number } | null> {
  const user = await currentUser();
  return user ? { id: user.id } : null;
}

/** Every listing that could show stale rows after a write. */
function refreshAccount(): void {
  revalidatePath('/account');
}

/* --------------------------------------------------------------- profile */

export async function updateProfileAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await actor();
  if (!user) return SIGNED_OUT;

  const limit = await consume(`account:${user.id}`, LIMITS.accountUpdate);
  if (!limit.allowed) return THROTTLED;

  const parsed = profileSchema.safeParse({
    fullName: formData.get('fullName'),
    phone: formData.get('phone') ?? '',
  });
  if (!parsed.success) {
    return { ok: false, error: 'Check the details below.', fields: fieldErrors(parsed.error) };
  }

  try {
    await updateProfile(user.id, {
      fullName: parsed.data.fullName,
      phone: parsed.data.phone || null,
    });
  } catch (error) {
    // One number, one account — the constraint that makes phone usable as a
    // sign-in identifier later. Reported against the field that caused it.
    if (error instanceof PhoneInUseError) {
      return { ok: false, error: error.message, fields: { phone: error.message } };
    }
    throw error;
  }

  refreshAccount();
  return { ok: true, message: 'Your details have been saved.' };
}

/* ------------------------------------------------------------- addresses */

/** Shared parse for the add and edit forms, which post identical fields. */
function parseAddress(formData: FormData) {
  return savedAddressSchema.safeParse({
    line1: formData.get('line1'),
    line2: formData.get('line2') ?? '',
    landmark: formData.get('landmark') ?? '',
    city: formData.get('city'),
    state: formData.get('state'),
    pincode: formData.get('pincode'),
    recipientName: formData.get('recipientName'),
    recipientPhone: formData.get('recipientPhone'),
    isDefault: formData.get('isDefault') === 'on' || formData.get('isDefault') === 'true',
  });
}

export async function addAddressAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await actor();
  if (!user) return SIGNED_OUT;

  const limit = await consume(`account:${user.id}`, LIMITS.accountUpdate);
  if (!limit.allowed) return THROTTLED;

  const parsed = parseAddress(formData);
  if (!parsed.success) {
    return { ok: false, error: 'Check the details below.', fields: fieldErrors(parsed.error) };
  }

  const { isDefault, ...address } = parsed.data;

  try {
    await addAddress(user.id, address, isDefault ?? false);
  } catch (error) {
    if (error instanceof DuplicateAddressError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  refreshAccount();
  return { ok: true, message: 'Address saved.' };
}

export async function updateAddressAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await actor();
  if (!user) return SIGNED_OUT;

  const limit = await consume(`account:${user.id}`, LIMITS.accountUpdate);
  if (!limit.allowed) return THROTTLED;

  const id = addressIdSchema.safeParse(formData.get('id'));
  if (!id.success) return NOT_YOURS;

  const parsed = parseAddress(formData);
  if (!parsed.success) {
    return { ok: false, error: 'Check the details below.', fields: fieldErrors(parsed.error) };
  }

  const { isDefault, ...address } = parsed.data;

  try {
    // Scoped by `user_id` in SQL: another customer's id updates nothing and
    // returns null, which is the same answer as an id that never existed.
    const updated = await updateAddress(user.id, id.data, address);
    if (!updated) return NOT_YOURS;

    if (isDefault) await setDefaultAddress(user.id, id.data);
  } catch (error) {
    if (error instanceof DuplicateAddressError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  refreshAccount();
  return { ok: true, message: 'Address updated.' };
}

export async function setDefaultAddressAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await actor();
  if (!user) return SIGNED_OUT;

  const limit = await consume(`account:${user.id}`, LIMITS.accountUpdate);
  if (!limit.allowed) return THROTTLED;

  const id = addressIdSchema.safeParse(formData.get('id'));
  if (!id.success) return NOT_YOURS;

  if (!(await setDefaultAddress(user.id, id.data))) return NOT_YOURS;

  refreshAccount();
  return { ok: true, message: 'Default delivery address updated.' };
}

export async function archiveAddressAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await actor();
  if (!user) return SIGNED_OUT;

  const limit = await consume(`account:${user.id}`, LIMITS.accountUpdate);
  if (!limit.allowed) return THROTTLED;

  const id = addressIdSchema.safeParse(formData.get('id'));
  if (!id.success) return NOT_YOURS;

  if (!(await archiveAddress(user.id, id.data))) return NOT_YOURS;

  refreshAccount();
  return { ok: true, message: 'Address removed.' };
}
