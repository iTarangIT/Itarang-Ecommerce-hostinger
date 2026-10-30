import type { Paise } from '@/lib/commerce/types';
import { formatPrice } from '@/lib/catalog/pricing';
import { env } from '@/lib/env';
import { SITE } from '@/lib/site';
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

/**
 * The iTarang wordmark at the top of every message.
 *
 * Linked from the live site rather than attached: an inline attachment shows
 * up as a paperclip in several clients and adds 65 KB to every sign-in code.
 * The alt text is styled so a client that blocks remote images still shows
 * the name in place of the mark.
 */
function logoHeader(): string {
  const base = env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  return `<p style="margin:0 0 24px">
    <a href="${base}/" style="text-decoration:none"><img src="${base}/images/logo-wordmark-dark.png" alt="iTarang" width="140" height="35" style="display:block;border:0;height:35px;width:140px;font-size:20px;font-weight:700;color:#111"></a>
  </p>`;
}

/**
 * `block` is raw block-level HTML placed between the heading and the sentence.
 *
 * It exists because `body` is rendered inside a `<p>`, and a `<table>` — which
 * is how a card has to be built for mail clients — is not valid inside one. Put
 * anything block-level here, prose in `body`.
 */
function wrap(
  heading: string,
  body: string,
  action: { label: string; href: string },
  block?: string,
): string {
  return `<!-- iTarang -->
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
  ${logoHeader()}
  <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(heading)}</h1>
  ${block ?? ''}
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
  ${logoHeader()}
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
export interface BackInStockProduct {
  title: string;
  /** Path within the site, e.g. `/products/powercube-1-4`. */
  path: string;
  /** Selling price in paise, or null where the variant carries none. */
  price: Paise | null;
  /** Struck through above the price when it is genuinely higher. */
  mrp: Paise | null;
  /** One sentence. The catalogue's first description paragraph. */
  description: string;
  /** Absolute URL of the primary photograph, or null when there is none. */
  imageUrl: string | null;
  imageAlt: string;
}

/**
 * The product card that rides inside the notification.
 *
 * Built as a table rather than flexbox because that is what mail clients
 * render: Outlook's word-processing engine has no meaningful flex support, and
 * a card that collapses into a stack of unstyled text is worse than no card.
 * Every colour and size is inline for the same reason — a `<style>` block is
 * stripped by several clients.
 *
 * The image is a remote URL, not an attachment. Many clients block remote
 * images until the reader allows them, so nothing the message needs to say is
 * carried only by the picture: the name, the price and the description are all
 * text beside it, and `alt` covers the gap.
 */
function productCard(product: BackInStockProduct): string {
  const price =
    product.price === null
      ? ''
      : `<p style="margin:0 0 6px;font-size:18px;font-weight:700;color:#111">${escapeHtml(
          formatPrice(product.price),
        )}${
          product.mrp !== null && product.mrp > product.price
            ? ` <span style="font-size:14px;font-weight:400;color:#666;text-decoration:line-through">${escapeHtml(
                formatPrice(product.mrp),
              )}</span>`
            : ''
        }</p>`;

  const image = product.imageUrl
    ? `<td width="120" valign="top" style="padding:0 16px 0 0">
         <img src="${escapeHtml(product.imageUrl)}" width="120" alt="${escapeHtml(product.imageAlt)}"
              style="display:block;width:120px;height:auto;border-radius:8px;border:1px solid #e5e7eb">
       </td>`
    : '';

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                 style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:0 0 20px">
  <tr>
    ${image}
    <td valign="top">
      <p style="margin:0 0 6px;font-size:16px;font-weight:600;color:#111">${escapeHtml(product.title)}</p>
      ${price}
      <p style="margin:0;font-size:14px;line-height:1.5;color:#444">${escapeHtml(product.description)}</p>
    </td>
  </tr>
</table>`;
}

/**
 * "It is back" — sent to a customer who asked to be told.
 *
 * Deliberately not a marketing email. It states the one fact the person asked
 * for, shows them the product they were waiting for, links to it, and says why
 * they are receiving it — which is the difference between a notification
 * somebody requested and mail they did not.
 *
 * The product card carries the picture, the name, the price and one line of
 * description because the alternative is a message that says a title and a URL:
 * a customer who signed up weeks ago should not have to click to remember which
 * battery this is. Everything in it comes from the catalogue row read at send
 * time, so the price quoted is the price on the page the button leads to.
 *
 * Sent only by an explicit admin action, never automatically, and never twice
 * for the same restock: `stock_notification_sends` has a primary key on
 * (transition, email) and the send path inserts before it mails.
 */
