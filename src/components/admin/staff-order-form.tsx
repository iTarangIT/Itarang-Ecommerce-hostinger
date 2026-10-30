'use client';

import { useActionState, useState } from 'react';
import { Plus } from 'lucide-react';
import { createStaffOrderAction, type StaffOrderFormState } from '@/lib/admin/staff-order-actions';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';

export interface StaffOrderOption {
  variantId: string;
  label: string;
}

/**
 * Admin → New order (R-18). A client component only so that a refusal —
 * out of stock, a mistyped pincode — comes back with everything the admin typed
 * still in the form, instead of a blank page and a phone call to repeat.
 */
export function StaffOrderForm({
  options,
  states,
}: {
  options: StaffOrderOption[];
  states: string[];
}) {
  const [state, action, pending] = useActionState<StaffOrderFormState, FormData>(
    createStaffOrderAction,
    {},
  );
  const [lines, setLines] = useState(1);
  const error = (key: string) => state.fields?.[key];

  return (
    <form action={action} className="mt-6 grid gap-6 lg:grid-cols-12">
      <section className="space-y-4 rounded-lg border border-border bg-card p-4 lg:col-span-7">
        <h2 className="font-display text-sm font-semibold">Products</h2>
        {Array.from({ length: lines }, (_, index) => (
          <div key={index} className="grid grid-cols-[1fr_5rem] gap-2">
            <Select name={`variant_${index}`} defaultValue="" aria-label={`Product ${index + 1}`}>
              <option value="">Choose a product…</option>
              {options.map((option) => (
                <option key={option.variantId} value={option.variantId}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              name={`quantity_${index}`}
              type="number"
              min={1}
              max={50}
              defaultValue={1}
              aria-label={`Quantity ${index + 1}`}
            />
          </div>
        ))}
        {error('lines') ? <p className="text-xs font-medium text-destructive">{error('lines')}</p> : null}
        {lines < 10 ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setLines(lines + 1)}>
            <Plus className="h-4 w-4" />
            Add another product
          </Button>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Prices, delivery and GST are worked out exactly as at checkout. Out-of-stock products are not
          listed. No coupon applies to a staff order.
        </p>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-card p-4 lg:col-span-5">
        <h2 className="font-display text-sm font-semibold">Customer</h2>
        <Field label="Name" required error={error('contact.name')}>
          <Input name="name" required maxLength={120} autoComplete="off" />
        </Field>
        <Field label="Mobile" required hint="The payment link is sent here by SMS." error={error('contact.phone')}>
          <Input name="phone" required inputMode="numeric" maxLength={14} autoComplete="off" />
        </Field>
        <Field label="Email" hint="Optional — the link and receipt are emailed too." error={error('contact.email')}>
          <Input name="email" type="email" maxLength={200} autoComplete="off" />
        </Field>
        <Field label="Address" required error={error('address.line1')}>
          <Input name="line1" required maxLength={200} placeholder="Flat or house number and street" />
        </Field>
        <Field label="Area" error={error('address.line2')}>
          <Input name="line2" maxLength={200} />
        </Field>
        <Field label="Landmark" error={error('address.landmark')}>
          <Input name="landmark" maxLength={120} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" required error={error('address.city')}>
            <Input name="city" required maxLength={120} />
          </Field>
          <Field label="Pincode" required error={error('address.pincode')}>
            <Input name="pincode" required inputMode="numeric" maxLength={6} />
          </Field>
        </div>
        <Field label="State" required error={error('address.state')}>
          <Select name="state" required defaultValue="">
            <option value="" disabled>
              Select the state…
            </option>
            {states.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="GSTIN" hint="Only for a business invoice." error={error('gstin')}>
          <Input name="gstin" maxLength={15} autoComplete="off" />
        </Field>

        {state.error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm font-medium text-destructive">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" fullWidth disabled={pending}>
          {pending ? 'Placing the order…' : 'Place order and send payment link'}
        </Button>
        <p className="text-xs text-muted-foreground">
          The stock is held for 24 hours, as long as the link stays open. The order confirms itself when the
          customer pays and is marked “placed by staff”.
        </p>
      </section>
    </form>
  );
}
