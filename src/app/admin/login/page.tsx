import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Kept only so an old bookmark lands somewhere sensible.
 *
 * There is no separate admin sign-in any more — admins use `/login` like
 * everyone else and are told apart by `users.role`. This route sits under
 * `admin/layout.tsx`, so an unauthenticated visitor is already redirected to
 * `/login?next=/admin` before this page renders; anyone who does reach it is
 * an authenticated admin and belongs on the console.
 */
export default function AdminLoginRedirect(): never {
  redirect('/admin');
}
