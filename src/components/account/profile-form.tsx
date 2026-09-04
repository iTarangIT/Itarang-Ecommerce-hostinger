'use client';

import { useActionState } from 'react';
import { AlertCircle, Check, Loader2, Save } from 'lucide-react';
import { updateProfileAction, type AccountFormState } from '@/lib/account/address-actions';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

/**
 * Name and mobile number.
 *
 * Email is shown but not editable, and that is a deliberate omission rather
 * than an oversight: it is the sign-in identifier, so changing it is changing a
 * credential — the new address has to be proved before the old one stops
 * working, or a typo locks the account. That belongs in its own flow.
 */
export function ProfileForm({
  email,
  fullName,
  phone,
  verified,
}: {
  email: string;
  fullName: string | null;
  phone: string | null;
  verified: boolean;
}) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    updateProfileAction,
    null,
  );

  const fieldError = (name: string) => (state && !state.ok ? state.fields?.[name] : undefined);

  return (
    <form action={action} className="space-y-4">
      <Field label="Email address" htmlFor="email" hint="Used to sign in. Contact support to change it.">
        <Input id="email" name="email" type="email" defaultValue={email} disabled readOnly />
      </Field>

      {verified ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <Check className="h-3.5 w-3.5" />
          Email confirmed
        </p>
      ) : null}

      <Field label="Full name" htmlFor="fullName" required error={fieldError('fullName')}>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          defaultValue={fullName ?? ''}
          placeholder="Your name"
        />
      </Field>

      <Field
        label="Mobile number"
        htmlFor="phone"
        error={fieldError('phone')}
        hint="Optional. 10 digits, used for delivery updates."
      >
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
          defaultValue={phone ?? ''}
          placeholder="9876543210"
        />
      </Field>

      {state ? (
        state.ok ? (
          <p className="flex items-center gap-1.5 text-sm text-primary">
            <Check className="h-4 w-4 shrink-0" />
            {state.message}
          </p>
        ) : (
          <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {state.error}
          </p>
        )
      ) : null}

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save details
      </Button>
    </form>
  );
}
