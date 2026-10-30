/**
 * The after-sales forms and the product enquiry, defined once.
 *
 * The pages render these fields and the server validates against the same
 * list, so a field added here is collected, checked and stored without a
 * second edit anywhere — and a request can never be accepted by the browser
 * and refused by the server, or the other way round. Client-safe: no imports
 * from the server.
 */

export type FieldType = 'text' | 'tel' | 'email' | 'pincode' | 'select' | 'date' | 'textarea';

export interface FormFieldSpec {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  options?: string[];
  maxLength?: number;
}

export type SupportRequestKind =
  | 'complaint'
  | 'warranty'
  | 'installation'
  | 'enquiry'
  | 'callback'
  | 'finance';

/** Identity fields every request has; stored in their own columns. */
const CONTACT: FormFieldSpec[] = [
  { name: 'name', label: 'Your name', type: 'text', required: true, maxLength: 120 },
  { name: 'phone', label: 'Mobile number', type: 'tel', required: true },
  { name: 'email', label: 'Email address', type: 'email', hint: 'We send your reference number here.' },
  { name: 'pincode', label: 'Pincode', type: 'pincode', required: true },
];

const PRODUCT: FormFieldSpec[] = [
  {
    name: 'model',
    label: 'Battery or charger model',
    type: 'text',
    required: true,
    placeholder: 'e.g. TK-LiFe-5145 or TK LiEV-51105',
    hint: 'Printed on the label on the side of the battery.',
  },
  {
    name: 'serial',
    label: 'Serial number',
    type: 'text',
    required: true,
    placeholder: 'From the label on the battery',
  },
  {
    name: 'orderNumber',
    label: 'Order number',
    type: 'text',
    placeholder: 'If you bought it on this website',
    maxLength: 40,
  },
];

export const SUPPORT_FORMS: Record<SupportRequestKind, FormFieldSpec[]> = {
  complaint: [
    ...CONTACT,
    ...PRODUCT,
    {
      name: 'issue',
      label: 'What is the problem',
      type: 'select',
      required: true,
      options: [
        'Battery is not charging',
        'Range or backup time has dropped',
        'Battery does not power on',
        'Fault or error indication',
        'Charger is not working',
        'Physical damage',
        'Something else',
      ],
    },
    { name: 'startedOn', label: 'When did it start', type: 'date' },
    {
      name: 'description',
      label: 'Describe what is happening',
      type: 'textarea',
      required: true,
      maxLength: 2000,
      placeholder:
        'What you observe, when it happens, and anything that changed recently — a new charger, a fall, water exposure, a recent service.',
    },
  ],
  warranty: [
    ...CONTACT,
    ...PRODUCT,
    { name: 'purchaseDate', label: 'Date of purchase', type: 'date', required: true },
    {
      name: 'purchasedFrom',
      label: 'Bought from',
      type: 'select',
      required: true,
      options: ['iTarang website', 'An iTarang dealer', 'Somewhere else'],
    },
    {
      name: 'invoiceNumber',
      label: 'Invoice number',
      type: 'text',
      placeholder: 'From your tax invoice',
      maxLength: 60,
    },
    {
      name: 'vehicle',
      label: 'Vehicle or use',
      type: 'text',
      placeholder: 'e.g. e-rickshaw, scooter model, home backup',
      maxLength: 120,
    },
  ],
  installation: [
    ...CONTACT,
    {
      name: 'model',
      label: 'Battery model',
      type: 'text',
      required: true,
      placeholder: 'e.g. Powercube 1.4 (TK12100)',
    },
    { name: 'orderNumber', label: 'Order number', type: 'text', required: true, maxLength: 40 },
    { name: 'preferredDate', label: 'Preferred date', type: 'date' },
    {
      name: 'timeSlot',
      label: 'Preferred time',
      type: 'select',
      options: ['Morning (9–12)', 'Afternoon (12–4)', 'Evening (4–7)'],
    },
    {
      name: 'address',
      label: 'Installation address',
      type: 'textarea',
      required: true,
      maxLength: 600,
    },
    {
      name: 'notes',
      label: 'Anything we should know',
      type: 'textarea',
      maxLength: 1000,
      placeholder: 'Inverter make and model, where the battery will sit, access instructions.',
    },
  ],
  // "Send an enquiry" from the load calculator (R-06): the result is
  // prefilled into `requirement` so the team sees what the shopper saw.
  enquiry: [
    ...CONTACT,
    {
      name: 'product',
      label: 'Product you are asking about',
      type: 'text',
      maxLength: 160,
      placeholder: 'e.g. Powercube 1.4 (TK12100)',
    },
    {
      name: 'requirement',
      label: 'What you need',
      type: 'textarea',
      required: true,
      maxLength: 2000,
      placeholder: 'Appliances, hours of backup, your inverter — anything that helps us size it.',
    },
  ],
  // "Connect with an iTarang expert" popup for first-time visitors. The
  // consent tick is a one-option select so the shared validator enforces it.
  callback: [
    { name: 'name', label: 'Full name', type: 'text', required: true, maxLength: 120 },
    { name: 'phone', label: 'Mobile number', type: 'tel', required: true },
    { name: 'pincode', label: 'Pincode', type: 'pincode', required: true },
    {
      name: 'consent',
      label: 'Agreed to Terms, Privacy Policy and a call back',
      type: 'select',
      required: true,
      options: ['yes'],
    },
  ],
  // "Buy on finance" from the product page and checkout (R-15). Only what the
  // shopper types is validated here; the product is resolved on the server
  // from the SKU, never taken from the form — see `finance-actions.ts`.
  finance: [
    { name: 'name', label: 'Full name', type: 'text', required: true, maxLength: 120 },
    { name: 'phone', label: 'Mobile number', type: 'tel', required: true },
    { name: 'pincode', label: 'Pincode', type: 'pincode', required: true },
    {
      name: 'consent',
      label: 'Agreed to Terms, Privacy Policy and a call back',
      type: 'select',
      required: true,
      options: ['yes'],
    },
  ],
};

