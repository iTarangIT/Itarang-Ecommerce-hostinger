import { NextResponse } from 'next/server';

/**
 * CSRF defence for the `POST /api/*` route handlers.
 *
 * Server Actions already get this from Next.js, which compares Origin against
 * Host on every action invocation. Route handlers get nothing, and several of
 * ours change state while reading a session cookie — the exact shape a
 * cross-site POST exploits.
 *
 * The check: **if the browser sent an Origin, it must be ours.** Browsers
 * attach Origin to every cross-origin POST, and to same-origin `fetch` too, so
 * a forged cross-site request is always caught. A request with no Origin at all
 * is not a browser doing CSRF — it is curl, a server-to-server call, or a
 * webhook — and is allowed through, because rejecting it would break the
 * gateway callbacks and every integration script without stopping any attack.
 *
 * `SameSite=Lax` on the session cookie already blocks the classic form-POST
 * case. This closes the gap for `fetch`-driven requests and does not rely on
 * cookie behaviour alone.
 */

export const CROSS_ORIGIN = {
  error: 'Cross-origin request refused.',
  code: 'cross_origin',
} as const;

/**
 * Returns a 403 response when the request is a cross-origin browser request,
 * or null when it may proceed.
 */
export function crossOriginRejection(request: Request): NextResponse | null {
  const origin = request.headers.get('origin');

  // No Origin: not a browser CSRF vector. See the note above.
  if (!origin) return null;

  // `host` is what the request was actually addressed to, which is what the
  // browser's Origin must match. Behind Hostinger's proxy this is the public
  // host, and the forwarded protocol does not affect the comparison because
  // only the host and port are compared.
  const host = request.headers.get('host');
  if (!host) return null;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return NextResponse.json(CROSS_ORIGIN, { status: 403 });
  }

  if (originHost === host) return null;

  return NextResponse.json(CROSS_ORIGIN, { status: 403 });
}
