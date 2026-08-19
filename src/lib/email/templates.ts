import { env } from '@/lib/env';
import type { Mail } from './mailer';

/**
 * The two transactional messages this phase sends.
 *
 * Plain text is written first and the HTML mirrors it, because a mail client
 * that shows the text part is a normal thing and not a degraded experience.
 * Both carry a single-use link and say plainly what to do if the recipient did
 * not ask for it.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function link(path: string, token: string): string {
  const base = env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  return `${base}${path}?token=${encodeURIComponent(token)}`;
}

function wrap(heading: string, body: string, action: { label: string; href: string }): string {
  return `<!-- iTarang -->
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
  <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(heading)}</h1>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px">${body}</p>
  <p style="margin:0 0 24px">
    <a href="${action.href}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px">${escapeHtml(action.label)}</a>
  </p>
  <p style="font-size:13px;color:#666;line-height:1.6;margin:0">
    If the button does not work, copy this address into your browser:<br>
    <span style="word-break:break-all">${escapeHtml(action.href)}</span>
  </p>
</div>`;
}

export function verifyEmailMessage(to: string, token: string): Mail {
  const href = link('/verify-email', token);
  return {
    to,
    subject: 'Confirm your iTarang email address',
    text: [
      'Welcome to iTarang.',
      '',
      'Confirm your email address by opening this link:',
      href,
      '',
      'The link works once and expires in 24 hours.',
      'If you did not create an iTarang account, you can ignore this message.',
    ].join('\n'),
    html: wrap(
      'Confirm your email address',
      'Welcome to iTarang. Confirm your email address to finish setting up your account. This link works once and expires in 24&nbsp;hours.<br><br>If you did not create an account, you can ignore this message.',
      { label: 'Confirm email address', href },
    ),
  };
}

/**
 * Sent when someone tries to register with an address that already has an
 * account.
 *
 * The registration form cannot say "that address is taken" without confirming
 * to a stranger that the account exists, so it says nothing and this message
 * carries the information to the one person entitled to it — the owner of the
 * mailbox.
 */
export function accountExistsMessage(to: string, token: string): Mail {
  const href = link('/reset-password', token);
  return {
    to,
    subject: 'You already have an iTarang account',
    text: [
      'Someone tried to create an iTarang account with this email address, but',
      'you already have one.',
      '',
      'If that was you and you have forgotten your password, choose a new one here:',
      href,
      '',
      'The link works once and expires in 1 hour.',
      'If it was not you, no action is needed — nothing about your account has changed.',
    ].join('\n'),
    html: wrap(
      'You already have an account',
      'Someone tried to create an iTarang account with this email address, but you already have one.<br><br>If that was you and you have forgotten your password, use the link below. It works once and expires in 1&nbsp;hour.<br><br>If it was not you, no action is needed — nothing about your account has changed.',
      { label: 'Choose a new password', href },
    ),
  };
}

export function resetPasswordMessage(to: string, token: string): Mail {
  const href = link('/reset-password', token);
  return {
    to,
    subject: 'Reset your iTarang password',
    text: [
      'Someone asked to reset the password on your iTarang account.',
      '',
      'Choose a new password here:',
      href,
      '',
      'The link works once and expires in 1 hour.',
      'If this was not you, no action is needed — your password has not changed.',
    ].join('\n'),
    html: wrap(
      'Reset your password',
      'Someone asked to reset the password on your iTarang account. This link works once and expires in 1&nbsp;hour.<br><br>If this was not you, no action is needed — your password has not changed.',
      { label: 'Choose a new password', href },
    ),
  };
}
