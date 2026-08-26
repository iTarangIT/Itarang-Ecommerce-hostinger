import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Safety assertions that guard the project's standing constraints.
 *
 * These are not unit tests of behaviour — they are tripwires. Each one fails if
 * a future change quietly breaks a rule this project committed to.
 */

const ROOT = resolve(__dirname, '../..');

function readAll(dir: string, extensions: string[]): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (extensions.some((ext) => entry.endsWith(ext))) {
        out.push({ path: full, text: readFileSync(full, 'utf8') });
      }
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

describe('Hostinger remains read-only', () => {
  const files = readAll(join(ROOT, 'src/lib/commerce/hostinger'), ['.ts']);

  it('has source files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('never sets a non-GET HTTP method', () => {
    for (const file of files) {
      // Comments legitimately mention POST; code must not set a method.
      const code = file.text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code, `${file.path} sets an HTTP method`).not.toMatch(
        /method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/i,
      );
    }
  });

  it('exposes no write helper from the client module', () => {
    const client = files.find((f) => f.path.endsWith('client.ts'));
    expect(client).toBeDefined();
    const exported = [...client!.text.matchAll(/export function (\w+)/g)].map((m) => m[1]);
    for (const name of exported) {
      expect(name, `client.ts exports "${name}", which reads like a write`).not.toMatch(
        /^(post|put|patch|delete|create|update|remove|sync\w*To)/i,
      );
    }
  });

  it('never calls the Hostinger checkout endpoint', () => {
    const all = readAll(join(ROOT, 'src'), ['.ts', '.tsx']);
    for (const file of all) {
      const code = file.text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code, `${file.path} references the Hostinger checkout endpoint`).not.toMatch(
        /store\/\$\{[^}]+\}\/checkout/,
      );
    }
  });
});

