import type { Metadata } from 'next';
import { ShieldAlert } from 'lucide-react';
import { requireUser } from '@/lib/auth/guards';
import { ChangePasswordForm } from '@/components/auth/auth-forms';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Change your password',
  robots: { index: false, follow: false },
};

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ forced?: string }>;
}) {
  const user = await requireUser('/change-password');
  const forced = Boolean((await searchParams).forced) || user.mustChangePassword;

  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-sm">
        <h1 className="heading-2 text-center">Change your password</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Signed in as {user.email}
        </p>

        {forced ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-sale" />
            <span>
              This account was created with a starting password. Choose your own before going any
              further.
            </span>
          </div>
        ) : null}

        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