export function backInStockMessage(to: string, product: BackInStockProduct): Mail {
  const href = `${env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}${product.path}`;

  return {
    to,
    subject: `${product.title} is back in stock`,
    text: [
      `${product.title} is available again.`,
      ...(product.price === null ? [] : ['', formatPrice(product.price)]),
      ...(product.description ? ['', product.description] : []),
      '',
      href,
      '',
      'You are getting this because you asked to be told when this product came',
      'back into stock. This is the only message we send about it.',
    ].join('\n'),
    html: wrap(
      'It is back in stock',
      'You are getting this because you asked to be told when this product came back into stock. This is the only message we send about it.',
      { label: 'View the product', href },
      productCard(product),
    ),
  };
}

/**
 * Confirmation to a customer who filed a complaint, registered a warranty or
 * booked an installation. It repeats the reference, because the reference is
 * the one thing they need on the follow-up call.
 */
export function supportRequestReceivedMessage(
  to: string,
  details: { name: string; reference: string; kindLabel: string },
): Mail {
  const href = `${env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/support`;
  const firstName = details.name.split(/\s+/)[0] || 'there';
  const what = details.kindLabel.toLowerCase();

  return {
    to,
    subject: `${details.kindLabel} received — reference ${details.reference}`,
    text: [
      `Hi ${firstName},`,
      '',
      `We have received your ${what}. Your reference is ${details.reference}.`,
      'Quote it when you call or write to us. Our team will contact you within one working day.',
      '',
      href,
    ].join('\n'),
    html: wrap(
      `We have your ${what}`,
      `Hi ${escapeHtml(firstName)}, your reference is <strong>${escapeHtml(details.reference)}</strong>. Quote it when you call or write to us. Our team will contact you within one working day.`,
      { label: 'Support centre', href },
    ),
  };
}

/** The same request, to the service inbox, with every field the customer gave. */
export function supportRequestAlertMessage(
  to: string,
  details: { reference: string; kindLabel: string; fields: Array<[string, string]> },
): Mail {
  const href = `${env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/admin/support`;
  const lines = details.fields.map(([label, value]) => `${label}: ${value}`);
  const rows = details.fields
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">${escapeHtml(label)}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`,
    )
    .join('');

  return {
    to,
    subject: `New ${details.kindLabel.toLowerCase()}: ${details.reference}`,
    text: [`${details.kindLabel} ${details.reference}`, '', ...lines, '', href].join('\n'),
    html: wrap(
      `New ${details.kindLabel.toLowerCase()} — ${details.reference}`,
      'Open the support queue to update its status.',
      { label: 'Open the support queue', href },
      `<table style="font-size:14px;margin:0 0 16px;border-collapse:collapse">${rows}</table>`,
    ),
  };
}

/**
 * The apology the business asked for when an order cannot be fulfilled from
 * stock: "we are sorry we were unable to fulfil your order; we will fulfil it at
 * the earliest". Sent by an admin from the order page, never automatically —
 * someone has to have decided the order is delayed before the customer is told.
 */
export function stockDelayMessage(
  to: string,
  details: { name: string; orderNumber: string; items: string[]; path: string },
): Mail {
  const href = `${env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}${details.path}`;
  const firstName = details.name.split(/\s+/)[0] || 'there';
  const items = details.items.join(', ');

  return {
    to,
    subject: `Your order ${details.orderNumber} is delayed — we are sorry`,
    text: [
      `Hi ${firstName},`,
      '',
      `We are sorry — we were unable to fulfil your order ${details.orderNumber} (${items}) on time, because it is out of stock.`,
      'We will fulfil it at the earliest and tell you as soon as it is on its way.',
      '',
      'If you would rather not wait, reply to this email or call us and we will cancel the order and refund you in full.',
      '',
      href,
    ].join('\n'),
    html: wrap(
      'We are sorry — your order is delayed',
      `Hi ${escapeHtml(firstName)}, we were unable to fulfil your order <strong>${escapeHtml(details.orderNumber)}</strong> (${escapeHtml(items)}) on time, because it is out of stock. We will fulfil it at the earliest and tell you as soon as it is on its way. If you would rather not wait, reply to this email or call us and we will cancel the order and refund you in full.`,
      { label: 'View your order', href },
    ),
  };
}

