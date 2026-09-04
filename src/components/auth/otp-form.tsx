'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Loader2, LogIn, Mail } from 'lucide-react';
import {
  requestLoginCodeAction,
  verifyLoginCodeAction,
  type OtpFormState,
} from '@/lib/auth/otp-actions';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

/**
 * Sign in with a code sent by email.
 *
 * Two steps in one conversation: ask for an address, then prove a code. The
 * same form does signup and sign-in, and nothing here asks which the visitor
 * intends — the server issues a code either way and creates the account when
 * the code comes back proved. That is also why no message on this screen ever
 * says whether an address is registered.
 *
 * The two steps hold **separate** action state, and the code step is keyed on
 * the address. That is not tidiness: a single shared state would let a stale
 * result win. Sending a code to a second address after mistyping the first
 * would otherwise redraw the *previous* address's rejection, because
 * `useActionState` keeps the last result until its own action runs again.
 * Keying the child throws that away with the step it belonged to.
 */

function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </p>
  );
}

export function OtpSignInForm({
  next,
  ctaLabel = 'Email me a code',
}: {
  next?: string;
  ctaLabel?: string;
}) {
  const [state, requestAction, requesting] = useActionState<OtpFormState, FormData>(
    requestLoginCodeAction,
    null,
  );

  // Set when the visitor asks to go back, cleared the moment a new code is
  // issued — otherwise the effect below would leave them stuck on step one.
  const [editingAddress, setEditingAddress] = useState(false);
  const [typedEmail, setTypedEmail] = useState('');

  useEffect(() => {
    if (state?.step === 'code') setEditingAddress(false);
  }, [state]);

  if (state?.step === 'code' && !editingAddress) {
    return (
      <CodeStep
        // Discards the previous address's errors along with the address.
        key={state.identifier}
        identifier={state.identifier}
        notice={state.notice}
        next={next}
        resending={requesting}
        resendAction={requestAction}
        onUseAnotherAddress={() => {
          setTypedEmail(state.identifier);
          setEditingAddress(true);
        }}
      />
    );
  }

  return (
    <form action={requestAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field label="Email address" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          placeholder="you@example.com"
          defaultValue={typedEmail}
          onChange={(event) => setTypedEmail(event.currentTarget.value)}
        />
      </Field>

      <ErrorNote message={state?.error} />

      <Button type="submit" variant="primary" size="lg" fullWidth disabled={requesting}>
        {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {requesting ? 'Sending code…' : ctaLabel}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        We will email you a 6-digit code. There is no password to remember.
      </p>
    </form>
  );
}

function CodeStep({
  identifier,
  notice,
  next,
  resending,
  resendAction,
  onUseAnotherAddress,
}: {
  identifier: string;
  notice?: string;
  next?: string;
  resending: boolean;
  resendAction: (formData: FormData) => void;
  onUseAnotherAddress: () => void;
}) {
  const [state, verifyAction, verifying] = useActionState<OtpFormState, FormData>(
    verifyLoginCodeAction,
    null,
  );

  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    codeRef.current?.focus();
  }, []);

  return (
    <div className="space-y-4">
      {notice ? (
        <p className="rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}

      <form action={verifyAction} className="space-y-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {/* The address the code was issued for. The server re-reads it and
            scopes the lookup by it, so this is a convenience rather than a
            trust boundary — a tampered value simply matches no code. */}
        <input type="hidden" name="email" value={identifier} />

        <Field label="6-digit code" htmlFor="code" required>
          <Input
            ref={codeRef}
            id="code"
            name="code"
            // `text` with a numeric input mode, not `type="number"`: that
            // brings spinners, and some browsers strip a leading zero — which
            // a code is allowed to start with.
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            placeholder="123456"
            className="text-center text-lg tracking-[0.4em]"
          />
        </Field>

        <ErrorNote message={state?.error} />

        <Button type="submit" variant="primary" size="lg" fullWidth disabled={verifying}>
          {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          Sign in
        </Button>
      </form>

      <div className="flex items-center justify-between gap-3 text-sm">
        {/* The same request action, same address. The server refuses one that
            arrives too soon and says how many seconds are left. */}
        <form action={resendAction}>
          <input type="hidden" name="email" value={identifier} />
          <button
            type="submit"
            disabled={resending}
            className="text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-60"
          >
            {resending ? 'Sending…' : 'Send a new code'}
          </button>
        </form>

        <button
          type="button"
          onClick={onUseAnotherAddress}
          className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Use a different address
        </button>
      </div>
    </div>
  );
}
