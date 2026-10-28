import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  EmailOtpTransport,
  OtpDeliveryError,
  SmsOtpTransport,
  indianMobile,
  transportFor,
  type ExotelConfig,
  type OtpTransport,
} from './otp-transport';

/**
 * SMS sign-in stays switched off until Exotel is configured, and stays
 * *visibly* switched off.
 *
 * The transport sends through Exotel once every `EXOTEL_*` variable is set
 * (R-21). Until then — and in this test run, which sets none — it must refuse:
 * DLT entity and template registration is a regulatory step with its own lead
 * time, and nothing may stand in for it.
 *
 * The dangerous version of "not built yet" is a stub — a transport that logs
 * the code, or displays it, or quietly resolves. Any of those turns "mobile
 * sign-in is not available" into "mobile sign-in is broken in a way that looks
 * like it works", and a one-time code in a log file is a credential in a log
 * file. `SmsOtpTransport` therefore refuses.
 *
 * These tests exist so that refusal cannot be softened by accident. They are
 * cheap and they guard a security property, not a behaviour anyone is likely
 * to want to change deliberately without noticing this file.
 */

const ROOT = resolve(__dirname, '../../..');
const TRANSPORT_SOURCE = readFileSync(join(ROOT, 'src/lib/auth/otp-transport.ts'), 'utf8');

describe('the SMS transport refuses rather than pretending, until configured', () => {
  it('throws when asked to deliver a code', async () => {
    await expect(new SmsOtpTransport(null).send('9876543210', '123456')).rejects.toBeInstanceOf(
      OtpDeliveryError,
    );
  });

  it('says why, so the failure is diagnosable', async () => {
    await expect(new SmsOtpTransport(null).send('9876543210', '123456')).rejects.toThrow(
      /no sms provider is configured/i,
    );
  });

  it('is what the factory returns for the sms channel', async () => {
    const transport = transportFor('sms');
    expect(transport.channel).toBe('sms');
    await expect(transport.send('9876543210', '123456')).rejects.toBeInstanceOf(OtpDeliveryError);
  });

  it('never resolves — not for any identifier', async () => {
    // Guards against a future "allow-list one number for testing" shortcut,
    // which is how a disabled channel becomes a half-enabled one.
    //
    // Called through the interface rather than the class: `SmsOtpTransport`
    // declares `send()` with no parameters precisely because it ignores them,
    // and the point here is that the *contract* callers use always rejects.
    const transport: OtpTransport = new SmsOtpTransport(null);
    for (const identifier of ['9876543210', '+919876543210', '', 'test@example.com']) {
      await expect(transport.send(identifier, '000000')).rejects.toThrow();
    }
  });
});

describe('the email transport is unchanged', () => {
  it('is what the factory returns for the email channel', () => {
    expect(transportFor('email')).toBeInstanceOf(EmailOtpTransport);
    expect(transportFor('email').channel).toBe('email');
  });
});

describe('no code path asks for the sms channel', () => {
  it('is requested nowhere in the sign-in flow', () => {
    // `otp-actions.ts` is the only caller of `transportFor`. If a second
    // channel is ever wired up, this fails and whoever did it has to come and
    // read the paragraph at the top of this file first.
    const actions = readFileSync(join(ROOT, 'src/lib/auth/otp-actions.ts'), 'utf8');
    expect(actions).toContain("transportFor('email')");
    expect(actions).not.toContain("transportFor('sms')");
  });

  it('contains no stub that could deliver a code by another route', () => {
    // The transport must not acquire a body that logs, prints or returns the
    // code. Errors log Exotel's HTTP status only.
    const smsClass = TRANSPORT_SOURCE.slice(TRANSPORT_SOURCE.indexOf('class SmsOtpTransport'));
    expect(smsClass).not.toMatch(/console\.(log|info|warn|debug)/);
    expect(smsClass).not.toMatch(/console\.error\([^)]*code/);
    expect(smsClass).toContain('throw new OtpDeliveryError');
  });
});

const EXOTEL: ExotelConfig = {
  sid: 'itarang1',
  apiKey: 'key',
  apiToken: 'token',
  subdomain: 'api.exotel.com',
  senderId: 'ITARNG',
  dltEntityId: '1101000000000000001',
  dltTemplateId: '1107000000000000001',
  template: '{code} is your iTarang sign-in code. Valid for 10 minutes. - iTarang',
};

describe('the Exotel SMS transport', () => {
  it('posts the DLT template with the code to the Exotel SMS API', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));
    await new SmsOtpTransport(EXOTEL, fetchImpl as unknown as typeof fetch).send('98765 43210', '482913');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.exotel.com/v1/Accounts/itarang1/Sms/send.json');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from('key:token').toString('base64')}`,
    );
    const body = init.body as URLSearchParams;
    expect(body.get('To')).toBe('+919876543210');
    expect(body.get('From')).toBe('ITARNG');
    expect(body.get('Body')).toBe('482913 is your iTarang sign-in code. Valid for 10 minutes. - iTarang');
    expect(body.get('DltEntityId')).toBe(EXOTEL.dltEntityId);
    expect(body.get('DltTemplateId')).toBe(EXOTEL.dltTemplateId);
  });

  it('throws when Exotel refuses, so the caller does not claim it was sent', async () => {
    const fetchImpl = vi.fn(async () => new Response('bad', { status: 401 }));
    await expect(
      new SmsOtpTransport(EXOTEL, fetchImpl as unknown as typeof fetch).send('9876543210', '482913'),
    ).rejects.toBeInstanceOf(OtpDeliveryError);
  });

  it('throws when Exotel cannot be reached', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('network down');
    });
    await expect(
      new SmsOtpTransport(EXOTEL, fetchImpl as unknown as typeof fetch).send('9876543210', '482913'),
    ).rejects.toBeInstanceOf(OtpDeliveryError);
  });

  it('refuses a number that is not an Indian mobile, without calling Exotel', async () => {
    const fetchImpl = vi.fn();
    await expect(
      new SmsOtpTransport(EXOTEL, fetchImpl as unknown as typeof fetch).send('12345', '482913'),
    ).rejects.toBeInstanceOf(OtpDeliveryError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('indianMobile', () => {
  it('normalises the usual ways a number is typed', () => {
    for (const typed of ['9876543210', '+91 98765 43210', '09876543210', '919876543210']) {
      expect(indianMobile(typed)).toBe('+919876543210');
    }
  });

  it('refuses landlines and short numbers', () => {
    expect(indianMobile('1234567890')).toBeNull();
    expect(indianMobile('98765')).toBeNull();
  });
});
