import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from './users';

/**
 * `currentUser()` with a Supabase session.
 *
 * Supabase, the database and the cookie store are stand-ins: what is under
 * test is the decision, not the plumbing — which session wins, when an
 * identity counts as signed in, and when an admin row is allowed to act as one.
 */

const jar = new Map<string, string>();
const getClaims = vi.fn();
const findLinkedUser = vi.fn<(id: string) => Promise<AuthUser | null>>();
const queryOne = vi.fn();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
}));

vi.mock('./supabase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./supabase')>()),
  supabaseAuth: async () => ({ auth: { getClaims } }),
}));

vi.mock('./identity', () => ({ findLinkedUser }));

vi.mock('@/lib/db/pool', () => ({ query: vi.fn(), queryOne }));

const { currentUser } = await import('./session');

function account(role: AuthUser['role']): AuthUser {
  return {
    id: 7,
    email: 'person@example.invalid',
    role,
    fullName: null,
    phone: null,
    emailVerifiedAt: new Date(),
    mustChangePassword: false,
  };
}

function claims(aal: 'aal1' | 'aal2') {
  return { data: { claims: { sub: 'auth-uuid', aal } }, error: null };
}

beforeEach(() => {
  jar.clear();
  getClaims.mockReset();
  findLinkedUser.mockReset();
  queryOne.mockReset();
});

describe('currentUser with a Supabase session', () => {
  it('makes no call to Supabase when there is no sb- cookie', async () => {
    expect(await currentUser()).toBeNull();
    expect(getClaims).not.toHaveBeenCalled();
  });

  it('signs in a linked customer', async () => {
    jar.set('sb-project-auth-token', 'opaque');
    getClaims.mockResolvedValue(claims('aal1'));
    findLinkedUser.mockResolvedValue(account('customer'));

    const user = await currentUser();

    expect(findLinkedUser).toHaveBeenCalledWith('auth-uuid');
    expect(user).toMatchObject({ id: 7, role: 'customer', authSource: 'supabase', sessionId: null });
  });

  it('is nobody when the identity has no linked account', async () => {
    jar.set('sb-project-auth-token', 'opaque');
    getClaims.mockResolvedValue(claims('aal1'));
    findLinkedUser.mockResolvedValue(null);

    expect(await currentUser()).toBeNull();
  });

  it('is nobody when the token does not verify', async () => {
    jar.set('sb-project-auth-token', 'forged');
    getClaims.mockResolvedValue({ data: null, error: new Error('invalid JWT') });

    expect(await currentUser()).toBeNull();
    expect(findLinkedUser).not.toHaveBeenCalled();
  });

  it('serves an admin row as a customer until a second factor is verified', async () => {
    jar.set('sb-project-auth-token', 'opaque');
    getClaims.mockResolvedValue(claims('aal1'));
    findLinkedUser.mockResolvedValue(account('admin'));

    expect((await currentUser())!.role).toBe('customer');
  });

  it('serves an admin row as an admin at aal2', async () => {
    jar.set('sb-project-auth-token', 'opaque');
    getClaims.mockResolvedValue(claims('aal2'));
    findLinkedUser.mockResolvedValue(account('admin'));

    expect((await currentUser())!.role).toBe('admin');
  });

  it('prefers the original session, and does not consult Supabase when it is valid', async () => {
    jar.set('itarang_session', 'token');
    jar.set('sb-project-auth-token', 'opaque');
    queryOne.mockResolvedValue({
      session_id: 3,
      last_seen_at: new Date(),
      id: 9,
      email: 'original@example.invalid',
      role: 'customer',
      full_name: null,
      phone: null,
      email_verified_at: null,
      must_change_password: false,
    });

    const user = await currentUser();

    expect(user).toMatchObject({ id: 9, authSource: 'session', sessionId: 3 });
    expect(getClaims).not.toHaveBeenCalled();
  });
});
