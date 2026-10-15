import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The email-link landing route. Supabase and the linking step are stand-ins;
 * what is checked is where each outcome sends the browser and that a failure
 * never leaves a Supabase session behind.
 */

const auth = {
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
};
const linkSupabaseIdentity = vi.fn();
const linkVisitorToUser = vi.fn();
let configured = true;

vi.mock('@/lib/auth/supabase', () => ({
  supabaseAuth: async () => (configured ? { auth } : null),
}));
vi.mock('@/lib/auth/identity', () => ({ linkSupabaseIdentity }));
vi.mock('@/lib/analytics/events', () => ({
  visitorContext: async () => ({ visitorId: 'visitor-1' }),
  linkVisitorToUser,
}));
vi.mock('@/lib/env', () => ({ env: () => ({ NEXT_PUBLIC_SITE_URL: 'https://shop.example' }) }));

const { GET } = await import('./route');

const SITE = 'https://shop.example';
const CONFIRMED_USER = {
  data: { user: { id: 'auth-uuid', email: 'a@example.invalid', email_confirmed_at: '2026-10-15' } },
  error: null,
};

function call(query: string) {
  // Deliberately an internal-looking host: redirects must not be built on it.
  return GET(new Request(`http://127.0.0.1:3000/auth/callback?${query}`));
}

beforeEach(() => {
  configured = true;
  for (const fn of Object.values(auth)) fn.mockReset();
  linkSupabaseIdentity.mockReset();
  linkVisitorToUser.mockReset();
  auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  auth.verifyOtp.mockResolvedValue({ error: null });
  auth.getUser.mockResolvedValue(CONFIRMED_USER);
  linkSupabaseIdentity.mockResolvedValue({ id: 42 });
});

describe('GET /auth/callback', () => {
  it('exchanges a PKCE code, links the account and lands on the account page', async () => {
    const response = await call('code=abc');

    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(linkSupabaseIdentity).toHaveBeenCalledWith({
      id: 'auth-uuid',
      email: 'a@example.invalid',
      emailConfirmedAt: '2026-10-15',
    });
    expect(linkVisitorToUser).toHaveBeenCalledWith('visitor-1', 42);
    expect(response.headers.get('location')).toBe(`${SITE}/account`);
  });

  it('verifies a token-hash link and honours a same-site next', async () => {
    const response = await call('token_hash=t&type=email&next=%2Fcart');

    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 't', type: 'email' });
    expect(response.headers.get('location')).toBe(`${SITE}/cart`);
  });

  it('sends a password-recovery link to the change-password page', async () => {
    const response = await call('token_hash=t&type=recovery');
    expect(response.headers.get('location')).toBe(`${SITE}/change-password`);
  });

  it('ignores an off-site next', async () => {
    const response = await call('code=abc&next=%2F%2Fevil.example');
    expect(response.headers.get('location')).toBe(`${SITE}/account`);
  });

  it('rejects an unknown link type without asking Supabase', async () => {
    const response = await call('token_hash=t&type=bogus');

    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBe(`${SITE}/login?error=link`);
  });

  it('fails without a session when the link does not verify', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: new Error('expired') });

    const response = await call('code=stale');

    expect(linkSupabaseIdentity).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBe(`${SITE}/login?error=link`);
  });

  it('signs the Supabase session out when the identity cannot be linked', async () => {
    linkSupabaseIdentity.mockResolvedValue(null);

    const response = await call('code=abc');

    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(linkVisitorToUser).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBe(`${SITE}/login?error=link`);
  });

  it('does nothing when Supabase sign-in is not configured', async () => {
    configured = false;

    const response = await call('code=abc');

    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBe(`${SITE}/login?error=link`);
  });
});
