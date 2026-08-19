import { redirect } from 'next/navigation';
import { type SessionUser, currentUser } from './session';

/**
 * Authorization helpers for pages and layouts.
 *
 * These redirect, which is right for a person looking at a screen and wrong for
 * an API client. Route handlers should call `currentUser()` directly and answer
 * 401/403 themselves — a redirect to an HTML login page is a confusing reply to
 * a `fetch`.
 *
 * Every one of these queries the database, so none of them can run in
 * middleware. That is deliberate: the authorization boundary lives in the
 * layout and the route handler, where it can see real session state.
 */

/** Signed in, or bounced to sign-in with a return path. */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) {
    redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login');
  }
  return user;
}

/**
 * Signed in as an admin.
 *
 * A signed-in customer who guesses an admin URL is sent to the storefront, not
 * to the sign-in page: they are already authenticated, so asking them to
 * authenticate again would be a loop, and confirming that the URL exists is a
 * small information leak.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect('/login?next=%2Fadmin');
  if (user.role !== 'admin') redirect('/');
  return user;
}

export function isAdmin(user: SessionUser | null): boolean {
  return user?.role === 'admin';
}
