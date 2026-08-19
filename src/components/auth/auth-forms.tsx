'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { AlertCircle, KeyRound, Loader2, LogIn, Mail, UserPlus } from 'lucide-react';
import {
  changePasswordAction,
  loginAction,
  registerAction,
  requestResetAction,
  resetPasswordAction,
} from '@/lib/auth/actions';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/password-policy';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

/**
 * The four credential forms.
 *
 * All of them post to Server Actions rather than API routes, which is what
 * gives them Next.js's Origin↔Host check without any CSRF token plumbing.
 *
 * `next` is carried through as a hidden field so that "sign in to continue"
 * returns the shopper to where they were. The server only honours same-origin
 * relative paths, so a crafted value cannot redirect off-site.
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

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, null);

  return (
    <form action={action} className="space-y-4">
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
        />
      </Field>

      <Field label="Password" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <ErrorNote message={state?.error} />

      <Button type="submit" variant="primary" size="lg" fullWidth disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        Sign in
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/forgot-password" className="underline underline-offset-2 hover:text-foreground">
          Forgotten your password?
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(registerAction, null);

  return (
    <form action={action} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field label="Full name" htmlFor="fullName" required>
        <Input id="fullName" name="fullName" autoComplete="name" autoFocus required />
      </Field>

      <Field label="Email address" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        required
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
      </Field>

      <ErrorNote message={state?.error} />

      <Button type="submit" variant="primary" size="lg" fullWidth disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        Create account
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestResetAction, null);

  return (
    <form action={action} className="space-y-4">
      <Field
        label="Email address"
        htmlFor="email"
        required
        hint="We'll send a reset link if this address has an account."
      >
        <Input id="email" name="email" type="email" autoComplete="email" autoFocus required />
      </Field>

      <ErrorNote message={state?.error} />

      <Button type="submit" variant="primary" size="lg" fullWidth disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        Send reset link
      </Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, null);

  return (
    <form action={action} className="space-y-4">
      <Field label="Current password" htmlFor="currentPassword" required>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
        />
      </Field>

      <Field
        label="New password"
        htmlFor="password"
        required
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
      </Field>

      <Field label="Confirm new password" htmlFor="confirmPassword" required>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <ErrorNote message={state?.error} />

      <Button type="submit" variant="primary" size="lg" fullWidth disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        Change password
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        You&apos;ll be signed out everywhere and asked to sign in again.
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <Field
        label="New password"
        htmlFor="password"
        required
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          autoFocus
          required
        />
      </Field>

      <Field label="Confirm new password" htmlFor="confirmPassword" required>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <ErrorNote message={state?.error} />

      <Button type="submit" variant="primary" size="lg" fullWidth disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        Set new password
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Setting a new password signs you out everywhere else.
      </p>
    </form>
  );
}