/**
 * The invoice for a paid order, sent by an admin from the order page with the
 * uploaded PDF attached. The order link lets the customer see the order itself;
 * the invoice travels only as the attachment.
 */
export function invoiceMessage(
  to: string,
  details: { name: string; orderNumber: string; path: string },
  invoice: { fileName: string; content: Buffer },
): Mail {
  const href = `${env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}${details.path}`;
  const firstName = details.name.split(/\s+/)[0] || 'there';

  return {
    to,
    subject: `Invoice for your iTarang order ${details.orderNumber}`,
    text: [
      `Hi ${firstName},`,
      '',
      `Thank you for your order ${details.orderNumber}. Your invoice is attached to this email as a PDF.`,
      'Please keep it for your records — you will need it for any warranty claim.',
      '',
      href,
    ].join('\n'),
    html: wrap(
      'Your invoice is attached',
      `Hi ${escapeHtml(firstName)}, thank you for your order <strong>${escapeHtml(details.orderNumber)}</strong>. Your invoice is attached to this email as a PDF. Please keep it for your records — you will need it for any warranty claim.`,
      { label: 'View your order', href },
    ),
    attachments: [{ filename: invoice.fileName, content: invoice.content, contentType: 'application/pdf' }],
  };
}

/** One order line as the order emails print it. */
export interface OrderMailLine {
  title: string;
  quantity: number;
  lineTotal: Paise;
}

function orderLinesTable(lines: OrderMailLine[], total: Paise): string {
  const rows = lines
    .map(
      (line) =>
        `<tr><td style="padding:4px 12px 4px 0">${escapeHtml(line.title)} × ${line.quantity}</td><td style="padding:4px 0;text-align:right;white-space:nowrap">${escapeHtml(formatPrice(line.lineTotal))}</td></tr>`,
    )
    .join('');
  return `<table style="font-size:14px;margin:0 0 16px;border-collapse:collapse;width:100%">${rows}<tr><td style="padding:8px 12px 4px 0;border-top:1px solid #ddd;font-weight:700">Total paid</td><td style="padding:8px 0 4px;border-top:1px solid #ddd;text-align:right;font-weight:700;white-space:nowrap">${escapeHtml(formatPrice(total))}</td></tr></table>`;
}

/**
 * The customer's confirmation, sent once when payment is received (R-03).
 *
 * The button opens the order page, which is also where tracking appears once
 * the order ships.
 */
export function orderConfirmationMessage(
  to: string,
  details: { name: string; orderNumber: string; lines: OrderMailLine[]; total: Paise; path: string },
): Mail {
  const href = `${env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}${details.path}`;
  const firstName = details.name.split(/\s+/)[0] || 'there';

  return {
    to,
    subject: `Order ${details.orderNumber} confirmed — thank you`,
    text: [
      `Hi ${firstName},`,
      '',
      `We have received your payment and your order ${details.orderNumber} is confirmed.`,
      '',
      ...details.lines.map((line) => `${line.title} × ${line.quantity} — ${formatPrice(line.lineTotal)}`),
      `Total paid: ${formatPrice(details.total)}`,
      '',
      'We will email you again when it ships. You can follow it on your order page:',
      href,
    ].join('\n'),
    html: wrap(
      'Your order is confirmed',
      `Hi ${escapeHtml(firstName)}, we have received your payment and your order <strong>${escapeHtml(details.orderNumber)}</strong> is confirmed. We will email you again when it ships, and you can follow it on your order page.`,
      { label: 'Track your order', href },
      orderLinesTable(details.lines, details.total),
    ),
  };
}

