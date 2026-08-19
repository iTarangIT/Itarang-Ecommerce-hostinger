import type { Metadata } from 'next';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { ForgotPasswordForm } from '@/components/auth/auth-forms';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Reset your password',
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-sm">
        {params.sent ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <MailCheck className="mx-auto h-8 w-8 text-accent" />
            <h1 className="heading-3 mt-3">Check your inbox</h1>
            {/* Deliberately not "we sent an email to that address" — saying so
                would confirm whether an account exists. */}
            <p className="mt-2 text-sm text-muted-foreground">
              If that address has an iTarang account, a reset link is on its way. It works once
              and expires in an hour.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              <Link href="/login" className="underline underline-offset-2 hover:text-foreground">
                Back to sign in
              </Link>
            </p>
          </div>
        ) : (
          <>
            <h1 className="heading-2 text-center">Reset your password</h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Enter the email address on your account and we&apos;ll send you a link.
            </p>

            <div className="mt-6 rounded-xl border border-border bg-card p-6">
              <ForgotPasswordForm />
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              <Link href="/login" className="underline underline-offset-2 hover:text-foreground">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
