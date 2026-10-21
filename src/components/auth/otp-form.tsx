'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Info, Loader2, LogIn, Mail, UserPlus } from 'lucide-react';
import {
  requestLoginCodeAction,
  verifyLoginCodeAction,
  type OtpFormState,
  type OtpIntent,
} from '@/lib/auth/otp-actions';
import { Button, ButtonLink } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

/**
 * Sign in, or sign up, with a code sent by email.
 *
 * Two steps in one conversation: ask for an address, then prove a code. The
 * page says which door this is through `intent`, and the server answers the
 * wrong one — an unknown address trying to sign in, a known one trying to sign
 * up — with no code and a pointer to the other page, which `AccountPrompt`
 * renders with the address carried across.
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

/** `/login` or `/register`, keeping the address and where to go afterwards. */
function doorHref(path: '/login' | '/register', email: string, next?: string): string {
  const params = new URLSearchParams({ email });
  if (next) params.set('next', next);
  return `${path}?${params.toString()}`;
}

function AccountPrompt({
  status,
  identifier,
  next,
}: {
  status: 'missing' | 'exists';
  identifier: string;
  next?: string;
}) {
  const missing = status === 'missing';
  return (
    <div role="status" className="space-y-3 rounded-lg border border-border bg-surface p-4 text-sm">
      <p className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          {missing ? (
            <>
              There is no account for <strong>{identifier}</strong> yet. Create one first, then
              you can sign in.
            </>
          ) : (
            <>
              <strong>{identifier}</strong> already has an account. Sign in instead.
            </>
          )}
        </span>
      </p>
      <ButtonLink
        href={doorHref(missing ? '/register' : '/login', identifier, next)}
        variant="primary"
        fullWidth
      >
        {missing ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
        {missing ? 'Create an account' : 'Sign in'}
      </ButtonLink>
    </div>
  );
}

export function OtpSignInForm({
  next,
  intent = 'login',
  defaultEmail = '',
  ctaLabel = 'Email me a code',
}: {
  next?: string;
  intent?: OtpIntent;
  defaultEmail?: string;
  ctaLabel?: string;
}) {
  const [state, requestAction, requesting] = useActionState<OtpFormState, FormData>(
    requestLoginCodeAction,
    null,
  );

  // Set when the visitor asks to go back, cleared the moment a new code is
  // issued — otherwise the effect below would leave them stuck on step one.
  const [editingAddress, setEditingAddress] = useState(false);
  const [typedEmail, setTypedEmail] = useState(defaultEmail);

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
        intent={intent}
        resending={requesting}
        resendAction={requestAction}
        onUseAnotherAddress={() => {
          setTypedEmail(state.identifier);
          setEditingAddress(true);
        }}
      />
    );
  }

  // Only while the field still holds the address the answer was about; typing
  // another one makes it stale.
  const answered = state?.step === 'identifier' ? state.account : undefined;
  const prompt =
    answered && answered.identifier === typedEmail.trim().toLowerCase() ? answered : null;

  return (
    <form action={requestAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <input type="hidden" name="intent" value={intent} />

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

      {prompt ? (
        <AccountPrompt status={prompt.status} identifier={prompt.identifier} next={next} />
      ) : (
        <Button type="submit" variant="primary" size="lg" fullWidth disabled={requesting}>
          {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          {requesting ? 'Sending code…' : ctaLabel}
        </Button>
      )}

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
  intent,
  resending,
  resendAction,
  onUseAnotherAddress,
}: {
  identifier: string;
  notice?: string;
  next?: string;
  intent: OtpIntent;
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
          {/* A resend on /register must stay a sign-up, or it would be
              refused for an address that has no account yet. */}
          <input type="hidden" name="intent" value={intent} />
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