/** The team's alert for the same paid order, with what is needed to act on it. */
export function orderPaidAlertMessage(
  to: string,
  details: {
    orderNumber: string;
    customer: string;
    phone: string;
    email?: string;
    city: string;
    pincode: string;
    paymentMethod: string;
    lines: OrderMailLine[];
    total: Paise;
    isTest: boolean;
  },
): Mail {
  const href = `${env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/admin/orders/${encodeURIComponent(details.orderNumber)}`;
  const prefix = details.isTest ? '[TEST] ' : '';
  const fields: Array<[string, string]> = [
    ['Customer', details.customer],
    ['Mobile', details.phone],
    ['Email', details.email ?? '—'],
    ['Deliver to', `${details.city} ${details.pincode}`],
    ['Paid by', details.paymentMethod],
  ];
  const rows = fields
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">${escapeHtml(label)}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`,
    )
    .join('');

  return {
    to,
    subject: `${prefix}New paid order ${details.orderNumber} — ${formatPrice(details.total)}`,
    text: [
      `${prefix}Paid order ${details.orderNumber}`,
      '',
      ...fields.map(([label, value]) => `${label}: ${value}`),
      '',
      ...details.lines.map((line) => `${line.title} × ${line.quantity} — ${formatPrice(line.lineTotal)}`),
      `Total: ${formatPrice(details.total)}`,
      '',
      href,
    ].join('\n'),
    html: wrap(
      `${prefix}New paid order — ${details.orderNumber}`,
      'Pack and dispatch it from the order page.',
      { label: 'Open the order', href },
      `<table style="font-size:14px;margin:0 0 16px;border-collapse:collapse">${rows}</table>${orderLinesTable(details.lines, details.total)}`,
    ),
  };
}

/**
 * The daily list of paid orders still without an invoice (R-08), sent to the
 * team by `/api/cron/invoice-reminder`. Only sent when the list is not empty.
 */
