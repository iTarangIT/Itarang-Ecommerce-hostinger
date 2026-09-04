import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { safeNext } from '@/lib/auth/redirects';
import { SignInForm } from '@/components/auth/auth-forms';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Staff sign-in',
  robots: { index: false, follow: false },
};

/**
 * Where administrators sign in with a password.
 *
 * Customers authenticate with a one-time code at `/login`; administrators keep
 * the email + password path, unchanged, and this is where that form now lives.
 * It renders the same `SignInForm` posting to the same `loginAction` as
 * before — no new authentication module, no separate admin session, no second
 * credential store. Only the location of the form moved.
 *
 * **Why `/staff/login` and not `/admin/login`.** Everything under `/admin` is
 * gated by `admin/layout.tsx`, which sends an unauthenticated visitor to
 * `/login?next=/admin`. A sign-in form inside that segment is therefore
 * unreachable by exactly the person who needs it — signed out — and with
 * `/login` no longer offering a password field, that would be an admin
 * lockout. Living outside the guarded segment is what makes this page
 * reachable at all.
 *
 * **The URL grants nothing.** Anyone may open this page and anyone may post
 * the form. What decides the outcome is the role check inside `loginAction`,
 * which refuses a password sign-in for `role != 'admin'` after verifying the
 * password. Knowing this address does not help and not knowing it does not
 * protect; the boundary is on the server, where it can be tested.
 *
 * It deliberately has no dependency on SMTP. If mail delivery stops, customer
 * sign-in stops with it and this page keeps working — which is what makes an
 * email outage a degraded storefront rather than a locked console.
 */
export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next) ?? '/admin';

  // A customer who wanders in is sent to their own account rather than shown a
  // password form they cannot use.
  const user = await currentUser();
  if (user) redirect(user.role === 'admin' ? next : '/account');

  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-sm">
        <h1 className="heading-2 text-center">Staff sign-in</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          For iTarang staff accounts, using email and password.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <SignInForm next={next} />
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Shopping with us?{' '}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-2">
            Sign in with an email code
          </Link>
        </p>
      </div>
    </div>
  );
}
