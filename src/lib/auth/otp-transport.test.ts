import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EmailOtpTransport,
  OtpDeliveryError,
  SmsOtpTransport,
  transportFor,
  type OtpTransport,
} from './otp-transport';

/**
 * SMS sign-in stays switched off, and stays *visibly* switched off.
 *
 * The business wants mandatory phone verification for registered customers. It
 * cannot be built yet: an SMS provider plus Indian DLT entity and template
 * registration are commercial and regulatory dependencies that do not exist.
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

describe('the SMS transport refuses rather than pretending', () => {
  it('throws when asked to deliver a code', async () => {
    await expect(new SmsOtpTransport().send()).rejects.toBeInstanceOf(OtpDeliveryError);
  });

  it('says why, so the failure is diagnosable', async () => {
    await expect(new SmsOtpTransport().send()).rejects.toThrow(/no sms provider is configured/i);
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
    const transport: OtpTransport = new SmsOtpTransport();
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
    // The refusing implementation must not acquire a body that logs, prints or
    // returns the code.
    const smsClass = TRANSPORT_SOURCE.slice(TRANSPORT_SOURCE.indexOf('class SmsOtpTransport'));
    expect(smsClass).not.toMatch(/console\.(log|info|warn|debug)/);
    expect(smsClass).toContain('throw new OtpDeliveryError');
  });
});