describe('no payment secret can reach the browser', () => {
  const clientChunks = join(ROOT, '.next/static');

  it('the built client bundle contains no gateway key or secret', () => {
    if (!existsSync(clientChunks)) {
      throw new Error(
        'No client build found. Run `npm run build` before the test suite — ' +
          'this assertion inspects the emitted bundle.',
      );
    }

    const bundles = readAll(clientChunks, ['.js']);
    expect(bundles.length).toBeGreaterThan(0);

    for (const bundle of bundles) {
      expect(bundle.text, `${bundle.path} contains a Razorpay key`).not.toMatch(/rzp_(test|live)_/);
      expect(bundle.text, `${bundle.path} references the key secret`).not.toContain(
        'RAZORPAY_KEY_SECRET',
      );
      expect(bundle.text, `${bundle.path} references the webhook secret`).not.toContain(
        'RAZORPAY_WEBHOOK_SECRET',
      );
      expect(bundle.text, `${bundle.path} contains a database URL`).not.toMatch(
        /postgres(ql)?:\/\/[^\s"']*@/,
      );
      // The SMTP password is a live mailbox credential — worse to leak than a
      // test payment key, because it can send mail as us.
      expect(bundle.text, `${bundle.path} references the SMTP password`).not.toContain(
        'SMTP_PASSWORD',
      );
    }
  });

  it('marks the secrets as server-only in source', () => {
    const all = readAll(join(ROOT, 'src'), ['.ts', '.tsx']);
    for (const file of all) {
      if (file.path.includes('security.test')) continue;
      // A NEXT_PUBLIC_ prefix on either secret would publish it.
      expect(file.text, `${file.path} exposes a secret publicly`).not.toMatch(
        /NEXT_PUBLIC_RAZORPAY_(KEY_SECRET|WEBHOOK_SECRET)/,
      );
      expect(file.text, `${file.path} exposes the database URL publicly`).not.toMatch(
        /NEXT_PUBLIC_DATABASE_URL/,
      );
      expect(file.text, `${file.path} exposes the SMTP password publicly`).not.toMatch(
        /NEXT_PUBLIC_SMTP/,
      );
    }
  });
});

describe('the admin area stays behind its boundary', () => {
  const adminDir = join(ROOT, 'src', 'app', 'admin');

  it('has a layout that calls requireAdmin', () => {
    // The whole point of the layout is that a new page under /admin inherits
    // the check instead of having to remember it. If this file loses its
    // guard, every admin page silently becomes public.
    const layout = join(adminDir, 'layout.tsx');
    expect(existsSync(layout), 'src/app/admin/layout.tsx is missing').toBe(true);

    const text = readFileSync(layout, 'utf8');
    expect(text, 'the admin layout does not call requireAdmin()').toMatch(/requireAdmin\s*\(/);
    expect(text, 'the admin layout is not force-dynamic').toMatch(
      /dynamic\s*=\s*['"]force-dynamic['"]/,
    );
  });

  it('no admin page renders data without the layout above it', () => {
    // A page directly under src/app/ that happens to be named "admin" would
    // escape the boundary; so would a route handler, which layouts do not
    // wrap at all.
    const handlers = readAll(adminDir, ['route.ts']);
    for (const handler of handlers) {
      expect(
        handler.text,
        `${handler.path} is a route handler under /admin — layouts do not guard these, ` +
          'so it must check authorization itself',
      ).toMatch(/requireAdmin|currentUser/);
    }
  });

  it('the shared-password admin login is gone', () => {
    // Two credential systems guarding the same pages means the weaker one sets
    // the security level. This asserts the old one stayed deleted.
    expect(existsSync(join(ROOT, 'src', 'lib', 'admin', 'session.ts'))).toBe(false);

    const all = readAll(join(ROOT, 'src'), ['.ts', '.tsx']);
    for (const file of all) {
      if (file.path.includes('security.test')) continue;
      // Comments legitimately explain what was removed and why; code must not
      // call it. Same treatment the Hostinger tripwire gives HTTP methods.
      const code = file.text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code, `${file.path} still references the retired admin session`).not.toMatch(
        /isAdminAuthenticated|createAdminSession|ADMIN_SESSION_SECRET|ADMIN_PASSWORD_HASH/,
      );
    }
  });
});

describe('order placement requires an authenticated customer', () => {
  it('both placement routes gate on a session', () => {
    // These two write orders, items, reservations and events. A route that
    // loses this check would silently reopen guest checkout, and the schema
    // cannot catch it: orders.user_id is nullable so that historical guest
    // orders stay valid, so the invariant lives in code and here.
    for (const route of ['order', 'cod']) {
      const path = join(ROOT, 'src', 'app', 'api', 'checkout', route, 'route.ts');
      const text = readFileSync(path, 'utf8');

      expect(text, `${route}/route.ts does not require a customer`).toMatch(
        /requireCustomer\s*\(/,
      );
      expect(text, `${route}/route.ts does not attach the owner to the order`).toMatch(
        /userId:\s*auth\.user\.id/,
      );
    }
  });

  it('placeOrder cannot be called without an owner', () => {
    // A required (non-optional) userId is what makes the compiler enforce this
    // at every call site rather than relying on review.
    const text = readFileSync(join(ROOT, 'src', 'lib', 'orders', 'place-order.ts'), 'utf8');
    expect(text, 'PlaceOrderInput.userId must not be optional').toMatch(/^\s*userId: number;/m);
  });

  it('the checkout page is gated too, not just the API', () => {
    const text = readFileSync(join(ROOT, 'src', 'app', 'checkout', 'page.tsx'), 'utf8');
    expect(text, 'the checkout page does not require a user').toMatch(/requireUser\s*\(/);
  });
});

describe('order-mutating checkout endpoints check ownership', () => {
  it('retry, simulate and verify require entitlement to the order', () => {
    // All three take an order number and change payment state. Knowing a
    // number must never be enough: simulate could drive any order to paid,
    // retry replaced the gateway order id, orphaning a payment already in
    // flight, and verify wrote a payments row and disclosed the order's state
    // to anyone who asked.
    for (const route of ['retry', 'simulate', 'verify']) {
      const text = readFileSync(
        join(ROOT, 'src', 'app', 'api', 'checkout', route, 'route.ts'),
        'utf8',
      );
      expect(text, `${route}/route.ts does not check order ownership`).toMatch(
        /requireOrderAccess\s*\(/,
      );
      expect(
        text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''),
        `${route}/route.ts still looks the order up without an entitlement check`,
      ).not.toMatch(/findByOrderNumber\s*\(/);
    }
  });

  it('simulate is closed the moment a real gateway is configured', () => {
    // The provider, not NODE_ENV, is what makes simulation safe: this build is
    // deployed running the mock, and a production deployment on mock still
    // needs its test payments to complete.
    const text = readFileSync(
      join(ROOT, 'src', 'app', 'api', 'checkout', 'simulate', 'route.ts'),
      'utf8',
    );
    expect(text, 'simulate does not check the provider is the mock').toMatch(
      /instanceof MockPaymentProvider/,
    );
  });
});

describe('the payment model is enforced where it is written', () => {
  it('the repository consults the transition tables, not just rank', () => {
    // PAYMENT_TRANSITIONS and canTransitionOrder existed but were referenced
    // only from tests — rank alone decided, which would have permitted
    // pending → refunded, and transitionOrderStatus wrote whatever it was
    // handed.
    const text = readFileSync(
      join(ROOT, 'src', 'lib', 'orders', 'postgres-repository.ts'),
      'utf8',
    );
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    expect(code, 'applyPaymentStatus does not check the payment transition table').toMatch(
      /canTransitionPayment\s*\(/,
    );
    expect(code, 'transitionOrderStatus does not validate the order transition').toMatch(
      /canTransitionOrder\s*\(/,
    );
  });

  it('the order INSERT retry runs inside a savepoint', () => {
    // A failed statement aborts the transaction in PostgreSQL, so without a
    // savepoint the collision retry could only ever hit 25P02.
    const text = readFileSync(
      join(ROOT, 'src', 'lib', 'orders', 'postgres-repository.ts'),
      'utf8',
    );
    expect(text, 'no SAVEPOINT around the order insert retry').toMatch(/SAVEPOINT \$\{savepoint\}/);
    expect(text, 'no ROLLBACK TO SAVEPOINT on the failure path').toMatch(
      /ROLLBACK TO SAVEPOINT/,
    );
  });
});

describe('abuse-prone endpoints are rate limited', () => {
  it('every authentication action counts against a limit', () => {
    // Unlimited sign-in attempts are both a credential attack and, because
    // each one runs scrypt, a cheap way to burn server CPU.
    const text = readFileSync(join(ROOT, 'src', 'lib', 'auth', 'actions.ts'), 'utf8');
    for (const marker of [
      'login:',
      'login:ip:',
      'register:ip:',
      'reset:',
      'verify-resend:user:',
      'change-password:user:',
    ]) {
      expect(text, `no rate-limit bucket for ${marker}`).toContain(marker);
    }
  });

  it('the guest order lookup is limited', () => {
    // Order number + a 10-digit phone is brute-forceable given unlimited tries.
    const text = readFileSync(
      join(ROOT, 'src', 'app', 'api', 'orders', '[orderNumber]', 'route.ts'),
      'utf8',
    );
    expect(text, 'the guest lookup path is not rate limited').toContain('order-lookup:ip:');
  });

  it('the webhook is deliberately not throttled', () => {
    // Throttling the gateway would drop real payment notifications during a
    // burst. Its credential is the HMAC, and replay is already a no-op.
    const text = readFileSync(
      join(ROOT, 'src', 'app', 'api', 'webhooks', 'payment', 'route.ts'),
      'utf8',
    );
    expect(text, 'the webhook must not be rate limited').not.toContain('rate-limit');
  });
});

describe('state-changing API handlers check the request origin', () => {
  it('checkout handlers pass the request through the origin check', () => {
    // Server Actions get this from Next.js; route handlers get nothing, and
    // these read a session cookie while changing state.
    for (const route of ['order', 'cod']) {
      const text = readFileSync(
        join(ROOT, 'src', 'app', 'api', 'checkout', route, 'route.ts'),
        'utf8',
      );
      expect(text, `${route}/route.ts does not pass the request for an origin check`).toMatch(
        /requireCustomer\(request\)/,
      );
    }

    for (const route of ['retry', 'simulate', 'verify']) {
      const text = readFileSync(
        join(ROOT, 'src', 'app', 'api', 'checkout', route, 'route.ts'),
        'utf8',
      );
      expect(text, `${route}/route.ts does not pass the request for an origin check`).toMatch(
        /requireOrderAccess\([^)]*request\)/,
      );
    }
  });
});

describe('the quote endpoint is gated like the rest of checkout', () => {
  it('requires a session, an origin check and its own rate limit', () => {
    // This was the one checkout endpoint anybody could call: no origin check,
    // no session, no limit — and every call fans out into a full catalogue
    // read. Requiring a session costs nothing legitimate, because /checkout
    // already calls requireUser before this endpoint is ever reached.
    const text = readFileSync(
      join(ROOT, 'src', 'app', 'api', 'checkout', 'quote', 'route.ts'),
      'utf8',
    );

    expect(text, 'quote/route.ts does not gate on a customer session').toMatch(
      /requireCustomer\(request[,)]/,
    );
    expect(text, 'quote/route.ts must not share the order-placement rate limit').toMatch(
      /LIMITS\.quote/,
    );
  });
});

describe('the displayed price cannot become the charged price', () => {
  it('placeOrder prices from its own quote, never from the client', () => {
    // `expectedTotal` is what the browser displayed. It exists so a price that
    // moved between the quote and the submit is caught and shown, and it must
    // never reach a money column: the whole guarantee is that it can refuse an
    // order but not price one.
    const text = readFileSync(join(ROOT, 'src', 'lib', 'orders', 'place-order.ts'), 'utf8');

    expect(text, 'placeOrder does not compare the displayed total').toMatch(
      /input\.expectedTotal !== quote\.totals\.total/,
    );
    expect(text, 'the order total must come from the server quote').toMatch(
      /total:\s*quote\.totals\.total/,
    );
    // The failure this guards against: assigning the client's figure to any
    // amount on the order.
    expect(text, 'an order amount is being taken from the client').not.toMatch(
      /(total|subtotal|unitPrice|lineTotal):\s*input\.expectedTotal/,
    );
  });

  it('no request schema accepts a price for an item', () => {
    const text = readFileSync(join(ROOT, 'src', 'lib', 'checkout', 'validation.ts'), 'utf8');
    // Line-level money from the client would be a real hole; a single advisory
    // cart total that can only cause a refusal is not.
    expect(text, 'quoteLineSchema must not accept prices').not.toMatch(
      /quoteLineSchema[\s\S]{0,200}(price|amount|total)\s*:/,
    );
  });
});

describe('single-use coupons are enforced server-side', () => {
  it('placement checks past redemptions and records new ones', () => {
    // coupon_redemptions existed from the first migration and nothing ever
    // wrote to it, so "one per customer" was unenforceable and FIRST5 — a
    // first-order discount — could be used on every order forever.
    const placeOrder = readFileSync(
      join(ROOT, 'src', 'lib', 'orders', 'place-order.ts'),
      'utf8',
    );
    expect(placeOrder, 'placement does not check for a previous redemption').toMatch(
      /hasRedeemedCoupon\(/,
    );

    const repository = readFileSync(
      join(ROOT, 'src', 'lib', 'orders', 'postgres-repository.ts'),
      'utf8',
    );
    expect(repository, 'redemptions are never recorded').toMatch(
      /INSERT INTO coupon_redemptions/,
    );
  });

  it('the client-safe coupon module never reads the database', () => {
    // It is imported by cart UI, so a database import here would both break
    // the bundle and move the check somewhere the browser could skip.
    const text = readFileSync(join(ROOT, 'src', 'lib', 'offers', 'coupons.ts'), 'utf8');
    expect(text, 'coupons.ts must stay client-safe').not.toMatch(/@\/lib\/db|from 'pg'/);
  });
});

describe('security headers are configured', () => {
  it('sets the headers a live deployment needs', () => {
    const text = readFileSync(join(ROOT, 'next.config.mjs'), 'utf8');
    for (const header of [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'Strict-Transport-Security',
      'Content-Security-Policy-Report-Only',
    ]) {
      expect(text, `${header} is not set`).toContain(header);
    }
    expect(text, 'the Next.js version header is still advertised').toMatch(
      /poweredByHeader:\s*false/,
    );
  });

  it('does not enforce a CSP that would break the running site', () => {
    // Next.js emits inline bootstrap scripts, so enforcing without nonces
    // would white-screen the storefront. Report-Only is the deliberate state
    // until nonces exist — this asserts the choice was made, not forgotten.
    const text = readFileSync(join(ROOT, 'next.config.mjs'), 'utf8');
    expect(text).not.toMatch(/key:\s*'Content-Security-Policy'/);
  });

  it('keeps API responses out of shared caches by default', () => {
    const text = readFileSync(join(ROOT, 'next.config.mjs'), 'utf8');
    expect(text, 'API responses are not marked no-store').toContain('no-store');
  });

  it('only ever exempts the three impersonal catalogue endpoints from no-store', () => {
    // Caching is opt-in by an exact list. This is the tripwire for widening
    // that list: anything carrying a session, an order or a payment must never
    // reach a shared cache, and the failure mode is one customer being served
    // another's data.
    const text = readFileSync(join(ROOT, 'next.config.mjs'), 'utf8');

    const cacheable = text.match(/source: '\/api\/:path\(([a-z|-]+)\)'/);
    expect(cacheable, 'the cacheable API allow-list is missing or reshaped').not.toBeNull();

    const allowed = (cacheable?.[1] ?? '').split('|').sort();
    expect(allowed, 'the cacheable API allow-list changed').toEqual([
      'cross-sell',
      'products',
      'suggest',
    ]);

    // And the endpoints that must never be in it.
    for (const forbidden of ['checkout', 'orders', 'webhooks', 'diagnostics']) {
      expect(allowed, `${forbidden} must never be cacheable`).not.toContain(forbidden);
    }
  });

  it('the cacheable endpoints read nothing personal', () => {
    // The justification for exempting them, asserted rather than assumed: the
    // moment one of these reads a cookie or a session, its cached response
    // would be somebody's private data sitting in a shared cache.
    for (const route of ['suggest', 'products', 'cross-sell']) {
      const text = readFileSync(join(ROOT, 'src', 'app', 'api', route, 'route.ts'), 'utf8');
      expect(text, `${route} reads a cookie but is publicly cacheable`).not.toMatch(
        /cookies\(\)|currentUser\(|hasOrderAccess\(/,
      );
    }
  });
});

describe('diagnostics are authorized, not environment-gated', () => {
  it('the Hostinger diagnostics endpoint requires an admin', () => {
    // It previously returned 404 only when NODE_ENV === 'production', so every
    // staging or preview deploy published the sales channel id and the
    // upstream mapping to anyone who asked. An env var is a deployment
    // detail, not an authorization decision.
    const path = join(ROOT, 'src', 'app', 'api', 'diagnostics', 'hostinger', 'route.ts');
    const text = readFileSync(path, 'utf8');
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    expect(code, 'diagnostics does not check the caller').toMatch(/currentUser\s*\(/);
    expect(code, "diagnostics does not require role 'admin'").toMatch(/role\s*!==\s*'admin'/);
    expect(code, 'diagnostics is still gated on NODE_ENV').not.toMatch(/NODE_ENV/);
  });
});

describe('order access is decided server-side', () => {
  it('the device cookie is signed', () => {
    // It used to be an unsigned list defended only by httpOnly, which does not
    // stop a client sending the header directly.
    const text = readFileSync(join(ROOT, 'src', 'lib', 'orders', 'access.ts'), 'utf8');
    expect(text, 'the order access cookie is not HMAC signed').toMatch(/createHmac/);
    expect(text, 'the order access cookie is not compared in constant time').toMatch(
      /timingSafeEqual/,
    );
  });

  it('ownership is filtered in SQL, not compared after fetching', () => {
    const text = readFileSync(
      join(ROOT, 'src', 'lib', 'orders', 'postgres-repository.ts'),
      'utf8',
    );
    expect(text, 'findForOwner does not constrain on user_id').toMatch(
      /order_number = \$1 AND user_id = \$2/,
    );
    expect(text, 'listOrdersForUser does not constrain on user_id').toMatch(
      /FROM orders WHERE user_id = \$1/,
    );
  });
});

describe('server actions authorize independently of any layout', () => {
  it('every mutating admin action checks the caller', () => {
    // A Server Action is reached by POSTing to its id, not by rendering a page,
    // so admin/layout.tsx does not protect it. Each one must check for itself.
    const actions = readFileSync(join(ROOT, 'src', 'lib', 'admin', 'actions.ts'), 'utf8');
    const exported = [...actions.matchAll(/export async function (\w+)/g)].map((m) => m[1]);

    expect(exported.length).toBeGreaterThan(0);
    for (const name of exported) {
      const body = actions.slice(actions.indexOf(`export async function ${name}`));
      expect(
        body.slice(0, body.indexOf('\n}')),
        `${name} does not establish the caller is an admin`,
      ).toMatch(/requireAdminActor|currentUser/);
    }
  });
});

describe('database access is confined to the guarded pool', () => {
  it('no module constructs a pg client directly except the pool and scripts', () => {
    const all = readAll(join(ROOT, 'src'), ['.ts', '.tsx']);
    for (const file of all) {
      if (file.path.endsWith(join('lib', 'db', 'pool.ts'))) continue;
      const code = file.text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code, `${file.path} constructs its own database connection`).not.toMatch(
        /new\s+(Pool|Client)\s*\(/,
      );
    }
  });
});
