import { describe, expect, it } from 'vitest';
import { refundCustomerMessage, refundTeamMessage } from './templates';

const refund = {
  orderNumber: 'ITG-2610-VYA239',
  amount: 10_000,
  refundedSoFar: 10_000,
  orderTotal: 4_131_000,
  reference: 'rfnd_Tu6cSkIPiJqIma',
  // Friday 6 Nov and Tuesday 10 Nov 2026, midday in India.
  creditFrom: '2026-11-06T06:30:00.000Z',
  creditBy: '2026-11-10T06:30:00.000Z',
};

describe('refundCustomerMessage', () => {
  it('tells the customer when a processed refund will arrive, with the reference', () => {
    const mail = refundCustomerMessage('asha@example.com', {
      ...refund,
      state: 'processed',
      name: 'Asha Verma',
      path: '/order/ITG-2610-VYA239',
    });
    expect(mail.to).toBe('asha@example.com');
    expect(mail.subject).toBe('Refund of ₹100 processed — order ITG-2610-VYA239');
    expect(mail.text).toContain('within 5–7 working days — between Fri, 6 Nov 2026 and Tue, 10 Nov 2026.');
    expect(mail.text).toContain('Refund reference: rfnd_Tu6cSkIPiJqIma.');
    expect(mail.text).toContain('₹100 of the ₹41,310 you paid has now been refunded.');
  });

  it('adds the processing days to a refund still pending, and says when it is complete', () => {
    const mail = refundCustomerMessage('asha@example.com', {
      ...refund,
      refundedSoFar: 4_131_000,
      state: 'pending',
      name: 'Asha Verma',
      path: '/order/ITG-2610-VYA239',
    });
    expect(mail.subject).toContain('started');
    expect(mail.text).toContain('It takes 3–5 working days to process');
    expect(mail.text).toContain('That completes the refund of the full ₹41,310 you paid.');
  });
});

describe('refundTeamMessage', () => {
  it('names the customer, who refunded and why', () => {
    const mail = refundTeamMessage('care.itarang@gmail.com', {
      ...refund,
      state: 'processed',
      customer: 'Asha Verma',
      phone: '9000000000',
      reason: 'Customer asked',
      by: 'admin@itarang.com',
    });
    expect(mail.subject).toBe('Refund processed — ₹100 on ITG-2610-VYA239');
    expect(mail.text).toContain('Reason: Customer asked. By: admin@itarang.com.');
    expect(mail.text).toContain('Refunded so far: ₹100 of ₹41,310.');
    expect(mail.text).toContain('/admin/orders/ITG-2610-VYA239');
  });

  it('asks the team to act on a refund the gateway refused', () => {
    const mail = refundTeamMessage('care.itarang@gmail.com', {
      ...refund,
      state: 'failed',
      customer: 'Asha Verma',
      phone: '9000000000',
      reason: 'Customer asked',
      by: 'admin@itarang.com',
      error: 'insufficient balance',
    });
    expect(mail.subject).toContain('failed');
    expect(mail.text).toContain('did not refund it (insufficient balance)');
  });
});
