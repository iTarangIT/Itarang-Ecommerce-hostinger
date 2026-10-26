'use client';

import { useEffect, useState } from 'react';
import { Input, Select } from '@/components/ui/field';

/**
 * The city of a delivery address, picked from the chosen state's cities.
 *
 * Picking rather than typing means the city on an order is spelled the way
 * campaigns name it, so a city-limited coupon matches. The list cannot hold
 * every town, so its last entry, "My city isn't listed", turns the field into
 * a text box — nobody is kept from checking out. A saved city that is not in
 * the list opens in that text box too.
 *
 * Until a state is chosen (or if the list cannot be loaded) it is a text box.
 */

const OTHER = '__other__';
const lists = new Map<string, string[]>();

export function CitySelect({
  id,
  name,
  state,
  value,
  onChange,
  required,
}: {
  id: string;
  name?: string;
  state: string;
  value: string;
  onChange: (city: string) => void;
  required?: boolean;
}) {
  const [cities, setCities] = useState<string[] | null>(() => lists.get(state) ?? null);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    setTyping(false);
    if (!state) {
      setCities(null);
      return;
    }
    const cached = lists.get(state);
    if (cached) {
      setCities(cached);
      return;
    }
    const controller = new AbortController();
    setCities(null);
    fetch(`/api/geo/cities?state=${encodeURIComponent(state)}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((body: { states: Array<{ state: string; cities: string[] }> }) => {
        const list = body.states[0]?.cities ?? [];
        lists.set(state, list);
        setCities(list);
      })
      .catch(() => setCities(null));
    return () => controller.abort();
  }, [state]);

  const listed = Boolean(cities && cities.length > 0);
  const known = listed && cities!.some((city) => city.toLowerCase() === value.trim().toLowerCase());
  const manual = !listed || typing || (value.trim() !== '' && !known);

  if (manual) {
    return (
      <div className="space-y-1">
        <Input
          id={id}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="address-level2"
          required={required}
          placeholder={state ? 'Type your city' : 'Choose your state first, or type your city'}
        />
        {listed ? (
          <button
            type="button"
            onClick={() => {
              setTyping(false);
              onChange('');
            }}
            className="text-xs font-medium text-primary hover:underline"
          >
            Pick from the list instead
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <Select
      id={id}
      name={name}
      value={known ? cities!.find((city) => city.toLowerCase() === value.trim().toLowerCase()) : ''}
      onChange={(event) => {
        if (event.target.value === OTHER) {
          setTyping(true);
          onChange('');
        } else {
          onChange(event.target.value);
        }
      }}
      autoComplete="address-level2"
      required={required}
    >
      <option value="" disabled>
        Select your city…
      </option>
      {cities!.map((city) => (
        <option key={city} value={city}>
          {city}
        </option>
      ))}
      <option value={OTHER}>My city isn&rsquo;t listed — type it</option>
    </Select>
  );
}
