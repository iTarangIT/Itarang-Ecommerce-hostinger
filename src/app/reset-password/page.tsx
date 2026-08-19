import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetPasswordForm } from '@/components/auth/auth-forms';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Choose a new password',
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token ?? '';

  // The token is not validated here, only on submit. Checking it on render
  // would mean redeeming or probing it every time a link is previewed by a mail
  // scanner, and would leak "this token is valid" to anyone who opens the page.
  if (!token) {
    return (
      <div className="container flex min-h-[60vh] items-center justify-center py-12">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center">
          <h1 className="heading-3">This link is incomplete</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Open the link from your email exactly as it was sent, or request a new one.
          </p>
          <p className="mt-4 text-sm">
            <Link
              href="/forgot-password"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Request a new reset link
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-sm">
        <h1 className="heading-2 text-center">Choose a new password</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Pick something you don&apos;t use anywhere else.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <ResetPasswordForm token={token} />
        </div>
      </div>
    </div>
  );
}
