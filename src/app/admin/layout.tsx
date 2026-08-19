import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/guards';

/**
 * The admin authorization boundary.
 *
 * Everything under `/admin` is gated here, once. Before this existed the check
 * was three hand-copied `if (!(await isAdminAuthenticated())) redirect(...)`
 * lines in three page files, which meant a new admin page was public unless its
 * author remembered — the wrong default for the part of the app that can read
 * every customer's address and change order state.
 *
 * A layout is the right place because it runs on the server for every matched
 * route beneath it and can query the database. Middleware cannot: it runs in
 * the Edge runtime, where `pg` is unavailable, so it can never be the thing
 * that decides who is an admin.
 *
 * `force-dynamic` matters as much as the guard: a statically rendered admin
 * page would be built once and served to everyone.
 */

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  // An account created by the bootstrap CLI starts with a password somebody
  // typed into a terminal. It does not get to reach the order console until
  // that has been replaced.
  if (user.mustChangePassword) redirect('/change-password?forced=1');

  return <>{children}</>;
}
