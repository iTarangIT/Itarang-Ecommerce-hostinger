'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { resendVerificationAction } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';

/**
 * "Send it again" for the email-confirmation link.
 *
 * `resendVerificationAction` has existed since accounts went in and nothing
 * ever called it, so a customer whose confirmation mail bounced, went to spam
 * or was deleted had no way to ask for another one short of registering a
 * second account.
 *
 * A transition rather than `useActionState`: the action takes no arguments —
 * it reads the identity from the session, so a caller cannot ask us to mail a
 * stranger — and `useActionState` would require a `(prev, formData)` shape it
 * deliberately does not have.
 */
export function ResendVerification() {
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<{ tone: 'ok' | 'error'; message: string } | null>(
    null,
  );

  return (
    <div className="mt-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const state = await resendVerificationAction();
            setResult(
              state
                ? { tone: 'error', message: state.error }
                : {
                    tone: 'ok',
                    message: 'Sent. Check your inbox, and your spam folder if it is not there.',
                  },
            );
          })
        }
      >
        {pending ? 'Sending…' : 'Send the confirmation email again'}
      </Button>
      {result ? (
        <p
          role="status"
          className={
            result.tone === 'ok'
              ? 'mt-2 flex items-start gap-1.5 text-xs text-success'
              : 'mt-2 text-xs text-destructive'
          }
        >
          {result.tone === 'ok' ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}
          <span>{result.message}</span>
        </p>
      ) : null}
    </div>
  );
}
