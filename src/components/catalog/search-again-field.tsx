'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Inline search field on the results page, so refining never needs the overlay. */
export function SearchAgainField({ defaultValue = '' }: { defaultValue?: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState(defaultValue);
  // /search is a dynamic route, so submitting is a round trip with nothing to
  // show for it until the results stream in.
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => setValue(defaultValue), [defaultValue]);

  return (
    <form
      role="search"
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = value.trim();
        startTransition(() => {
          router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
        });
      }}
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search products, capacities or SKUs"
          aria-label="Search products"
          className="h-12 w-full rounded-md border border-input bg-card pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <Button type="submit" variant="primary" size="lg" className="shrink-0" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Search
      </Button>
    </form>
  );
}
