import { z } from 'zod';

/**
 * Checkout input validation.
 *
 * Every route handler parses its body through these schemas before touching the
 * database. Patterns are shared with the storefront forms so client-side and
 * server-side validation cannot disagree — the client's version is a courtesy,
 * this one is the rule.
 */

/** Indian mobile numbers start 6–9 and are ten digits. */
export const PHONE_PATTERN = /^[6-9]\d{9}$/;
export const PINCODE_PATTERN = /^\d{6}$/;
/** 15 characters: state code, PAN, entity number, Z, checksum. */
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const phoneSchema = z
  .string()
  .trim()
  .regex(PHONE_PATTERN, 'Enter a 10-digit Indian mobile number.');

export const pincodeSchema = z
  .string()
  .trim()
  .regex(PINCODE_PATTERN, 'Enter a valid 6-digit pincode.');

export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(GSTIN_PATTERN, 'That does not look like a valid 15-character GSTIN.');

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(120),
  phone: phoneSchema,
  email: z.string().trim().email('Enter a valid email address.').max(200).optional().or(z.literal('')),
});

export const addressSchema = z.object({
  line1: z.string().trim().min(4, 'Enter the flat or house number and street.').max(200),
  line2: z.string().trim().max(200).optional().or(z.literal('')),
  landmark: z.string().trim().max(120).optional().or(z.literal('')),
  city: z.string().trim().min(2, 'Enter your city.').max(120),
  state: z.string().trim().min(2, 'Select your state.').max(120),
  pincode: pincodeSchema,
});

export const quoteLineSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(50),
});

export const paymentMethodSchema = z.enum(['cod', 'mock', 'razorpay-test']);

export const quoteRequestSchema = z.object({
  lines: z.array(quoteLineSchema).max(50),
  couponCode: z.string().trim().max(40).optional(),
  pincode: z.string().trim().optional(),
  paymentMethod: paymentMethodSchema.optional(),
});

export const placeOrderSchema = z.object({
  lines: z.array(quoteLineSchema).min(1, 'Your cart is empty.').max(50),
  contact: contactSchema,
  address: addressSchema,
  couponCode: z.string().trim().max(40).optional(),
  gstin: gstinSchema.optional().or(z.literal('')),
  paymentMethod: paymentMethodSchema,

  /**
   * The total the browser last displayed, in paise.
   *
   * ADVISORY ONLY, and the distinction matters: this is never used to price
   * anything. The server rebuilds the quote from the catalogue regardless, and
   * this value can only cause the order to be *refused* when the two disagree.
   * It cannot lower a charge, so accepting it from the client is safe.
   */
  expectedTotal: z.number().int().nonnegative().max(1_000_000_00).optional(),

  /** Set once the shopper has seen and accepted a changed price. */
  acceptPriceChange: z.boolean().optional(),
});

export const callbackSchema = z.object({
  orderNumber: z.string().trim().min(1),
  gatewayOrderId: z.string().trim().min(1),
  gatewayPaymentId: z.string().trim().min(1),
  signature: z.string().trim().min(1),
  simulate: z.enum(['success', 'failure', 'abandon']).optional(),
});

export const orderLookupSchema = z.object({
  orderNumber: z.string().trim().min(1),
  phone: phoneSchema,
});

export type ContactInput = z.infer<typeof contactSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;
export type CallbackInput = z.infer<typeof callbackSchema>;

/** Flatten a zod error into `{ field: message }` for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Indian state code → GST state number, for place-of-supply.
 *
 * All 36 states and union territories currently in the GST code list. Four were
 * missing until the address book started validating against this array — an
 * omission that was invisible while `state` was any free-text string, because
 * a name this list does not know simply produced `undefined` from
 * `stateCode()` and a blank place-of-supply on the invoice.
 *
 * Two obsolete codes are deliberately absent: 25 (Daman and Diu) and 28 (the
 * undivided Andhra Pradesh). Daman and Diu merged into Dadra and Nagar Haveli
 * in 2020 and the merged union territory uses 26; Andhra Pradesh became 37 when
 * Telangana was created. Listing a retired code would let an invoice be issued
 * against a place of supply that no longer exists.
 *
 * Names are the matching key — `stateCode()` compares on them — so the "and"
 * spelling is uniform rather than mixing in ampersands.
 */
export const STATES: Array<{ name: string; code: string }> = [
  { name: 'Andaman and Nicobar Islands', code: '35' },
  { name: 'Andhra Pradesh', code: '37' },
  { name: 'Arunachal Pradesh', code: '12' },
  { name: 'Assam', code: '18' },
  { name: 'Bihar', code: '10' },
  { name: 'Chandigarh', code: '04' },
  { name: 'Chhattisgarh', code: '22' },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', code: '26' },
  { name: 'Delhi', code: '07' },
  { name: 'Goa', code: '30' },
  { name: 'Gujarat', code: '24' },
  { name: 'Haryana', code: '06' },
  { name: 'Himachal Pradesh', code: '02' },
  { name: 'Jammu and Kashmir', code: '01' },
  { name: 'Jharkhand', code: '20' },
  { name: 'Karnataka', code: '29' },
  { name: 'Kerala', code: '32' },
  { name: 'Ladakh', code: '38' },
  { name: 'Lakshadweep', code: '31' },
  { name: 'Madhya Pradesh', code: '23' },
  { name: 'Maharashtra', code: '27' },
  { name: 'Manipur', code: '14' },
  { name: 'Meghalaya', code: '17' },
  { name: 'Mizoram', code: '15' },
  { name: 'Nagaland', code: '13' },
  { name: 'Odisha', code: '21' },
  { name: 'Puducherry', code: '34' },
  { name: 'Punjab', code: '03' },
  { name: 'Rajasthan', code: '08' },
  { name: 'Sikkim', code: '11' },
  { name: 'Tamil Nadu', code: '33' },
  { name: 'Telangana', code: '36' },
  { name: 'Tripura', code: '16' },
  { name: 'Uttar Pradesh', code: '09' },
  { name: 'Uttarakhand', code: '05' },
  { name: 'West Bengal', code: '19' },
];

export function stateCode(name: string): string | undefined {
  return STATES.find((s) => s.name.toLowerCase() === name.trim().toLowerCase())?.code;
}
