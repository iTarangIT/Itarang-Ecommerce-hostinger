import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Keeps a Supabase session's cookies fresh. Nothing else.
 *
 * A Supabase access token lives an hour and is renewed with a single-use
 * refresh token. Server Components cannot write cookies, so a renewal that
 * happened during a page render would be thrown away — and the next request
 * would present a refresh token Supabase has already spent, which signs the
 * person out. Middleware runs before the render and *can* write cookies on the
 * response, which is why Supabase requires the refresh to happen here.
 *
 * This is not an authorization layer. Who may see what is still decided in
 * layouts and route handlers by `currentUser()` (see `lib/auth/guards.ts`);
 * nothing here redirects or refuses.
 *
 * It costs nothing for a request without an `sb-` cookie — every anonymous
 * shopper and every original-session user — and nothing at all until
 * `SUPABASE_URL` and `SUPABASE_ANON_KEY` are configured.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return NextResponse.next();

  const hasSession = request.cookies.getAll().some((cookie) => cookie.name.startsWith('sb-'));
  if (!hasSession) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        // Written to the request too, so the page rendered for *this* request
        // already sees the renewed session rather than the expired one.
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        for (const [header, value] of Object.entries(headers ?? {})) {
          response.headers.set(header, value);
        }
      },
    },
  });

  // Verifies the token and renews it if it is close to expiry. The result is
  // not used here; the side effect on the cookies is the point.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  // Pages and server actions only — never static files, images or the
  // favicon, which carry no session worth refreshing.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)'],
};
