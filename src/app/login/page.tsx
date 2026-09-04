import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { safeNext } from '@/lib/auth/redirects';
import { OtpSignInForm } from '@/components/auth/otp-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    registered?: string;
    reset?: string;
    signedout?: string;
  }>;
}) {
  const params = await searchParams;
  // The one shared rule, unit-tested in `lib/auth/redirects.test.ts`. This page
  // and `/register` each held their own two-line copy, and both accepted
  // `/\evil.example` — a value several browsers resolve to another host.
  const next = safeNext(params.next) ?? undefined;

  if (await currentUser()) redirect(next ?? '/account');

  // Only ever true for a path `safeNext` has already accepted as same-origin
  // and relative, so this cannot be steered by an absolute URL.
  const wantsAdmin = next?.startsWith('/admin') ?? false;

  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-sm">
        <h1 className="heading-2 text-center">Sign in</h1>
        {/* Says what an account does today. It used to promise saved addresses
            and faster checkout; there is no address book yet, so that was a
            claim the account could not keep. */}
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Enter your email and we will send you a code. New here? The same step
          creates your account.
        </p>

        {params.registered ? (
          <p className="mt-4 rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground">
            Check your inbox — if that address has an account, we&apos;ve sent you an email.
          </p>
        ) : null}

        {params.signedout === 'all' ? (
          <p className="mt-4 rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground">
            You have been signed out of every browser. Sign in again to continue.
          </p>
        ) : null}

        {params.reset ? (
          <p className="mt-4 rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground">
            Your password has been changed. Sign in with the new one.
          </p>
        ) : null}

        {/*
          `requireAdmin()` sends a signed-out administrator here, to a form
          that cannot sign them in. Rather than change that guard — it is the
          admin authorization boundary and is deliberately left alone — the
          arrival is recognised and answered with the right door.
        */}
        {wantsAdmin ? (
          <p className="mt-4 rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground">
            The admin console needs a staff account.{' '}
            <Link
              href={`/staff/login?next=${encodeURIComponent(next ?? '/admin')}`}
              className="font-medium text-foreground underline underline-offset-2"
            >
              Sign in with a password
            </Link>
            .
          </p>
        ) : null}

        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <OtpSignInForm next={next} />
        </div>

        {/*
          No "create an account" link any more, and its absence is the feature.
          Signing in and signing up are the same act: the code is sent to the
          address whether or not it has an account, and the account is created
          when the code comes back. Offering two doors to one room would only
          make a visitor wonder which of them they are behind.
        */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          iTarang staff{' '}
          <Link
            href="/staff/login"
            className="font-medium text-foreground underline underline-offset-2"
          >
            sign in with a password
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
