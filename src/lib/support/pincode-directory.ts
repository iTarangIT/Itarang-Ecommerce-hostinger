import { STATES } from '@/lib/checkout/validation';
import { cityKey } from '@/lib/geo/city-names';

/**
 * City and state for any Indian pincode, from India Post's public directory
 * (`api.postalpincode.in`). Server-only use.
 *
 * Used where our own coverage list (`serviceable_pincodes`) has no row, so
 * typing a pincode at checkout fills city and state for every shopper, not
 * only the listed areas (D-19, R-10). Best-effort by design: a slow or failed
 * directory means the shopper types the city, never a stopped checkout. The
 * shopper can always correct what was filled.
 */

export interface PincodePlace {
  city: string;
  /** One of `STATES[].name`, or absent when the directory's name is unknown. */
  state?: string;
}

const TIMEOUT_MS = 3000;
const CACHE_LIMIT = 5000;
const cache = new Map<string, PincodePlace | null>();

interface PostOffice {
  District?: string;
  State?: string;
}

/** The directory's answer, reduced to a city and one of our state names. */
export function placeFromDirectory(body: unknown): PincodePlace | null {
  const first = Array.isArray(body) ? (body[0] as { Status?: string; PostOffice?: PostOffice[] }) : null;
  const office = first?.Status === 'Success' ? first.PostOffice?.[0] : undefined;
  const district = office?.District?.trim();
  if (!district) return null;
  return { city: displayCity(district), state: stateName(office?.State) };
}

/** Today's name for a district, e.g. "Gurgaon" → "Gurugram". */
function displayCity(name: string): string {
  const key = cityKey(name);
  if (key === name.trim().toLowerCase()) return name.trim();
  return key.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stateName(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const wanted = raw.trim().toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ');
  return STATES.find((state) => state.name.toLowerCase() === wanted)?.name;
}

export async function lookupPincodePlace(
  pincode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PincodePlace | null> {
  if (cache.has(pincode)) return cache.get(pincode) ?? null;

  let place: PincodePlace | null = null;
  try {
    const response = await fetchImpl(`https://api.postalpincode.in/pincode/${pincode}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    place = placeFromDirectory(await response.json());
  } catch {
    // Not cached: a timeout says nothing about the pincode.
    return null;
  }

  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  cache.set(pincode, place);
  return place;
}
