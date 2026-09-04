'use client';

import * as React from 'react';
import { Check, Loader2, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  archiveAddressAction,
  setDefaultAddressAction,
  type AccountFormState,
} from '@/lib/account/address-actions';
import type { CustomerAddress } from '@/lib/account/addresses';
import { Button } from '@/components/ui/button';
import { AddressForm } from './address-form';
import { cn } from '@/lib/utils';

/**
 * The saved address book.
 *
 * Rows come from the server already scoped to this account — the page reads
 * them with the session's own id — so nothing here filters or checks ownership.
 * Every button posts an id that the server re-authorises against the session
 * before it touches a row; an id belonging to somebody else matches nothing and
 * comes back as "not found".
 */
export function AddressList({ addresses }: { addresses: CustomerAddress[] }) {
  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  if (addresses.length === 0 && !adding) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary text-primary">
          <MapPin className="h-6 w-6" />
        </span>
        <h2 className="heading-4 mt-4">No saved addresses yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Save where you want deliveries to go and you will not have to type it
          again at checkout.
        </p>
        <Button variant="primary" className="mt-5" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" />
          Add an address
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="heading-4">Saved addresses</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The default one is offered first at checkout.
          </p>
        </div>
        {!adding ? (
          <Button variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
            Add an address
          </Button>
        ) : null}
      </div>

      {notice ? (
        <p className="rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}

      {adding ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
            New address
          </h3>
          <div className="mt-4">
            <AddressForm onDone={() => setAdding(false)} />
          </div>
        </div>
      ) : null}

      <ul className="space-y-3">
        {addresses.map((address) => (
          <li
            key={address.id}
            className={cn(
              'rounded-xl border bg-card p-5',
              address.isDefault ? 'border-primary/40' : 'border-border',
            )}
          >
            {editingId === address.id ? (
              <>
                <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
                  Edit address
                </h3>
                <div className="mt-4">
                  <AddressForm address={address} onDone={() => setEditingId(null)} />
                </div>
              </>
            ) : (
              <AddressCard
                address={address}
                onEdit={() => setEditingId(address.id)}
                onNotice={setNotice}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddressCard({
  address,
  onEdit,
  onNotice,
}: {
  address: CustomerAddress;
  onEdit: () => void;
  onNotice: (message: string | null) => void;
}) {
  const [pending, startTransition] = React.useTransition();

  const run = (action: (prev: AccountFormState, data: FormData) => Promise<AccountFormState>) => {
    const data = new FormData();
    data.append('id', String(address.id));
    startTransition(async () => {
      const result = await action(null, data);
      onNotice(result ? (result.ok ? (result.message ?? null) : result.error) : null);
    });
  };

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">{address.recipientName}</p>
          {address.isDefault ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <Check className="h-3 w-3" />
              Default
            </span>
          ) : null}
        </div>

        {/* A plain postal block. `line2` and `landmark` are optional and simply
            absent when unset, rather than rendering an empty line. */}
        <address className="mt-1.5 text-sm not-italic leading-relaxed text-muted-foreground">
          {address.line1}
          {address.line2 ? <>, {address.line2}</> : null}
          {address.landmark ? <>, {address.landmark}</> : null}
          <br />
          {address.city}, {address.state} {address.pincode}
          <br />
          <span className="tabular">{address.recipientPhone}</span>
        </address>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {!address.isDefault ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => run(setDefaultAddressAction)}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Make default
          </Button>
        ) : null}

        <Button variant="ghost" size="sm" onClick={onEdit} disabled={pending}>
          <Pencil className="h-4 w-4" />
          Edit
        </Button>

        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => run(archiveAddressAction)}
        >
          <Trash2 className="h-4 w-4" />
          Remove
        </Button>
      </div>
    </div>
  );
}
