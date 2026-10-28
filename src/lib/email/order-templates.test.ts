import { describe, expect, it } from 'vitest';
import { orderConfirmationMessage, orderPaidAlertMessage } from './templates';

const lines = [
  { title: 'Powercube 1.4 <kWh>', quantity: 2, lineTotal: 5_999_800 },
  { title: 'Charger TK500W', quantity: 1, lineTotal: 450_000 },
];

describe('orderConfirmationMessage', () => {
  const mail = orderConfirmationMessage('asha@example.com', {
    name: 'Asha Verma',
    orderNumber: 'IT-1001',
    lines,
    total: 6_449_800,
    path: '/order/IT-1001',
  });

  it('names the order and links to its page', () => {
    expect(mail.to).toBe('asha@example.com');
    expect(mail.subject).toContain('IT-1001');
    expect(mail.text).toContain('Hi Asha,');
    expect(mail.text).toMatch(/\/order\/IT-1001$/);
    expect(mail.html).toContain('/order/IT-1001');
  });

  it('lists every line and the total, escaped in HTML', () => {
    expect(mail.text).toContain('Powercube 1.4 <kWh> × 2');
    expect(mail.text).toContain('Charger TK500W × 1');
    expect(mail.html).toContain('Powercube 1.4 &lt;kWh&gt; × 2');
    expect(mail.html).not.toContain('<kWh>');
    expect(mail.html).toContain('Total paid');
  });
});

describe('orderPaidAlertMessage', () => {
  const base = {
    orderNumber: 'IT-1001',
    customer: 'Asha Verma',
    phone: '9810000000',
    city: 'Gurugram',
    pincode: '122001',
    paymentMethod: 'Razorpay',
    lines,
    total: 6_449_800,
  };

  it('carries what the team needs and links to the admin order', () => {
    const mail = orderPaidAlertMessage('care@itarang.com', { ...base, isTest: false });
    expect(mail.subject).toMatch(/^New paid order IT-1001/);
    expect(mail.text).toContain('Mobile: 9810000000');
    expect(mail.text).toContain('Deliver to: Gurugram 122001');
    expect(mail.text).toContain('Email: —');
    expect(mail.html).toContain('/admin/orders/IT-1001');
  });

  it('marks test orders so nobody dispatches them', () => {
    const mail = orderPaidAlertMessage('care@itarang.com', { ...base, isTest: true });
    expect(mail.subject).toMatch(/^\[TEST\] /);
  });
});
