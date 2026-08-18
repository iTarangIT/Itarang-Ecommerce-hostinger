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
