/**
 * Where a sign-in is allowed to send somebody afterwards.
 *
 * Deliberately **not** in `actions.ts`. That module is `'use server'`, and every
 * export of a `'use server'` module is a callable endpoint — so a helper
 * exported from there to be unit-tested would become a public one. Keeping the
 * rule here means it can be tested directly, which matters more for this
 * function than for most: it is the whole of the open-redirect defence, and an
 * open redirect on a sign-in page is how a phishing link borrows our domain to
 * look legitimate.
 */

/**
 * True for any character a URL parser might strip or normalise away.
 *
 * Written as a code-point comparison rather than a regular expression on
 * purpose: the characters it is about cannot be typed into a source file
 * safely, and a literal control byte in a regex is invisible in every diff it
 * ever appears in.
 */
function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * A `?next=` value reduced to a same-origin path, or null.
 *
 * Everything that is not plainly a path on this site is rejected rather than
 * repaired. The caller falls back to its own default, so refusing costs a
 * shopper nothing.
 *
 * What each rule is for:
 *
 * - must start with `/` — rejects `https://evil.example` and any absolute form.
 * - `//` is rejected — a scheme-relative URL the browser treats as another host.
 * - `\` is rejected anywhere in the value — several browsers normalise
 *   `/\evil.example` to a scheme-relative URL, so a backslash is treated as
 *   hostile rather than reasoned about.
 * - control characters are rejected — a tab or newline inside `//` is stripped
 *   by some parsers, which turns the value back into a host.
 * - finally the value is resolved against a throwaway origin and required still
 *   to be on it, so anything that survives the rules above but still parses as
 *   another origin is caught by the URL parser rather than by our reading of it.
 */
export function safeNext(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim() : '';

  if (value.length === 0 || value.length > 1024) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.includes('\\')) return null;
  if (hasControlCharacter(value)) return null;

  // The origin is arbitrary and never used; it exists so a relative path can be
  // parsed at all. If parsing moves the value off it, it was not relative.
  const base = 'https://itarang.invalid';
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return null;
  }
  if (url.origin !== base) return null;

  return `${url.pathname}${url.search}${url.hash}`;
}
