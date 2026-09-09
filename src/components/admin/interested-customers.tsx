'use client';

import * as React from 'react';
import { AlertTriangle, Loader2, Mail, Users } from 'lucide-react';
import {
  interestedCustomersAction,
  sendBackInStockAction,
  type SendResult,
} from '@/lib/stock/admin-actions';
import type { InterestedCustomer, InterestSource } from '@/lib/stock/notifications';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/field';
import { cn } from '@/lib/utils';

/**
 * Who is waiting for a product, and the manual send.
 *
 * Loaded on demand rather than with the page: an administrator scanning the
 * out-of-stock list wants the list, and pulling every product's interested
 * customers to render collapsed panels would be one query per row for data
 * almost none of them opens.
 *
 * **The three sources are labelled and not treated alike.** Only "asked to be
 * notified" is an opt-in. A wishlist entry and an add-to-cart are interest the
 * customer expressed in the product, not consent to be emailed about it, and
 * the panel says so rather than quietly folding them into one list. Nothing is
 * pre-selected for them; sending is always the administrator's decision.
 */

const SOURCE_LABEL: Record<InterestSource, string> = {
  'notify-me': 'Asked to be notified',
  wishlist: 'Saved to wishlist',
  cart: 'Added to cart',
};

const SOURCE_TONE: Record<InterestSource, string> = {
  'notify-me': 'bg-success-soft text-success',
  wishlist: 'bg-accent-50 text-accent-600',
  cart: 'bg-warning-soft text-warning',
};

export function InterestedCustomers({
  productKey,
  notificationsEnabled,
}: {
  productKey: string;
  notificationsEnabled: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [customers, setCustomers] = React.useState<InterestedCustomer[] | null>(null);
  const [restockId, setRestockId] = React.useState<number | null>(null);
  const [alreadyNotified, setAlreadyNotified] = React.useState(0);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [sending, setSending] = React.useState(false);
  const [result, setResult] = React.useState<SendResult | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await interestedCustomersAction(productKey);
      setCustomers(data.customers);
      setRestockId(data.restockId);
      setAlreadyNotified(data.alreadyNotified);
      // Only explicit opt-ins are pre-selected. Anything else is a decision
      // somebody has to make on purpose. Everyone returned is still waiting —
      // the query no longer lists people who have been told.
      setSelected(
        new Set(
          data.customers
            .filter((customer) => customer.source === 'notify-me')
            .map((customer) => customer.email),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [productKey]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && customers === null) void load();
  };

  const total = customers?.length ?? 0;
  const allSelected = total > 0 && selected.size === total;

  const send = async () => {
    setSending(true);
    setResult(null);
    try {
      const outcome = await sendBackInStockAction(productKey, [...selected]);
      setResult(outcome);
      if (outcome.sent > 0) await load();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-600 underline-offset-4 hover:underline"
      >
        <Users className="h-3.5 w-3.5" />
        {open ? 'Hide interested customers' : 'Interested customers'}
      </button>

      {open ? (
        <div className="mt-2 rounded-lg border border-border bg-surface p-3">
          {loading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading…
            </p>
          ) : !customers || customers.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {alreadyNotified > 0
                ? `Everybody interested in this product has been told — ${alreadyNotified} customer${alreadyNotified === 1 ? '' : 's'} notified about this restock.`
                : 'Nobody has asked about this product, saved it, or put it in a cart.'}
            </p>
          ) : (
            <>
              {/* One control for the whole list, because the business case is
                  "eleven people want this, tell all of them". Ticking eleven
                  boxes to do the obvious thing is the sort of friction that
                  ends with somebody missing the twelfth. */}
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                <label className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <Checkbox
                    checked={allSelected}
                    onChange={() =>
                      setSelected(
                        allSelected ? new Set() : new Set(customers.map((c) => c.email)),
                      )
                    }
                    aria-label="Select every interested customer"
                  />
                  {allSelected ? 'Clear selection' : `Select all ${customers.length}`}
                </label>
                <span className="text-2xs text-muted-foreground">
                  {selected.size} selected
                  {alreadyNotified > 0
                    ? ` · ${alreadyNotified} already told and no longer listed`
                    : ''}
                </span>
              </div>

              <ul className="space-y-1.5">
                {customers.map((customer) => (
                  <li key={customer.email} className="flex flex-wrap items-center gap-2 text-xs">
                    <Checkbox
                      checked={selected.has(customer.email)}
                      onChange={() =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (next.has(customer.email)) next.delete(customer.email);
                          else next.add(customer.email);
                          return next;
                        })
                      }
                      aria-label={`Select ${customer.email}`}
                    />
                    <span className="font-medium text-foreground">{customer.email}</span>
                    <span
                      className={cn(
                        'rounded-sm px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide',
                        SOURCE_TONE[customer.source],
                      )}
                    >
                      {SOURCE_LABEL[customer.source]}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Stated plainly rather than left to be discovered: two of the
                  three sources never agreed to marketing mail, and whether they
                  may be emailed is a business decision this console does not
                  make on anyone's behalf. */}
              {customers.some((customer) => customer.source !== 'notify-me') ? (
                <p className="mt-2.5 flex items-start gap-1.5 rounded-md bg-warning-soft p-2 text-2xs text-foreground">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
                  Only “asked to be notified” is an opt-in. Wishlist and cart entries are interest
                  in the product, not consent to be emailed — they are listed for context and are
                  not selected by default.
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={send}
                  disabled={sending || selected.size === 0 || !notificationsEnabled || !restockId}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  {allSelected && total > 1
                    ? `Send “back in stock” to all ${total}`
                    : `Send “back in stock” to ${selected.size}`}
                </Button>

                {!notificationsEnabled ? (
                  <span className="text-2xs text-muted-foreground">
                    Stock notification emails are switched off.
                  </span>
                ) : !restockId ? (
                  <span className="text-2xs text-muted-foreground">
                    No recorded restock yet — put stock back first.
                  </span>
                ) : null}
              </div>

              {result ? (
                <p
                  className={cn(
                    'mt-2 text-xs font-medium',
                    result.error ? 'text-destructive' : 'text-foreground',
                  )}
                >
                  {result.error ??
                    `${result.sent} sent` +
                      (result.skipped > 0 ? `, ${result.skipped} already notified` : '') +
                      (result.failed > 0 ? `, ${result.failed} failed` : '') +
                      (result.sent > 0
                        ? '. Everyone told has been taken off this list.'
                        : '.')}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
