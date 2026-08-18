import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdminAuthenticated } from '@/lib/admin/session';
import { LoginForm } from '@/components/admin/login-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin sign in',
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) redirect('/admin');

  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-sm">
        <h1 className="heading-2 text-center">Order console</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Local operations tool for reviewing and fulfilling test orders.
        </p>
        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
