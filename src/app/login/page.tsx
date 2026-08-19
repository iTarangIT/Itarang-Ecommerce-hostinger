import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { SignInForm } from '@/components/auth/auth-forms';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

/** Only same-origin relative paths survive, so `?next=` cannot leave the site. */
function safeNext(value: string | undefined): string | undefined {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return undefined;
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; registered?: string; reset?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);

  if (await currentUser()) redirect(next ?? '/account');

  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-sm">
        <h1 className="heading-2 text-center">Sign in</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Track your orders, save addresses and check out faster.
        </p>

        {params.registered ? (
          <p className="mt-4 rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground">
            Check your inbox — if that address has an account, we&apos;ve sent you an email.
          </p>
        ) : null}

        {params.reset ? (
          <p className="mt-4 rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground">
            Your password has been changed. Sign in with the new one.
          </p>
        ) : null}

        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <SignInForm next={next} />
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to iTarang?{' '}
          <Link
            href={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}
            className="font-medium text-foreground underline underline-offset-2"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
