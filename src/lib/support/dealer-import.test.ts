import { describe, expect, it } from 'vitest';
import {
  DealerSheetError,
  parseDealerCsv,
  planDealerImport,
  summariseDealerImport,
  type ExistingDealer,
  type SheetRow,
} from './dealer-import';

const HEADER = ['Name', 'Type', 'Address', 'City', 'State', 'Pincode', 'Phone', 'WhatsApp', 'Latitude', 'Longitude'];

function sheet(...rows: string[][]): SheetRow[] {
  return [HEADER, ...rows].map((cells, index) => ({ number: index + 1, cells }));
}

function row(name: string, pincode = '422304', phone = '', overrides: Partial<Record<string, string>> = {}): string[] {
  const base: Record<string, string> = {
    Name: name,
    Type: 'Dealer',
    Address: 'Shop 1, Main Road',
    City: 'Niphad',
    State: 'Maharashtra',
    Pincode: pincode,
    Phone: phone,
    WhatsApp: '',
    Latitude: '',
    Longitude: '',
    ...overrides,
  };
  return HEADER.map((column) => base[column]!);
}

const NONE: ExistingDealer[] = [];

describe('planDealerImport', () => {
  it('adds valid rows and normalises them', () => {
    const plan = planDealerImport(
      sheet(
        row('Sharma Battery', '422304', '+91 92086 77782', { State: 'maharashtra', Type: 'Service centre' }),
        row('Patil Batteries', '411001', '098765 43210', { Latitude: '18.52', Longitude: '73.85' }),
      ),
      NONE,
    );
    expect(plan.toAdd).toHaveLength(2);
    expect(plan.toAdd[0]).toMatchObject({ state: 'Maharashtra', kind: 'service-centre', phone: '9208677782' });
    expect(plan.toAdd[1]).toMatchObject({ kind: 'dealer', phone: '9876543210', latitude: 18.52, longitude: 73.85 });
  });

  it('skips a dealer already on file by phone, including a hidden one', () => {
    const existing: ExistingDealer[] = [
      { id: 1, name: 'sharma battery dealer', pincode: '422304', phone: '9208677782', whatsapp: null },
    ];
    const plan = planDealerImport(sheet(row('Sharma Batteries New Name', '400001', '92086-77782')), existing);
    expect(plan.toAdd).toHaveLength(0);
    expect(plan.outcomes[0]).toMatchObject({ kind: 'already-on-file', row: 2, existing: 'sharma battery dealer' });
  });

  it('skips a dealer already on file by name at the same pincode, ignoring case and punctuation', () => {
    const existing: ExistingDealer[] = [
      { id: 1, name: 'Sharma Battery House', pincode: '422304', phone: null, whatsapp: null },
    ];
    const plan = planDealerImport(
      sheet(row('sharma  battery-house', '422304'), row('Sharma Battery House', '422305')),
      existing,
    );
    expect(plan.outcomes.map((o) => o.kind)).toEqual(['already-on-file', 'add']);
  });

  it('keeps the first of two rows in the sheet that are the same dealer', () => {
    const plan = planDealerImport(
      sheet(
        row('A Batteries', '422304', '9000000001'),
        row('B Batteries', '422304', '9000000002'),
        row('A Batteries again', '411001', '+91 9000000001'),
        row('b batteries', '422304'),
      ),
      NONE,
    );
    expect(plan.toAdd.map((d) => d.name)).toEqual(['A Batteries', 'B Batteries']);
    expect(plan.outcomes.slice(2)).toEqual([
      { kind: 'duplicate-in-sheet', row: 4, name: 'A Batteries again', firstRow: 2 },
      { kind: 'duplicate-in-sheet', row: 5, name: 'b batteries', firstRow: 3 },
    ]);
  });

  it('matches a WhatsApp number against phones on file', () => {
    const existing: ExistingDealer[] = [{ id: 1, name: 'X', pincode: '110001', phone: '9811111111', whatsapp: null }];
    const plan = planDealerImport(sheet(row('Y', '122001', '', { WhatsApp: '9811111111' })), existing);
    expect(plan.outcomes[0]!.kind).toBe('already-on-file');
  });

  it('rejects rows it cannot use, with the reason and the Excel row number', () => {
    const plan = planDealerImport(
      sheet(
        row('', '422304'),
        row('Bad Pin', '42230'),
        row('Bad State', '422304', '', { State: 'Bombay' }),
        row('Bad Phone', '422304', '12345'),
        row('Bad Coords', '422304', '', { Latitude: '200' }),
      ),
      NONE,
    );
    expect(plan.toAdd).toHaveLength(0);
    expect(plan.outcomes).toEqual([
      { kind: 'invalid', row: 2, reason: 'missing name' },
      { kind: 'invalid', row: 3, reason: 'pincode "42230" is not 6 digits' },
      { kind: 'invalid', row: 4, reason: 'state "Bombay" is not an Indian state or UT' },
      { kind: 'invalid', row: 5, reason: 'phone "12345" is not a full number' },
      { kind: 'invalid', row: 6, reason: 'latitude/longitude is not a valid coordinate' },
    ]);
  });

  it('finds columns by name in any order and ignores blank rows', () => {
    const rows: SheetRow[] = [
      { number: 1, cells: ['Pin Code', 'Dealer Name', 'Mobile No', 'City', 'State', 'Shop Address', 'Notes'] },
      { number: 2, cells: ['422304', 'Sharma', '9208677782', 'Niphad', 'Maharashtra', 'Ugaon', 'x'] },
      { number: 3, cells: ['', '', '', '', '', '', ''] },
    ];
    const plan = planDealerImport(rows, NONE);
    expect(plan.toAdd).toEqual([expect.objectContaining({ name: 'Sharma', pincode: '422304', phone: '9208677782' })]);
  });

  it('refuses a sheet without the required columns', () => {
    expect(() => planDealerImport([{ number: 1, cells: ['Name', 'Phone'] }], NONE)).toThrow(DealerSheetError);
    expect(() => planDealerImport(sheet(), NONE)).toThrow(/no dealers/);
  });
});

describe('summariseDealerImport', () => {
  it('says what was added and why each skipped row was skipped', () => {
    const existing: ExistingDealer[] = [{ id: 1, name: 'Old', pincode: '422304', phone: '9000000009', whatsapp: null }];
    const plan = planDealerImport(
      sheet(row('A', '422304', '9000000001'), row('A2', '422304', '9000000001'), row('B', '422304', '9000000009'), row('C', '1')),
      existing,
    );
    expect(summariseDealerImport(plan)).toBe(
      '1 dealer added. 1 row skipped, already on file: row 4 (Old). 1 row skipped, repeated in the sheet: row 3 repeats row 2. 1 row not imported: row 5 pincode "1" is not 6 digits.',
    );
  });
});

describe('parseDealerCsv', () => {
  it('keeps commas inside quoted addresses and numbers rows as Excel would', () => {
    const rows = parseDealerCsv(
      '﻿Name,Address,City,State,Pincode\r\n"Sharma","Shop 4, MG Road","Gurugram",Haryana,122001\r\n\r\n"Say ""Hi"" Batteries",Lane 2,Pune,Maharashtra,411001\n',
    );
    expect(rows).toEqual([
      { number: 1, cells: ['Name', 'Address', 'City', 'State', 'Pincode'] },
      { number: 2, cells: ['Sharma', 'Shop 4, MG Road', 'Gurugram', 'Haryana', '122001'] },
      { number: 4, cells: ['Say "Hi" Batteries', 'Lane 2', 'Pune', 'Maharashtra', '411001'] },
    ]);
  });
});
