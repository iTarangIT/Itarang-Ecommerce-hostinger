import { env } from '@/lib/env';
import { deliverMail, mailerIsLive } from '@/lib/email/mailer';
import { loginCodeMessage } from '@/lib/email/templates';
import type { OtpChannel } from './otp';

/**
 * How a one-time code reaches the person signing in.
 *
 * An interface with one real implementation, which is more ceremony than a
 * single channel needs — except that the second channel is the whole point.
 * Mobile sign-in requires an SMS provider and, in India, DLT entity and
 * template registration: a commercial and regulatory dependency with its own
 * lead time. Naming the boundary now means adding SMS later is writing one
 * class, not unpicking email assumptions from the sign-in flow.
 *
 * What deliberately does not exist here is a fake SMS transport. A stub that
 * logged the code, displayed it, or quietly succeeded would turn "mobile
 * sign-in is not built" into "mobile sign-in is broken in a way that looks
 * like it works", and a code in a log file is a credential in a log file.
 * `SmsOtpTransport` sends through Exotel when every `EXOTEL_*` variable is set
 * (R-21), and otherwise refuses, and says so.
 */
export interface OtpTransport {
  readonly channel: OtpChannel;
  /**
   * Deliver the code, or throw.
   *
   * Throwing is the contract, and it is the opposite of what `sendMail` does.
   * `sendMail` swallows transport failures on purpose — a registration must
   * not be rolled back because a welcome mail bounced. Here the mail *is* the
   * feature: a code nobody receives is not a sign-in, it is a dead end that
   * looks like progress. So this path reports failure and the caller tells the
   * truth about it.
   */
  send(to: string, code: string): Promise<void>;
}

export class OtpDeliveryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'OtpDeliveryError';
  }
}

export class EmailOtpTransport implements OtpTransport {
  readonly channel = 'email' as const;

  async send(to: string, code: string): Promise<void> {
    if (!mailerIsLive()) {
      throw new OtpDeliveryError(
        'SMTP is not configured, so no sign-in code can be delivered. ' +
          'Refusing to report success for mail that was never sent.',
      );
    }

    // `deliverMail`, not `sendMail`: the latter logs and resolves on failure,
    // which here would show "we sent a code" for a login the SMTP server
    // refused. The reason goes to the server log only — never to the visitor.
    try {
      await deliverMail(loginCodeMessage(to, code));
    } catch (error) {
      console.error(`[otp] email delivery failed: ${(error as Error).message}`);
      throw new OtpDeliveryError('The SMTP server did not accept the sign-in code.', {
        cause: error,
      });
    }
  }
}

export interface ExotelConfig {
  sid: string;
  apiKey: string;
  apiToken: string;
  subdomain: string;
  senderId: string;
  dltEntityId: string;
  dltTemplateId: string;
  /** The DLT-approved text, with `{code}` where the code goes. */
  template: string;
}

/** Exotel settings from the environment, or null while any is missing. */
export function exotelConfig(): ExotelConfig | null {
  const e = env();
  if (
    !e.EXOTEL_SID ||
    !e.EXOTEL_API_KEY ||
    !e.EXOTEL_API_TOKEN ||
    !e.EXOTEL_SMS_SENDER_ID ||
    !e.EXOTEL_DLT_ENTITY_ID ||
    !e.EXOTEL_DLT_OTP_TEMPLATE_ID ||
    !e.EXOTEL_OTP_TEMPLATE
  ) {
    return null;
  }
  return {
    sid: e.EXOTEL_SID,
    apiKey: e.EXOTEL_API_KEY,
    apiToken: e.EXOTEL_API_TOKEN,
    subdomain: e.EXOTEL_SUBDOMAIN,
    senderId: e.EXOTEL_SMS_SENDER_ID,
    dltEntityId: e.EXOTEL_DLT_ENTITY_ID,
    dltTemplateId: e.EXOTEL_DLT_OTP_TEMPLATE_ID,
    template: e.EXOTEL_OTP_TEMPLATE,
  };
}

/** `+91` and ten digits for an Indian mobile number, or null. */
export function indianMobile(value: string): string | null {
  const digits = value.replace(/\D/g, '').replace(/^(?:91|0)(?=[6-9]\d{9}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

/**
 * Sign-in codes by SMS through Exotel (R-21).
 *
 * Indian SMS must carry a registered DLT entity, sender id and template, and
 * the text must match the template exactly, so all three come from the
 * environment and the body is the template with `{code}` filled in. Without
 * that configuration it refuses rather than pretending — the same rule as
 * before an SMS provider existed. The code itself never reaches a log: on
 * failure only Exotel's HTTP status is recorded.
 */
export class SmsOtpTransport implements OtpTransport {
  readonly channel = 'sms' as const;

  constructor(
    private readonly config: ExotelConfig | null = exotelConfig(),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(to: string, code: string): Promise<void> {
    if (!this.config) {
      throw new OtpDeliveryError(
        'Mobile sign-in is not available yet. No SMS provider is configured.',
      );
    }
    const mobile = indianMobile(to);
    if (!mobile) throw new OtpDeliveryError('That is not an Indian mobile number.');
    if (!/^\d{4,8}$/.test(code)) throw new OtpDeliveryError('Refusing to send a malformed code.');

    const { sid, apiKey, apiToken, subdomain } = this.config;
    const url = `https://${subdomain}/v1/Accounts/${encodeURIComponent(sid)}/Sms/send.json`;
    const body = new URLSearchParams({
      From: this.config.senderId,
      To: mobile,
      Body: this.config.template.replace('{code}', code),
      DltEntityId: this.config.dltEntityId,
      DltTemplateId: this.config.dltTemplateId,
      SmsType: 'transactional',
      Priority: 'high',
    });

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:${apiToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      console.error('[otp] Exotel SMS request failed before a response');
      throw new OtpDeliveryError('The SMS provider could not be reached.', { cause: error });
    }

    if (!response.ok) {
      console.error(`[otp] Exotel SMS refused with HTTP ${response.status}`);
      throw new OtpDeliveryError('The SMS provider did not accept the sign-in code.');
    }
  }
}

export function transportFor(channel: OtpChannel): OtpTransport {
  return channel === 'email' ? new EmailOtpTransport() : new SmsOtpTransport();
}
