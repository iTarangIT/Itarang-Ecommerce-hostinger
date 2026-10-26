import { STATES } from '@/lib/checkout/validation';
import { indianCities } from '@/lib/geo/india';

/**
 * `GET /api/geo/cities?state=Haryana[&state=Punjab…]` →
 * `{ states: [{ state: "Haryana", cities: ["Ambala", …] }] }`.
 *
 * `?state=all` returns every state. Public data, so it is cached by browsers
 * and the CDN for a day; nothing here depends on who is asking.
 */
export async function GET(request: Request): Promise<Response> {
  const asked = new URL(request.url).searchParams.getAll('state');
  const names = asked.includes('all')
    ? STATES.map((state) => state.name)
    : asked.filter((name) => STATES.some((state) => state.name === name)).slice(0, STATES.length);

  return Response.json(
    { states: names.map((state) => ({ state, cities: indianCities(state) })) },
    { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } },
  );
}
