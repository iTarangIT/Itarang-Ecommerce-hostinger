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

/**
 * The one-time sign-in code.
 *
 * Unlike the three messages above this carries no link, and that is deliberate
 * rather than an omission. A code the recipient types back into the tab they
 * already have open cannot be turned into a phishing click, and there is no
 * URL for a mail client to prefetch or a scanner to burn. It also means this
 * message is safe to forward-quote in a support conversation once it has
 * expired, which the link mails are not.
 *
 * The digits are spaced in the HTML for readability and left unspaced in the
 * text part, so a copy-paste from either lands correctly in the field.
 */
export function loginCodeMessage(to: string, code: string): Mail {
  const safe = escapeHtml(code);
  return {
    to,
    subject: `${code} is your iTarang sign-in code`,
    text: [
      `Your iTarang sign-in code is ${code}.`,
      '',
      'It expires in 10 minutes and can be used once.',
      '',
      'If you did not try to sign in, you can ignore this message — ' +
        'somebody typed your address by mistake, and nobody can reach your ' +
        'account without this code.',
    ].join('\n'),
    html: `<!-- iTarang -->
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
  <h1 style="font-size:20px;margin:0 0 16px">Your sign-in code</h1>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px">Enter this code to sign in to iTarang. It expires in 10&nbsp;minutes and can be used once.</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:0 0 24px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${safe}</p>
  <p style="font-size:13px;color:#666;line-height:1.6;margin:0">
    If you did not try to sign in, you can ignore this message. Nobody can reach your account without this code.
  </p>
</div>`,
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

/* --------------------------------------------------- stock notifications */

/**
 * "It is back" — sent to a customer who asked to be told.
 *
 * Deliberately not a marketing email. It states the one fact the person asked
 * for, links to the product, and says why they are receiving it — which is the
 * difference between a notification somebody requested and mail they did not.
 *
 * Sent only by an explicit admin action, never automatically, and never twice
 * for the same restock: `stock_notification_sends` has a primary key on
 * (transition, email) and the send path inserts before it mails.
 */
export function backInStockMessage(to: string, productTitle: string, productPath: string): Mail {
  const href = `${env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}${productPath}`;
  return {
    to,
    subject: `${productTitle} is back in stock`,
    text: [
      `${productTitle} is available again.`,
      '',
      href,
      '',
      'You are getting this because you asked to be told when this product came',
      'back into stock. This is the only message we send about it.',
    ].join('\n'),
    html: wrap(
      'It is back in stock',
      `${escapeHtml(productTitle)} is available again.<br><br>You are getting this because you asked to be told when this product came back into stock. This is the only message we send about it.`,
      { label: 'View the product', href },
    ),
  };
}

/**
 * The internal alert, sent to the business when a variant sells out.
 *
 * Goes to `STOCK_ALERT_EMAIL`, once per transition. It carries no customer
 * data — a count of people waiting, never their addresses — because it is
 * routine operational mail and the interested list belongs behind the admin
 * sign-in, where it already is.
 */
export function outOfStockAlertMessage(
  to: string,
  details: {
    productTitle: string;
    sku: string;
    source: 'order' | 'admin';
    waitingCount: number;
  },
): Mail {
  const href = `${env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/admin/products/out-of-stock`;
  const cause =
    details.source === 'order'
      ? 'The last units were bought.'
      : 'The stock count was set to zero in the admin console.';
  const waiting =
    details.waitingCount === 0
      ? 'Nobody has asked to be notified about it.'
      : `${details.waitingCount} customer${details.waitingCount === 1 ? ' has' : 's have'} asked to be notified when it returns.`;

  return {
    to,
    subject: `Out of stock: ${details.productTitle} (${details.sku})`,
    text: [
      `${details.productTitle} — SKU ${details.sku} — is now out of stock.`,
      '',
      cause,
      waiting,
      '',
      href,
      '',
      'This is sent once, when the product goes out of stock. It is not repeated',
      'while it stays out of stock.',
    ].join('\n'),
    html: wrap(
      'A product has gone out of stock',
      `<strong>${escapeHtml(details.productTitle)}</strong><br>SKU ${escapeHtml(details.sku)}<br><br>${escapeHtml(cause)} ${escapeHtml(waiting)}<br><br>This is sent once, when the product goes out of stock — not repeated while it stays out of stock.`,
      { label: 'Open the out-of-stock list', href },
    ),
  };
}
