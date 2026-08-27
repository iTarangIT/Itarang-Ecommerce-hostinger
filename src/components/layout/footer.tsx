'use client';

import * as React from 'react';
import Link from 'next/link';
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { FOOTER_COLUMNS, POLICY_LINKS, SITE } from '@/lib/site';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { useUI } from '@/lib/store/ui-provider';
import { Logo } from './logo';

const PAYMENT_METHODS = ['UPI', 'Visa', 'Mastercard', 'RuPay', 'Net banking', 'EMI', 'Cash on delivery'];

export function Footer() {
  const { toast } = useUI();
  const [email, setEmail] = React.useState('');

  return (
    <footer className="mt-16 border-t border-border bg-ink-900 text-ink-50">
      {/* Support strip */}
      <div className="border-b border-white/10">
        <div className="container grid gap-4 py-6 sm:grid-cols-3">
          <a
            href={SITE.phoneHref}
            className="flex items-start gap-3 rounded-md p-2 transition-colors hover:bg-white/5"
          >
            <Phone className="mt-0.5 h-5 w-5 shrink-0 text-primary-300" />
            <span>
              <span className="block text-sm font-semibold">{SITE.phone}</span>
              <span className="block text-xs text-ink-50/60">{SITE.supportHours}</span>
            </span>
          </a>
          <a
            href={`mailto:${SITE.email}`}
            className="flex items-start gap-3 rounded-md p-2 transition-colors hover:bg-white/5"
          >
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary-300" />
            <span>
              <span className="block text-sm font-semibold">{SITE.email}</span>
              <span className="block text-xs text-ink-50/60">
                Orders, warranty and service
              </span>
            </span>
          </a>
          <a
            href={SITE.whatsapp}
            className="flex items-start gap-3 rounded-md p-2 transition-colors hover:bg-white/5"
          >
            <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary-300" />
            <span>
              <span className="block text-sm font-semibold">WhatsApp support</span>
              <span className="block text-xs text-ink-50/60">
                Send a photo of your setup for faster help
              </span>
            </span>
          </a>
        </div>
      </div>

      <div className="container grid gap-10 py-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Logo tone="inverse" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-50/70">
            {SITE.description}
          </p>

          <form
            className="mt-6 max-w-sm"
            onSubmit={(e) => {
              e.preventDefault();
              if (!email.includes('@')) {
                toast({ title: 'Enter a valid email address', tone: 'error' });
                return;
              }
              setEmail('');
              toast({
                title: 'Thanks — you are on the list',
                description: 'You will hear from us when there is something worth reading.',
                tone: 'success',
              });
            }}
          >
            <label htmlFor="newsletter" className="text-sm font-semibold">
              Offers and buying guides
            </label>
            <div className="mt-2 flex gap-2">
              <Input
                id="newsletter"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="border-white/20 bg-white/10 text-ink-50 placeholder:text-ink-50/50 hover:border-white/40"
              />
              <Button type="submit" variant="accent" className="shrink-0">
                Subscribe
              </Button>
            </div>
            <p className="mt-2 text-xs text-ink-50/50">
              No more than one email a month. Unsubscribe any time.
            </p>
          </form>
        </div>

        <div className="grid gap-8 sm:grid-cols-3 lg:col-span-8">
          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.label} aria-label={column.label}>
              <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-primary-300">
                {column.label}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {column.children.map((child) => (
                  <li key={child.href}>
                    <Link
                      href={child.href}
                      className="text-sm text-ink-50/75 transition-colors hover:text-primary-300"
                    >
                      {child.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container flex flex-col gap-4 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-50/50">We accept</span>
            {PAYMENT_METHODS.map((method) => (
              <span
                key={method}
                className="rounded-sm border border-white/15 bg-white/5 px-2 py-1 text-2xs font-medium text-ink-50/70"
              >
                {method}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 pt-4 text-xs text-ink-50/55 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {SITE.address}
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {POLICY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-primary-300">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-ink-50/45">
            © {new Date().getFullYear()} {SITE.name}. All rights reserved. Prices include GST; a GST
            invoice is issued with every order.
          </p>
        </div>
      </div>
    </footer>
  );
}
