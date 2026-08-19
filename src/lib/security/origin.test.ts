import { describe, expect, it } from 'vitest';
import { crossOriginRejection } from './origin';

/**
 * CSRF origin checking for route handlers.
 *
 * The property under test: a browser making a cross-site POST is always
 * refused, and everything that is not a browser CSRF vector still works.
 */

function request(headers: Record<string, string>): Request {
  return new Request('https://shop.itarang.com/api/checkout/cod', {
    method: 'POST',
    headers,
  });
}

describe('cross-origin rejection', () => {
  it('allows a same-origin request', () => {
    expect(
      crossOriginRejection(
        request({ origin: 'https://shop.itarang.com', host: 'shop.itarang.com' }),
      ),
    ).toBeNull();
  });

  it('refuses a request from another site', () => {
    const rejected = crossOriginRejection(
      request({ origin: 'https://evil.example', host: 'shop.itarang.com' }),
    );
    expect(rejected?.status).toBe(403);
  });

  it('refuses a lookalike host', () => {
    // shop.itarang.com.evil.example is a different site that contains our name.
    expect(
      crossOriginRejection(
        request({ origin: 'https://shop.itarang.com.evil.example', host: 'shop.itarang.com' }),
      )?.status,
    ).toBe(403);
  });

  it('refuses a subdomain it was not addressed to', () => {
    expect(
      crossOriginRejection(
        request({ origin: 'https://other.itarang.com', host: 'shop.itarang.com' }),
      )?.status,
    ).toBe(403);
  });

  it('compares host and port together', () => {
    expect(
      crossOriginRejection(
        request({ origin: 'http://localhost:3001', host: 'localhost:3000' }),
      )?.status,
    ).toBe(403);

    expect(
      crossOriginRejection(request({ origin: 'http://localhost:3000', host: 'localhost:3000' })),
    ).toBeNull();
  });

  it('ignores the scheme, which a proxy may terminate', () => {
    // Behind Hostinger's proxy the app may see http while the browser used
    // https; only host and port are compared.
    expect(
      crossOriginRejection(
        request({ origin: 'https://shop.itarang.com', host: 'shop.itarang.com' }),
      ),
    ).toBeNull();
  });

  it('allows a request with no Origin at all', () => {
    // Not a browser CSRF vector: curl, a server-to-server call, a webhook.
    // Refusing these would break gateway callbacks without stopping an attack.
    expect(crossOriginRejection(request({ host: 'shop.itarang.com' }))).toBeNull();
  });

  it('refuses an unparseable Origin rather than trusting it', () => {
    expect(
      crossOriginRejection(request({ origin: 'not a url', host: 'shop.itarang.com' }))?.status,
    ).toBe(403);
  });

  it('allows the request when there is no Host to compare against', () => {
    // Cannot make a judgement, so it does not pretend to.
    expect(crossOriginRejection(request({ origin: 'https://shop.itarang.com' }))).toBeNull();
  });
});