export function invoiceReminderMessage(
  to: string,
  orders: Array<{ orderNumber: string; customerName: string; total: Paise; paidAt: string }>,
): Mail {
  const base = env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const count = `${orders.length} paid order${orders.length === 1 ? '' : 's'}`;
  const paidOn = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  const rows = orders
    .map(
      (order) =>
        `<tr><td style="padding:4px 12px 4px 0"><a href="${base}/admin/orders/${encodeURIComponent(order.orderNumber)}">${escapeHtml(order.orderNumber)}</a></td><td style="padding:4px 12px 4px 0">${escapeHtml(order.customerName)}</td><td style="padding:4px 12px 4px 0;white-space:nowrap">${escapeHtml(formatPrice(order.total))}</td><td style="padding:4px 0;color:#666;white-space:nowrap">paid ${escapeHtml(paidOn(order.paidAt))}</td></tr>`,
    )
    .join('');

  return {
    to,
    subject: `${count} waiting for an invoice`,
    text: [
      `${count} paid more than a day ago and have no invoice uploaded:`,
      '',
      ...orders.map(
        (order) =>
          `${order.orderNumber} — ${order.customerName} — ${formatPrice(order.total)} — paid ${paidOn(order.paidAt)}`,
      ),
      '',
      'Raise each in Zoho or Vyapaar and upload the PDF on the order page.',
      `${base}/admin`,
    ].join('\n'),
    html: wrap(
      `${count} waiting for an invoice`,
      'Each was paid more than a day ago. Raise the invoice in Zoho or Vyapaar and upload the PDF, with its number and date, on the order page.',
      { label: 'Open the orders', href: `${base}/admin` },
      `<table style="font-size:14px;margin:0 0 16px;border-collapse:collapse">${rows}</table>`,
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

/** "Mon, 10 Nov 2026" on the Indian calendar — the day a refund should land. */
function refundDay(iso: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`;
}

/** What a refund email says about one refund, shared by the customer and team mails. */
export interface RefundMailDetails {
  orderNumber: string;
  amount: Paise;
  /** Everything refunded on the order so far, this refund included. */
  refundedSoFar: Paise;
  orderTotal: Paise;
  state: 'pending' | 'processed' | 'failed';
  reference?: string;
  /** From `customerRefunds`: when the money should reach the payment method. */
  creditFrom?: string;
  creditBy?: string;
}

/** The sentence that tells the customer when to expect the money. */
function refundTimelineSentence(details: RefundMailDetails): string {
  const window =
    details.creditFrom && details.creditBy
      ? ` — between ${refundDay(details.creditFrom)} and ${refundDay(details.creditBy)}`
      : '';
  return details.state === 'processed'
    ? `It will be credited to your original payment method within 5–7 working days${window}.`
    : `It takes 3–5 working days to process, and your bank or card issuer then credits it within 5–7 working days${window}.`;
}

/**
 * Sent to the customer for each refund on their order (R-12): when it starts,
 * and again when the gateway confirms a refund that was still processing. The
 * timeline is the one Razorpay shows on the payment.
 */
export function refundCustomerMessage(
  to: string,
  details: RefundMailDetails & { name: string; path: string },
): Mail {
  const href = `${env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}${details.path}`;
  const firstName = details.name.split(/\s+/)[0] || 'there';
  const amount = formatPrice(details.amount);
  const full = details.refundedSoFar >= details.orderTotal;
  const opening =
    details.state === 'processed'
      ? `We have refunded ${amount} for your order ${details.orderNumber}.`
      : `We have started a refund of ${amount} for your order ${details.orderNumber}.`;
  const sofar = full
    ? `That completes the refund of the full ${formatPrice(details.orderTotal)} you paid.`
    : `${formatPrice(details.refundedSoFar)} of the ${formatPrice(details.orderTotal)} you paid has now been refunded.`;
  const reference = details.reference ? `Refund reference: ${details.reference}.` : '';
  const help = `Not received by then? Call ${SITE.phone} or write to ${SITE.email} with this reference.`;
  const lines = [opening, refundTimelineSentence(details), sofar, reference, help].filter(Boolean);

  return {
    to,
    subject:
      details.state === 'processed'
        ? `Refund of ${amount} processed — order ${details.orderNumber}`
        : `Refund of ${amount} started — order ${details.orderNumber}`,
    text: [`Hi ${firstName},`, '', ...lines, '', href].join('\n'),
    html: wrap(
      details.state === 'processed' ? 'Your refund has been processed' : 'Your refund is on its way',
      `Hi ${escapeHtml(firstName)},<br><br>${lines.map(escapeHtml).join('<br>')}`,
      { label: 'View your order', href },
    ),
  };
}

/**
 * The team's copy of each refund (R-12): customer care, ORDER_ALERT_EMAILS and
 * the admin who made it. A failed refund is sent here only — nothing reached
 * the customer, and somebody has to retry it.
 */
export function refundTeamMessage(
  to: string,
  details: RefundMailDetails & {
    customer: string;
    phone: string;
    email?: string;
    reason: string;
    by: string;
    error?: string;
  },
): Mail {
  const href = `${env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/admin/orders/${encodeURIComponent(details.orderNumber)}`;
  const amount = formatPrice(details.amount);
  const status =
    details.state === 'processed' ? 'Processed' : details.state === 'pending' ? 'Processing' : 'FAILED';
  const lines = [
    `${status}: ${amount} refund on order ${details.orderNumber}.`,
    `Customer: ${details.customer}, ${details.phone}${details.email ? `, ${details.email}` : ''}.`,
    `Refunded so far: ${formatPrice(details.refundedSoFar)} of ${formatPrice(details.orderTotal)}.`,
    `Reason: ${details.reason}. By: ${details.by}.`,
    details.reference ? `Refund reference: ${details.reference}.` : '',
    details.state === 'failed'
      ? `The gateway did not refund it${details.error ? ` (${details.error})` : ''}. Check the gateway dashboard and refund again from the order page.`
      : details.creditBy
        ? `The customer has been told to expect it by ${refundDay(details.creditBy)}.`
        : '',
  ].filter(Boolean);

  return {
    to,
    subject: `Refund ${status.toLowerCase()} — ${amount} on ${details.orderNumber}`,
    text: [...lines, '', href].join('\n'),
    html: wrap(`Refund ${status.toLowerCase()} — ${details.orderNumber}`, lines.map(escapeHtml).join('<br>'), {
      label: 'Open the order',
      href,
    }),
  };
}

/** The team's alert when a customer presses "Request cancellation" (R-12). */
export function cancellationRequestAlertMessage(
  to: string,
  details: { orderNumber: string; customer: string; phone: string; note?: string; total: Paise },
): Mail {
  const href = `${env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/admin/orders/${encodeURIComponent(details.orderNumber)}`;
  const lines = [
    `${details.customer} (${details.phone}) asked to cancel order ${details.orderNumber} — ${formatPrice(details.total)}.`,
    details.note ? `Reason given: ${details.note}` : 'No reason given.',
  ];

  return {
    to,
    subject: `Cancellation requested — ${details.orderNumber}`,
    text: [...lines, '', 'Call the customer, then cancel and refund from the order page if it has not shipped.', href].join('\n'),
    html: wrap(
      `Cancellation requested — ${details.orderNumber}`,
      `${lines.map(escapeHtml).join('<br>')}<br><br>Call the customer, then cancel and refund from the order page if it has not shipped.`,
      { label: 'Open the order', href },
    ),
  };
}
