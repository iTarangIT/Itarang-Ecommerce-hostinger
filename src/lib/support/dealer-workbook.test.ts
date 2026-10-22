import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { planDealerImport } from './dealer-import';
import { buildDealerTemplate, readDealerFile } from './dealer-workbook';

describe('dealer workbook', () => {
  it('the downloaded template uploads as one valid dealer', async () => {
    const bytes = await buildDealerTemplate();
    const rows = await readDealerFile(new Uint8Array(bytes).buffer, 'itarang-dealers-template.xlsx');
    const plan = planDealerImport(rows, []);
    expect(plan.toAdd).toEqual([
      expect.objectContaining({ name: 'Sharma Battery House', state: 'Haryana', pincode: '122001', phone: '9876543210' }),
    ]);
  });

  it('reads numbers typed into Excel cells exactly', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Dealers');
    sheet.addRow(['Name', 'Address', 'City', 'State', 'Pincode', 'Phone', 'Latitude', 'Longitude']);
    sheet.addRow(['Patil', 'Lane 2', 'Pune', 'Maharashtra', 411001, 9876543210, 18.520431, 73.856743]);
    const bytes = await workbook.xlsx.writeBuffer();
    const plan = planDealerImport(await readDealerFile(bytes as ArrayBuffer, 'dealers.xlsx'), []);
    expect(plan.toAdd[0]).toMatchObject({ pincode: '411001', phone: '9876543210', latitude: 18.520431, longitude: 73.856743 });
  });

  it('reads a CSV upload', async () => {
    const csv = 'Name,Address,City,State,Pincode\nSharma,"Shop 4, MG Road",Gurugram,Haryana,122001\n';
    const rows = await readDealerFile(new TextEncoder().encode(csv).buffer, 'dealers.CSV');
    expect(planDealerImport(rows, []).toAdd).toHaveLength(1);
  });
});