export const KIND_LABEL: Record<SupportRequestKind, string> = {
  complaint: 'Complaint',
  warranty: 'Warranty registration',
  installation: 'Installation booking',
  enquiry: 'Product enquiry',
  callback: 'Expert callback',
  finance: 'Finance enquiry',
};

export type FormValues = Record<string, string>;
export type FormErrors = Record<string, string>;

const DEFAULT_MAX = 200;

/** Validate values against a form's fields. The same function runs on both sides. */
export function validateForm(fields: FormFieldSpec[], values: FormValues): FormErrors {
  const errors: FormErrors = {};

  for (const field of fields) {
    const value = (values[field.name] ?? '').trim();

    if (field.required && !value) {
      errors[field.name] = `${field.label} is required.`;
      continue;
    }
    if (!value) continue;

    if (value.length > (field.maxLength ?? DEFAULT_MAX)) {
      errors[field.name] = `${field.label} is too long.`;
    } else if (field.type === 'tel' && !/^[6-9]\d{9}$/.test(value)) {
      errors[field.name] = 'Enter a 10-digit Indian mobile number.';
    } else if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      errors[field.name] = 'Enter a valid email address.';
    } else if (field.type === 'pincode' && !/^[1-9]\d{5}$/.test(value)) {
      errors[field.name] = 'Enter a valid 6-digit pincode.';
    } else if (field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      errors[field.name] = 'Enter a valid date.';
    } else if (field.type === 'select' && field.options && !field.options.includes(value)) {
      errors[field.name] = `Choose one of the options for ${field.label.toLowerCase()}.`;
    }
  }

  return errors;
}

/** Only the fields a form defines, trimmed — anything else a client sends is dropped. */
export function pickFormValues(fields: FormFieldSpec[], input: Record<string, unknown>): FormValues {
  const out: FormValues = {};
  for (const field of fields) {
    const raw = input[field.name];
    if (typeof raw === 'string' && raw.trim()) out[field.name] = raw.trim();
  }
  return out;
}
