import 'server-only';
import { City, State } from 'country-state-city';
import { STATES } from '@/lib/checkout/validation';

/**
 * Indian cities by state, from `country-state-city`.
 *
 * Server only: the package carries every country's cities (several MB), so the
 * browser asks `/api/geo/cities` for one state's list instead of bundling it.
 *
 * Our `STATES` list stays the source of state names (it carries the GST state
 * codes invoices need). The package's names match it today; a state the
 * package does not know simply has no cities, and the forms fall back to a
 * typed city.
 */

let isoByName: Map<string, string> | null = null;

function isoCode(stateName: string): string | undefined {
  if (!isoByName) {
    isoByName = new Map(
      State.getStatesOfCountry('IN').map((state) => [state.name.toLowerCase(), state.isoCode]),
    );
  }
  return isoByName.get(stateName.trim().toLowerCase());
}

const cache = new Map<string, string[]>();

/** The cities of one state, sorted and without repeats. Unknown state → []. */
export function indianCities(stateName: string): string[] {
  const state = STATES.find((s) => s.name.toLowerCase() === stateName.trim().toLowerCase());
  if (!state) return [];
  const hit = cache.get(state.name);
  if (hit) return hit;

  const iso = isoCode(state.name);
  const names = iso ? City.getCitiesOfState('IN', iso).map((city) => city.name.trim()) : [];
  const unique = [...new Set(names.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en-IN'));
  cache.set(state.name, unique);
  return unique;
}
