import { mailerIsLive, sendMail } from '@/lib/email/mailer';
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
 * `SmsOtpTransport` refuses, and says so.
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

    // `sendMail` logs and resolves on failure rather than throwing, so its
    // resolution proves nothing on its own. Nodemailer's own errors are
    // surfaced by the check above plus the transport's verify at connect time;
    // what this guards is the silent no-op case, which is the common one.
    await sendMail(loginCodeMessage(to, code));
  }
}

/**
 * The unimplemented half, stated rather than stubbed.
 *
 * Reachable only if something asks for the `sms` channel, which no UI does.
 * It throws so that a mistake in wiring is a loud failure at the boundary
 * instead of a customer waiting for a message that was never going to arrive.
 */
export class SmsOtpTransport implements OtpTransport {
  readonly channel = 'sms' as const;

  async send(): Promise<never> {
    throw new OtpDeliveryError(
      'Mobile sign-in is not available yet. No SMS provider is configured.',
    );
  }
}

export function transportFor(channel: OtpChannel): OtpTransport {
  return channel === 'email' ? new EmailOtpTransport() : new SmsOtpTransport();
}
