import { NextResponse } from 'next/server';
import { type EmailOtpType } from '@supabase/supabase-js';
import { linkVisitorToUser, visitorContext } from '@/lib/analytics/events';
import { linkSupabaseIdentity } from '@/lib/auth/identity';
import { safeNext } from '@/lib/auth/redirects';
import { supabaseAuth } from '@/lib/auth/supabase';
import { env } from '@/lib/env';

/**
 * Where links in Supabase's emails land: confirm sign-up, reset password,
 * confirm a changed address.
 *
 * Two link shapes arrive here, and both end the same way — a Supabase session
 * in this browser's cookies, linked to a `users` row:
 *
 * - `?code=…`, the PKCE flow, exchanged for a session;
 * - `?token_hash=…&type=…`, verified as an email OTP.
 *
 * A link that does not verify, or an identity that cannot be linked (see
 * `identity.ts` for when that is), sends the person to sign-in with an error
 * flag and **no** session — a half-signed-in browser holding a Supabase
 * session with no account behind it would be worse than none.
 *
 * Redirects are built on `NEXT_PUBLIC_SITE_URL`, not on the request's own
 * URL: behind Hostinger's proxy the request URL can carry the internal host,
 * and a redirect to that would leave the site.
 */

const EMAIL_LINK_TYPES: ReadonlySet<string> = new Set<EmailOtpType>([
  'signup',
  'email',
  'magiclink',
  'recovery',
  'invite',
  'email_change',
]);

export async function GET(request: Request) {
  const site = env().NEXT_PUBLIC_SITE_URL;
  const params = new URL(request.url).searchParams;
  const failed = NextResponse.redirect(new URL('/login?error=link', site));

  const supabase = await supabaseAuth();
  if (!supabase) return failed;

  const code = params.get('code');
  const tokenHash = params.get('token_hash');
  const type = params.get('type');

  let verified = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  } else if (tokenHash && type && EMAIL_LINK_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    verified = !error;
  }
  if (!verified) return failed;

  // `getUser()` asks Supabase rather than trusting the fresh token, and it is
  // what carries `email_confirmed_at`, which linking depends on.
  const { data, error } = await supabase.auth.getUser();
  const identity = data?.user;
  const user =
    !error && identity
      ? await linkSupabaseIdentity({
          id: identity.id,
          email: identity.email,
          emailConfirmedAt: identity.email_confirmed_at,
        })
      : null;

  if (!user) {
    await supabase.auth.signOut({ scope: 'local' });
    return failed;
  }

  const visitor = await visitorContext();
  await linkVisitorToUser(visitor.visitorId, user.id);

  const fallback = type === 'recovery' ? '/change-password' : '/account';
  return NextResponse.redirect(new URL(safeNext(params.get('next')) ?? fallback, site));
}
