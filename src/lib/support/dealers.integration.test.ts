import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { planDealerImport, type SheetRow } from './dealer-import';
import { createDealers, listDealerKeys, setDealerActive } from './dealers';

/**
 * Bulk dealer upload against a real database: the rows are written, and a
 * second upload of the same sheet — including after a dealer is hidden — adds
 * nothing.
 */

function targetsRemote(): boolean {
  const raw = process.env.DATABASE_URL;
  if (!raw) return false;
  try {
    return !isLocalHost(inspectDatabaseUrl(raw).host);
  } catch {
    return false;
  }
}

const REMOTE = targetsRemote();
const CONFIGURED =
  Boolean(process.env.DATABASE_URL) && (!REMOTE || process.env.DB_ALLOW_REMOTE_TESTS === 'true');

const ACTOR = 'dealer-import-test@example.com';
const SHEET: SheetRow[] = [
  { number: 1, cells: ['Name', 'Address', 'City', 'State', 'Pincode', 'Phone'] },
  { number: 2, cells: ['Fixture Dealer One', 'Shop 1', 'Pune', 'Maharashtra', '411001', '9000000071'] },
  { number: 3, cells: ['Fixture Dealer Two', 'Shop 2', 'Pune', 'Maharashtra', '411002', '9000000072'] },
];

async function cleanUp(): Promise<void> {
  await query(`DELETE FROM dealers WHERE updated_by = $1`, [ACTOR]);
}

describe.skipIf(!CONFIGURED)('bulk dealer upload', () => {
  beforeEach(cleanUp);
  afterAll(async () => {
    await cleanUp();
    await closePool();
  });

  it('writes the sheet once; the same sheet again adds nothing, even after a dealer is hidden', async () => {
    const first = planDealerImport(SHEET, await listDealerKeys());
    expect(await createDealers(first.toAdd, ACTOR)).toBe(2);

    const rows = await query<{ id: number; name: string; phone: string }>(
      `SELECT id, name, phone FROM dealers WHERE updated_by = $1 ORDER BY name`,
      [ACTOR],
    );
    expect(rows.map((r) => [r.name, r.phone])).toEqual([
      ['Fixture Dealer One', '9000000071'],
      ['Fixture Dealer Two', '9000000072'],
    ]);

    await setDealerActive(Number(rows[0]!.id), false, ACTOR);
    const again = planDealerImport(SHEET, await listDealerKeys());
    expect(again.toAdd).toHaveLength(0);
    expect(again.outcomes.map((o) => o.kind)).toEqual(['already-on-file', 'already-on-file']);
  });
});
