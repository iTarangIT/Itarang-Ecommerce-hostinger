import { describe, expect, it } from 'vitest';
import { SUPPORT_FORMS, pickFormValues, validateForm } from './request-forms';

describe('callback form (first-visit expert popup)', () => {
  const fields = SUPPORT_FORMS.callback;
  const valid = { name: 'Asha Patil', phone: '9876543210', pincode: '411001', consent: 'yes' };

  it('accepts a name, mobile number, pincode and the consent tick', () => {
    expect(validateForm(fields, valid)).toEqual({});
  });

  it('refuses a submission without the consent tick', () => {
    expect(validateForm(fields, { ...valid, consent: '' })).toHaveProperty('consent');
    expect(validateForm(fields, { ...valid, consent: 'no' })).toHaveProperty('consent');
  });

  it('refuses a bad mobile number or pincode', () => {
    expect(validateForm(fields, { ...valid, phone: '12345' })).toHaveProperty('phone');
    expect(validateForm(fields, { ...valid, pincode: '011001' })).toHaveProperty('pincode');
  });

  it('keeps only the fields the form defines', () => {
    expect(pickFormValues(fields, { ...valid, website: 'spam', email: 'x@y.in' })).toEqual(valid);
  });
});
