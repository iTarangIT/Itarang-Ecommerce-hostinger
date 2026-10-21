import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { safeNext } from '@/lib/auth/redirects';
import { OtpSignInForm } from '@/components/auth/otp-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Create an account',
  robots: { index: false, follow: false },
};

/**
 * Create an account: the sign-up door.
 *
 * The same emailed-code form as `/login`, with `intent="signup"`. The account
 * is created when the code comes back proved. An address that already has an
 * account is sent back to `/login` without a code — see `otp-actions.ts` for
 * why that answer is given.
 *
 * The password registration form this page used to render is gone, and
 * `registerAction` refuses on the server. Customers authenticate by code.
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string }>;
}) {
  const params = await searchParams;
  // The shared, unit-tested rule. See `lib/auth/redirects.ts`.
  const next = safeNext(params.next) ?? undefined;

  if (await currentUser()) redirect(next ?? '/account');

  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-sm">
        <h1 className="heading-2 text-center">Create your account</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Enter your email and we will send you a 6-digit code. That is the whole
          sign-up — there is no password to choose or remember.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <OtpSignInForm
            next={next}
            intent="signup"
            defaultEmail={params.email ?? ''}
            ctaLabel="Email me a code"
          />
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
            className="font-medium text-foreground underline underline-offset-2"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
