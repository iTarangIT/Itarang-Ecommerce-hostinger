import { describe, expect, it } from 'vitest';
import { canInvoice, looksLikePdf, safeInvoiceFileName } from './invoices';

describe('canInvoice', () => {
  it('allows a paid online order', () => {
    expect(canInvoice({ paymentStatus: 'paid', paymentMethod: 'razorpay', status: 'confirmed' })).toBe(true);
  });

  it('refuses an order still waiting for payment', () => {
    expect(
      canInvoice({ paymentStatus: 'pending', paymentMethod: 'razorpay', status: 'pending_payment' }),
    ).toBe(false);
  });

  it('allows a COD order only once delivered', () => {
    expect(canInvoice({ paymentStatus: 'pending', paymentMethod: 'cod', status: 'shipped' })).toBe(false);
    expect(canInvoice({ paymentStatus: 'pending', paymentMethod: 'cod', status: 'delivered' })).toBe(true);
  });

  it('refuses a cancelled order even if it was paid', () => {
    expect(canInvoice({ paymentStatus: 'paid', paymentMethod: 'razorpay', status: 'cancelled' })).toBe(false);
  });
});

describe('looksLikePdf', () => {
  it('accepts the PDF signature', () => {
    expect(looksLikePdf(Buffer.from('%PDF-1.7\n...'))).toBe(true);
  });

  it('refuses anything else, whatever it is called', () => {
    expect(looksLikePdf(Buffer.from('<html>not a pdf</html>'))).toBe(false);
    expect(looksLikePdf(Buffer.from(''))).toBe(false);
  });
});

describe('safeInvoiceFileName', () => {
  it('keeps a plain name and ensures the .pdf extension', () => {
    expect(safeInvoiceFileName('INV-0042.pdf', 'ITG-1')).toBe('INV-0042.pdf');
    expect(safeInvoiceFileName('INV-0042', 'ITG-1')).toBe('INV-0042.pdf');
  });

  it('strips characters that could break the download header', () => {
    expect(safeInvoiceFileName('a"b\r\nc.pdf', 'ITG-1')).toBe('a-b-c.pdf');
  });

  it('falls back to the order number when nothing usable is left', () => {
    expect(safeInvoiceFileName('???.pdf', 'ITG-2610-ABC')).toBe('invoice-ITG-2610-ABC.pdf');
  });
});
