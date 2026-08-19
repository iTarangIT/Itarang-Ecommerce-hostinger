import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '@/lib/env';

/**
 * Transactional email over SMTP.
 *
 * Two things this module is careful about:
 *
 * 1. **It never sends by accident.** Mail goes out only when SMTP is fully
 *    configured *and* we are not running tests. A developer without SMTP
 *    settings, or a test run, gets the message on the console instead. The
 *    failure mode of a misconfigured mailer should be "nothing was sent", not
 *    "a verification link went to a real customer from a laptop".
 *
 * 2. **It never logs the credential.** The transport is built from env inside
 *    this module and the password is not included in any log line, including
 *    the console fallback.
 *
 * Delivery is best-effort from the caller's point of view: `sendMail` resolves
 * even when SMTP fails, because a registration must not be rolled back just
 * because the confirmation email bounced. The caller decides what to tell the
 * user; the error is logged here.
 */

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

let transport: Transporter | null = null;

function smtpConfig() {
  const config = env();
  if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASSWORD) return null;

  return {
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    // 465 is implicit TLS; 587 and 25 start plaintext and upgrade via STARTTLS.
    secure: config.SMTP_PORT === 465,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD },
  };
}

/** True when a real message would leave this process. */
export function mailerIsLive(): boolean {
  return smtpConfig() !== null && process.env.NODE_ENV !== 'test';
}

function getTransport(): Transporter | null {
  if (transport) return transport;
  const config = smtpConfig();
  if (!config) return null;
  transport = nodemailer.createTransport(config);
  return transport;
}

export async function sendMail(mail: Mail): Promise<void> {
  const config = env();

  if (!mailerIsLive()) {
    // Subject and recipient only — the body of a verification mail contains a
    // live single-use token, which has no business in a log file.
    console.info(`[email] (not sent — no SMTP configured) to=${mail.to} subject=${mail.subject}`);
    return;
  }

  try {
    await getTransport()!.sendMail({
      from: config.EMAIL_FROM,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
  } catch (error) {
    // Never rethrow: the account was created, the reset was requested. Losing
    // the mail is recoverable by the user; losing the action is not.
    console.error(`[email] delivery failed to=${mail.to}: ${(error as Error).message}`);
  }
}

/** Test seam — drops the memoised transport so env changes take effect. */
export function resetMailer(): void {
  transport = null;
}
