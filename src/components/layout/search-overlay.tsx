'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Clock, Loader2, Search, TrendingUp, X } from 'lucide-react';
import type { SearchSuggestion } from '@/lib/commerce/types';
import { formatPrice } from '@/lib/catalog/pricing';
import { useUI } from '@/lib/store/ui-provider';
import { useScrollLock } from '@/components/ui/overlay';
import { cn } from '@/lib/utils';

const RECENT_KEY = 'itarang.recentSearches.v1';
const MAX_RECENT = 5;

const POPULAR = [
  '900VA inverter',
  'lithium battery',
  'inverter battery combo',
  '150Ah tubular',
  'solar ready',
  'UPS for desktop',
];

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Full-screen search overlay used on every breakpoint.
 *
 * Debounced suggestions, keyboard navigation with arrow keys, recent and
 * popular searches when the field is empty, and an explicit recovery path when
 * nothing matches.
 */
export function SearchOverlay() {
  const { overlay, close } = useUI();
  const router = useRouter();
  const open = overlay === 'search';

  const [term, setTerm] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const [recent, setRecent] = React.useState<string[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  useScrollLock(open);

  React.useEffect(() => {
    if (!open) return;
    setRecent(readRecent());
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      setTerm('');
      setSuggestions([]);
      setActive(-1);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { suggestions: SearchSuggestion[] };
        setSuggestions(data.suggestions);
        setActive(-1);
      } catch {
        // Aborted or offline — leave the previous list rather than flashing empty.
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [term, open]);

  const rememberAndGo = React.useCallback(
    (query: string, href?: string) => {
      const trimmed = query.trim();
      if (trimmed) {
        const next = [trimmed, ...readRecent().filter((r) => r !== trimmed)].slice(0, MAX_RECENT);
        try {
          window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        } catch {
          /* non-blocking */
        }
      }
      close();
      router.push(href ?? `/search?q=${encodeURIComponent(trimmed)}`);
    },
    [close, router],
  );

  if (!open) return null;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = active >= 0 ? suggestions[active] : undefined;
      if (chosen) rememberAndGo(term, chosen.href);
      else if (term.trim()) rememberAndGo(term);
    }
  };

  const showEmptyPrompts = term.trim().length < 2;
  const noResults = !showEmptyPrompts && !loading && suggestions.length === 0;

  return (
    <div className="fixed inset-0 z-[75] flex flex-col bg-background">
      <div className="border-b border-border bg-card">
        <div className="container flex h-16 items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search 900VA, lithium, UPS, combo…"
              aria-label="Search products"
              role="combobox"
              aria-expanded={suggestions.length > 0}
              aria-controls="search-suggestions"
              className="h-12 w-full rounded-md border border-input bg-surface pl-11 pr-4 text-base text-foreground placeholder:text-muted-foreground focus:border-accent focus-visible:ring-2 focus-visible:ring-ring"
            />
            {loading ? (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          <button
            type="button"
            onClick={close}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Close search"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="container py-6">
          {showEmptyPrompts ? (
            <div className="grid gap-8 sm:grid-cols-2">
              {recent.length > 0 ? (
                <section>
                  <h2 className="eyebrow flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Recent searches
                  </h2>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {recent.map((r) => (
                      <li key={r}>
                        <button
                          type="button"
                          onClick={() => rememberAndGo(r)}
                          className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors hover:border-accent/50 hover:text-accent-600"
                        >
                          {r}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section>
                <h2 className="eyebrow flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" /> Popular searches
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {POPULAR.map((p) => (
                    <li key={p}>
                      <button
                        type="button"
                        onClick={() => rememberAndGo(p)}
                        className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors hover:border-accent/50 hover:text-accent-600"
                      >
                        {p}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : noResults ? (
            <div className="mx-auto max-w-lg py-8 text-center">
              <h2 className="font-display text-lg font-bold text-foreground">
                Nothing matched “{term.trim()}”
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a capacity like <strong>900VA</strong>, a chemistry like{' '}
                <strong>lithium</strong>, or tell us the appliances you need to run and we will size
                a system for you.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => rememberAndGo('', '/tools/load-calculator')}
                  className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground"
                >
                  Open the load calculator
                </button>
                <button
                  type="button"
                  onClick={() => rememberAndGo('', '/search')}
                  className="rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground"
                >
                  Browse everything
                </button>
              </div>
            </div>
          ) : (
            <ul id="search-suggestions" role="listbox" className="mx-auto max-w-2xl space-y-1">
              {suggestions.map((s, index) => (
                <li key={`${s.type}-${s.href}`} role="option" aria-selected={index === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => rememberAndGo(term, s.href)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md border border-transparent p-2.5 text-left transition-colors',
                      index === active ? 'border-border bg-card shadow-card' : 'hover:bg-card',
                    )}
                  >
                    {s.image ? (
                      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-sm bg-secondary">
                        <Image src={s.image} alt="" fill sizes="56px" className="object-contain p-1" />
                      </span>
                    ) : (
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-sm bg-secondary text-muted-foreground">
                        {s.type === 'query' ? (
                          <ArrowUpRight className="h-5 w-5" />
                        ) : (
                          <Search className="h-5 w-5" />
                        )}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {s.label}
                      </span>
                      {s.sublabel ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {s.sublabel}
                        </span>
                      ) : null}
                    </span>
                    {s.price ? (
                      <span className="tabular shrink-0 text-sm font-bold text-foreground">
                        {formatPrice(s.price.selling)}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
