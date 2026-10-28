import { describe, expect, it, vi } from 'vitest';
import { lookupPincodePlace, placeFromDirectory } from './pincode-directory';

const GURGAON = [
  {
    Status: 'Success',
    PostOffice: [{ Name: 'Sector 50', District: 'Gurgaon', State: 'Haryana' }],
  },
];

describe('placeFromDirectory', () => {
  it('reads the district under its current name and our state name', () => {
    expect(placeFromDirectory(GURGAON)).toEqual({ city: 'Gurugram', state: 'Haryana' });
  });

  it('keeps a district that has not been renamed as written', () => {
    expect(
      placeFromDirectory([{ Status: 'Success', PostOffice: [{ District: 'Jaipur', State: 'Rajasthan' }] }]),
    ).toEqual({ city: 'Jaipur', state: 'Rajasthan' });
  });

  it('maps "&" in a state name and leaves an unknown state out', () => {
    expect(
      placeFromDirectory([
        { Status: 'Success', PostOffice: [{ District: 'South Andaman', State: 'Andaman & Nicobar Islands' }] },
      ])?.state,
    ).toBe('Andaman and Nicobar Islands');
    expect(
      placeFromDirectory([{ Status: 'Success', PostOffice: [{ District: 'X', State: 'Atlantis' }] }]),
    ).toEqual({ city: 'X', state: undefined });
  });

  it('returns nothing for an unknown pincode or a malformed body', () => {
    expect(placeFromDirectory([{ Status: 'Error', PostOffice: null }])).toBeNull();
    expect(placeFromDirectory({})).toBeNull();
    expect(placeFromDirectory(null)).toBeNull();
  });
});

describe('lookupPincodePlace', () => {
  it('asks the directory once per pincode', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(GURGAON), { status: 200 }));
    const f = fetchImpl as unknown as typeof fetch;
    expect(await lookupPincodePlace('122001', f)).toEqual({ city: 'Gurugram', state: 'Haryana' });
    expect(await lookupPincodePlace('122001', f)).toEqual({ city: 'Gurugram', state: 'Haryana' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fails soft, and does not remember a failure', async () => {
    const failing = vi.fn(async () => {
      throw new Error('timeout');
    });
    expect(await lookupPincodePlace('560001', failing as unknown as typeof fetch)).toBeNull();
    const working = vi.fn(async () =>
      new Response(JSON.stringify([{ Status: 'Success', PostOffice: [{ District: 'Bangalore', State: 'Karnataka' }] }])),
    );
    expect(await lookupPincodePlace('560001', working as unknown as typeof fetch)).toEqual({
      city: 'Bengaluru',
      state: 'Karnataka',
    });
  });
});
