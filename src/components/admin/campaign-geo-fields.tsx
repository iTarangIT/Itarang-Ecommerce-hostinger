'use client';

import { useEffect, useState } from 'react';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import { Field } from '@/components/ui/field';

/**
 * States and cities for a campaign, both picked from lists — nothing typed.
 *
 * The city list follows the states: with states ticked it shows their cities,
 * grouped by state; with none it shows every state's. Cities already chosen
 * stay chosen when the states change, so unticking a state never quietly
 * drops a city the admin picked.
 */
export function CampaignGeoFields({
  states,
  defaultStates,
  defaultCities,
}: {
  states: string[];
  defaultStates: string[];
  defaultCities: string[];
}) {
  const [chosenStates, setChosenStates] = useState<string[]>(defaultStates);
  const [cityOptions, setCityOptions] = useState<MultiSelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams();
    for (const state of chosenStates.length > 0 ? chosenStates : ['all']) query.append('state', state);

    setLoading(true);
    setFailed(false);
    fetch(`/api/geo/cities?${query.toString()}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((body: { states: Array<{ state: string; cities: string[] }> }) => {
        setCityOptions(
          body.states.flatMap(({ state, cities }) => cities.map((city) => ({ value: city, group: state }))),
        );
        setLoading(false);
      })
      .catch((error: unknown) => {
        if ((error as Error).name === 'AbortError') return;
        setFailed(true);
        setLoading(false);
      });
    return () => controller.abort();
  }, [chosenStates]);

  return (
    <>
      <Field label="States" hint="Pick one, several, or Select all. None selected = any state.">
        <MultiSelect
          name="states"
          noun="states"
          emptyLabel="Any state"
          options={states.map((state) => ({ value: state }))}
          value={chosenStates}
          onChange={setChosenStates}
        />
      </Field>
      <Field
        label="Cities"
        hint={
          failed
            ? 'The city list could not be loaded. Reload the page to try again; cities already chosen are kept.'
            : chosenStates.length > 0
              ? 'Cities of the states above, grouped by state. None selected = any city in those states.'
              : 'Every city, grouped by state. Pick states first to shorten the list. None selected = any city.'
        }
      >
        <MultiSelect
          name="cities"
          noun="cities"
          emptyLabel="Any city"
          options={cityOptions}
          defaultValue={defaultCities}
          loading={loading}
        />
      </Field>
    </>
  );
}
