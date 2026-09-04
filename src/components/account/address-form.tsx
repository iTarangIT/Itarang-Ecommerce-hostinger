'use client';

import { useActionState } from 'react';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import {
  addAddressAction,
  updateAddressAction,
  type AccountFormState,
} from '@/lib/account/address-actions';
import type { CustomerAddress } from '@/lib/account/addresses';
import { STATES } from '@/lib/checkout/validation';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';

/**
 * Add or edit one saved address.
 *
 * The same fields either way — the only difference is which action it posts to
 * and whether an `id` rides along — so it is one component rather than two that
 * would drift apart.
 *
 * The state list is rendered from `STATES`, the same array the server validates
 * against and the same one `stateCode()` reads to derive the GST
 * place-of-supply. A free-text field here would let somebody store a spelling
 * that later produces a blank field on an invoice, so the choice is constrained
 * at both ends.
 *
 * Everything typed here is re-parsed and re-authorised on the server; this form
 * is a courtesy, not a control.
 */
export function AddressForm({
  address,
  onDone,
}: {
  address?: CustomerAddress;
  onDone?: () => void;
}) {
  const editing = Boolean(address);
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    async (prev, formData) => {
      const result = editing
        ? await updateAddressAction(prev, formData)
        : await addAddressAction(prev, formData);
      if (result?.ok) onDone?.();
      return result;
    },
    null,
  );

  const fieldError = (name: string) =>
    state && !state.ok ? state.fields?.[name] : undefined;

  return (
    <form action={action} className="space-y-4">
      {address ? <input type="hidden" name="id" value={address.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Recipient’s name" htmlFor="recipientName" required error={fieldError('recipientName')}>
          <Input
            id="recipientName"
            name="recipientName"
            autoComplete="name"
            required
            defaultValue={address?.recipientName ?? ''}
            placeholder="Who should we hand it to?"
          />
        </Field>

        <Field
          label="Recipient’s mobile"
          htmlFor="recipientPhone"
          required
          error={fieldError('recipientPhone')}
          hint="10 digits, for the delivery call"
        >
          <Input
            id="recipientPhone"
            name="recipientPhone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            required
            defaultValue={address?.recipientPhone ?? ''}
            placeholder="9876543210"
          />
        </Field>
      </div>

      <Field label="Flat, house number and street" htmlFor="line1" required error={fieldError('line1')}>
        <Input
          id="line1"
          name="line1"
          autoComplete="address-line1"
          required
          defaultValue={address?.line1 ?? ''}
        />
      </Field>

      <Field label="Area, colony or apartment" htmlFor="line2" error={fieldError('line2')}>
        <Input
          id="line2"
          name="line2"
          autoComplete="address-line2"
          defaultValue={address?.line2 ?? ''}
        />
      </Field>

      <Field label="Landmark" htmlFor="landmark" error={fieldError('landmark')} hint="Optional, but it helps the driver">
        <Input id="landmark" name="landmark" defaultValue={address?.landmark ?? ''} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="City" htmlFor="city" required error={fieldError('city')}>
          <Input
            id="city"
            name="city"
            autoComplete="address-level2"
            required
            defaultValue={address?.city ?? ''}
          />
        </Field>

        <Field label="State" htmlFor="state" required error={fieldError('state')}>
          <Select
            id="state"
            name="state"
            autoComplete="address-level1"
            required
            defaultValue={address?.state ?? ''}
          >
            <option value="" disabled>
              Select a state
            </option>
            {STATES.map((entry) => (
              <option key={entry.code} value={entry.name}>
                {entry.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Pincode" htmlFor="pincode" required error={fieldError('pincode')}>
          <Input
            id="pincode"
            name="pincode"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            required
            defaultValue={address?.pincode ?? ''}
            placeholder="226001"
          />
        </Field>
      </div>

      {/*
        Hidden when this address is already the default: unticking it would ask
        the database for a customer with no default at all, which the list has
        no way to represent and checkout has no use for. Changing the default is
        done by promoting another address instead.
      */}
      {!address?.isDefault ? (
        <label className="flex items-center gap-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            name="isDefault"
            defaultChecked={false}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          Deliver to this address by default
        </label>
      ) : null}

      {state && !state.ok ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {editing ? 'Save changes' : 'Save address'}
        </Button>
        {onDone ? (
          <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
