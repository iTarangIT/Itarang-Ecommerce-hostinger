import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, XCircle } from 'lucide-react';
import { verifyEmailAction } from '@/lib/auth/actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Confirm your email',
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token ?? '';

  // Redeeming on render is right here, unlike the reset page: the whole purpose
  // of opening this link is to spend the token, and there is no form to fill in
  // afterwards. A mail scanner that prefetches the link simply verifies the
  // address early, which is harmless.
  const verified = token ? await verifyEmailAction(token) : false;

  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center">
        {verified ? (
          <>
            <CheckCircle2 className="mx-auto h-8 w-8 text-accent" />
            <h1 className="heading-3 mt-3">Email confirmed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Thanks — your email address is confirmed.
            </p>
            <p className="mt-4 text-sm">
              <Link
                href="/account"
                className="font-medium underline underline-offset-2 hover:text-foreground"
              >
                Go to your account
              </Link>
            </p>
          </>
        ) : (
          <>
            <XCircle className="mx-auto h-8 w-8 text-muted-foreground" />
            <h1 className="heading-3 mt-3">This link is no longer valid</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Confirmation links work once and expire after 24 hours. If your address is already
              confirmed, there is nothing more to do.
            </p>
            <p className="mt-4 text-sm">
              <Link
                href="/account"
                className="font-medium underline underline-offset-2 hover:text-foreground"
              >
                Go to your account
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
