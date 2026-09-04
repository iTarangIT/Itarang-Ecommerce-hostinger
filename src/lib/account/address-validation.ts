import { z } from 'zod';
import { STATES, addressSchema, phoneSchema } from '@/lib/checkout/validation';

/**
 * Validation for a *saved* address.
 *
 * Built on `addressSchema` rather than beside it. Checkout already owns the
 * canonical shape and the pincode and phone rules, and a second copy of them
 * here would be free to drift — which is the failure that produces an address
 * the address book accepts and checkout then rejects.
 *
 * Two things are added, and only two.
 */

/**
 * The state must be one we can actually issue an invoice for.
 *
 * `addressSchema.state` accepts any 2–120 character string, so "Uttar Pradsh"
 * or "" passes. That matters beyond tidiness: `stateCode()` looks the name up
 * in `STATES` to derive the GST place-of-supply code and returns `undefined`
 * for anything it does not recognise, so a typo becomes a missing field on a
 * tax document rather than a visible error at the point somebody could fix it.
 *
 * Matched case-insensitively after trimming, then normalised to the canonical
 * spelling, so what is stored is always a name `stateCode()` will resolve.
 *
 * **Scope note.** This tightening is applied to saved addresses only. The
 * shared `addressSchema` that checkout parses is deliberately left alone: it is
 * the live order path, and narrowing what it accepts could refuse a real order
 * from a customer in a state missing from the list below. Making that change
 * belongs with the checkout work, not here.
 */
const STATE_NAMES = STATES.map((entry) => entry.name);
const STATE_BY_LOWER = new Map(STATES.map((entry) => [entry.name.toLowerCase(), entry.name]));

export const stateSchema = z
  .string()
  .trim()
  .transform((value) => STATE_BY_LOWER.get(value.toLowerCase()) ?? value)
  .refine((value) => STATE_NAMES.includes(value), {
    message: 'Select an Indian state or union territory from the list.',
  });

export const savedAddressSchema = addressSchema.extend({
  state: stateSchema,

  // The recipient. Not part of `addressSchema` because checkout carries the
  // same two fields in `contactSchema` instead — an order has one contact,
  // whereas an address book holds a different recipient per entry.
  recipientName: z.string().trim().min(2, 'Enter the recipient’s name.').max(120),
  recipientPhone: phoneSchema,

  /** Whether this becomes the address checkout offers first. */
  isDefault: z.boolean().optional(),
});

export type SavedAddressInput = z.infer<typeof savedAddressSchema>;

/**
 * The profile fields a customer may edit.
 *
 * Email is absent on purpose: it is the sign-in identifier, so changing it is
 * changing a credential and needs the new address proved before the old one
 * stops working. That is its own piece of work, not a text field on a form.
 */
export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your name.').max(120),
  // Optional, because an account created by email code has never been asked
  // for one. Empty clears it rather than failing.
  phone: phoneSchema.optional().or(z.literal('')),
});

export type ProfileInput = z.infer<typeof profileSchema>;
