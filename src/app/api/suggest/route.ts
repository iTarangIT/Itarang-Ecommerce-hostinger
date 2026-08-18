import { NextResponse } from 'next/server';
import { catalog } from '@/lib/commerce';

/**
 * Search suggestions.
 *
 * Deliberately a route handler rather than a client-side filter: it keeps the
 * catalogue out of the client bundle, and it is the same seam the Hostinger
 * provider will use once connected.
 */
export async function GET(request: Request) {
  const term = new URL(request.url).searchParams.get('q') ?? '';
  const suggestions = await catalog().suggest(term);
  return NextResponse.json({ suggestions });
}
