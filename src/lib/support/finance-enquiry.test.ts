import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/commerce/types';
import { resetEnvCache } from '@/lib/env';
import { forwardFinanceLead, type FinanceLead } from './crm-lead';
import { describeFinanceItems, financeLeadFrom, subjectDetails } from './finance-enquiry';
import { SUPPORT_FORMS, validateForm } from './request-forms';

const SITE = 'https://shop.itarang.com/';

function product(key: string, title: string, sku: string, selling: number): Product {
  return {
    id: key,
    slug: key,
    title,
    options: [],
    variants: [{ id: `${key}:default`, sku, title: '', price: { mrp: selling, selling } }],
  } as unknown as Product;
}

const CATALOGUE = [
  product('powercube-1-4', 'Powercube 1.4', 'TK12100', 2_500_000),
  product('tk-lifr-5145', 'TK-LiFe-5145', 'TK-LIFE-5145', 3_000_000),
];

describe('describeFinanceItems', () => {
  it('describes one product page line exactly, from the catalogue', () => {
    expect(describeFinanceItems([{ variantId: 'powercube-1-4:default', quantity: 1 }], CATALOGUE, SITE)).toEqual({
      productSku: 'TK12100',
      productTitle: 'Powercube 1.4',
      productUrl: 'https://shop.itarang.com/products/powercube-1-4',
      pricePaise: 2_500_000,
    });
  });

  it('finds a line by SKU, ignoring capitals, and prices the quantity', () => {
    const subject = describeFinanceItems([{ sku: 'tk12100', quantity: 2 }], CATALOGUE, SITE);
    expect(subject.productTitle).toBe('Powercube 1.4 × 2');
    expect(subject.pricePaise).toBe(5_000_000);
  });

  it('describes a cart as one title, its total, and no single SKU or page', () => {
    expect(
      describeFinanceItems(
        [
          { variantId: 'powercube-1-4:default', quantity: 1 },
          { variantId: 'tk-lifr-5145:default', quantity: 2 },
        ],
        CATALOGUE,
        SITE,
      ),
    ).toEqual({
      productSku: null,
      productTitle: 'Powercube 1.4 × 1, TK-LiFe-5145 × 2',
      productUrl: null,
      pricePaise: 8_500_000,
    });
  });

  it('drops what the catalogue does not hold rather than trusting the browser', () => {
    expect(describeFinanceItems([{ sku: 'NOT-A-SKU' }], CATALOGUE, SITE)).toEqual({
      productSku: null,
      productTitle: null,
      productUrl: null,
      pricePaise: null,
    });
  });
});

describe('the stored enquiry and the CRM lead', () => {
  it('round-trips through details into the agreed contract shape', () => {
    const subject = describeFinanceItems([{ sku: 'TK12100' }], CATALOGUE, SITE);
    const details = subjectDetails(subject, 'product');
    expect(details).toEqual({
      page: 'product',
      productSku: 'TK12100',
      productTitle: 'Powercube 1.4',
      productUrl: 'https://shop.itarang.com/products/powercube-1-4',
      pricePaise: '2500000',
    });

    const lead = financeLeadFrom({
      reference: 'FIN-261030-ABCD',
      name: 'Asha',
      phone: '9876543210',
      pincode: '411001',
      details: { ...details, consent: 'yes' },
    });
    expect(lead).toEqual({
      storeRef: 'FIN-261030-ABCD',
      name: 'Asha',
      mobile: '9876543210',
      pincode: '411001',
      productSku: 'TK12100',
      productTitle: 'Powercube 1.4',
      productUrl: 'https://shop.itarang.com/products/powercube-1-4',
      pricePaise: 2_500_000,
      page: 'product',
    });
  });

  it('sends nulls, not empty strings, when there is no product', () => {
    const lead = financeLeadFrom({
      reference: 'FIN-261030-ABCD',
      name: 'Asha',
      phone: '9876543210',
      pincode: '411001',
      details: subjectDetails(describeFinanceItems([], [], SITE), 'checkout'),
    });
    expect(lead).toMatchObject({ productSku: null, productTitle: null, productUrl: null, pricePaise: null, page: 'checkout' });
  });

  it('validates name, mobile, pincode and consent with the shared rules', () => {
    const errors = validateForm(SUPPORT_FORMS.finance, { name: 'Asha', phone: '+919876543210', pincode: '0110' });
    expect(Object.keys(errors).sort()).toEqual(['consent', 'phone', 'pincode']);
  });
});

describe('forwardFinanceLead', () => {
  const saved = { ...process.env };
  const lead: FinanceLead = {
    storeRef: 'FIN-261030-ABCD',
    name: 'Asha',
    mobile: '9876543210',
    pincode: '411001',
    productSku: 'TK12100',
    productTitle: 'Powercube 1.4',
    productUrl: 'https://shop.itarang.com/products/powercube-1-4',
    pricePaise: 2_500_000,
    page: 'product',
  };

  function configure(on: boolean) {
    process.env.CRM_BASE_URL = on ? 'https://crm.example.com/' : '';
    process.env.CRM_STORE_API_KEY = on ? 'store-key-0123456789' : '';
    resetEnvCache();
  }

  afterEach(() => {
    process.env = { ...saved };
    resetEnvCache();
    vi.unstubAllGlobals();
  });

  it('sends nothing when the CRM is not configured', async () => {
    configure(false);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await forwardFinanceLead(lead)).toEqual({ ok: false, skipped: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts the lead to the agreed endpoint with the store key', async () => {
    configure(true);
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true, leadId: 'L-1', duplicate: true }), { status: 201 }));
    vi.stubGlobal('fetch', fetchSpy);

    expect(await forwardFinanceLead(lead)).toEqual({ ok: true, leadId: 'L-1', duplicate: true });
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('https://crm.example.com/api/integrations/online-store/finance-lead');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'x-store-key': 'store-key-0123456789' });
    expect(JSON.parse(init.body)).toEqual(lead);
  });

  it('reports a refusal, a malformed answer and an outage as errors', async () => {
    configure(true);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'bad key' }), { status: 401 })),
    );
    expect(await forwardFinanceLead(lead)).toEqual({ ok: false, error: 'CRM answered 401: bad key' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    expect(await forwardFinanceLead(lead)).toEqual({ ok: false, error: 'CRM answered 200 without a lead id' });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new Error('t'), { name: 'TimeoutError' })));
    expect(await forwardFinanceLead(lead)).toEqual({ ok: false, error: 'CRM did not answer within 6 s' });
  });
});
