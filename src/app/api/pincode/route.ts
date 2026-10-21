import { NextResponse } from 'next/server';
import { LIMITS, callerIp, consume } from '@/lib/security/rate-limit';
import { lookupPincode } from '@/lib/support/serviceability-server';

/**
 * Delivery check for one pincode: `GET /api/pincode?code=110001`.
 *
 * Public and read-only, and returns only coverage — never anything about a
 * customer. Rate-limited per IP so the coverage list cannot be scraped by
 * walking every pincode in India.
 */
export async function GET(request: Request) {
  const limit = await consume(`pincode:ip:${await callerIp()}`, LIMITS.pincodeLookup);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many checks. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(limit.resetSeconds ?? 60) } },
    );
  }

  const code = new URL(request.url).searchParams.get('code') ?? '';
  const result = await lookupPincode(code);
  if ('error' in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
