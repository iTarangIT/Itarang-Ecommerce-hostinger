import { describe, expect, it } from 'vitest';
import { safeNext } from './redirects';

/**
 * The open-redirect guard on `?next=`.
 *
 * This is the only thing standing between a sign-in link and a phishing page
 * wearing our domain: `itarang.com/login?next=https://evil.example` looks like
 * our sign-in because it *is* our sign-in, and where it lands afterwards is
 * decided entirely here.
 *
 * Control characters are built from their code points rather than typed. A
 * literal tab or NUL inside a source string is invisible in a diff, so a test
 * that used one could be silently broken by any tool that touched the file.
 */

const chr = (code: number) => String.fromCharCode(code);

describe('safeNext accepts same-origin paths', () => {
  it.each([
    ['/account', '/account'],
    ['/account?tab=orders', '/account?tab=orders'],
    ['/c/batteries/lithium', '/c/batteries/lithium'],
    ['/p/trontek-powercube-1-4-tk12100#specs', '/p/trontek-powercube-1-4-tk12100#specs'],
    ['  /cart  ', '/cart'],
  ])('%s', (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});

describe('safeNext refuses anything that could leave the site', () => {
  it.each([
    'https://evil.example',
    'http://evil.example/account',
    '//evil.example',
    '//evil.example/account',
    '/\\evil.example',
    '\\/evil.example',
    '/account\\@evil.example',
    'javascript:alert(1)',
    'data:text/html,<script>',
    'account',
    '',
    '   ',
  ])('%s', (input) => {
    expect(safeNext(input)).toBeNull();
  });

  it('refuses a scheme-relative URL hidden behind a control character', () => {
    // Several browsers strip these before parsing, turning the value back into
    // a host. Built by code point so the bytes are unambiguous.
    for (const code of [0x00, 0x09, 0x0a, 0x0d, 0x1f, 0x7f]) {
      expect(safeNext(`/${chr(code)}/evil.example`)).toBeNull();
      expect(safeNext(`${chr(code)}//evil.example`)).toBeNull();
    }
  });

  it('refuses a non-string, however it arrives from a form', () => {
    // `FormData.get` returns `string | File | null`.
    expect(safeNext(null)).toBeNull();
    expect(safeNext(undefined)).toBeNull();
    expect(safeNext(42)).toBeNull();
    expect(safeNext({ toString: () => '/account' })).toBeNull();
  });

  it('refuses an absurdly long value rather than parsing it', () => {
    expect(safeNext(`/${'a'.repeat(2000)}`)).toBeNull();
  });

  it('never returns a value that is not a path on this site', () => {
    // The property, stated once: whatever comes back, resolving it against any
    // origin must stay on that origin.
    const inputs = [
      '/account',
      '/a?b=c#d',
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      `/${chr(9)}/evil.example`,
    ];
    for (const input of inputs) {
      const result = safeNext(input);
      if (result === null) continue;
      expect(result.startsWith('/')).toBe(true);
      expect(result.startsWith('//')).toBe(false);
      expect(new URL(result, 'https://example.test').origin).toBe('https://example.test');
    }
  });
});
