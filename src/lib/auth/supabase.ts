import { cookies } from 'next/headers';
import { type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { env } from '@/lib/env';

/**
 * Supabase Auth, server-side only.
 *
 * The browser never talks to Supabase: every sign-in step is a Server Action or
 * a route handler here, and the session lives in `sb-…` cookies that
 * `@supabase/ssr` reads and writes through the adapter below. That keeps the
 * CSP's `connect-src` unchanged and means no Supabase key ships to the client.
 *
 * Returns null when `SUPABASE_URL` or `SUPABASE_ANON_KEY` is unset — local
 * development, CI, and any deployment that has not switched Supabase sign-in on.
 * Callers treat null as "no Supabase session", so the original sessions keep
 * working exactly as before.
 */
export async function supabaseAuth(): Promise<SupabaseClient | null> {
  const config = env();
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) return null;

  const store = await cookies();

  return createServerClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        // Next.js refuses cookie writes during a Server Component render. A
        // token refresh that happens there is not lost: `src/middleware.ts`
        // refreshes the session before any page renders and writes the
        // cookies on the response, which is the path that persists them.
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          // Render-time write; the middleware has it covered.
        }
      },
    },
  });
}

/** True when any `sb-` auth cookie is present — a cheap gate before a network call. */
export function hasSupabaseCookie(names: Iterable<string>): boolean {
  for (const name of names) {
    if (name.startsWith('sb-')) return true;
  }
  return false;
}
