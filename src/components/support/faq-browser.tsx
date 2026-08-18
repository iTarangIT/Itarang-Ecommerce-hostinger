'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { FAQ_SECTIONS } from '@/lib/support/faqs';
import { Accordion } from '@/components/ui/accordion';
import { ButtonLink } from '@/components/ui/button';
import { StateBlock } from '@/components/ui/states';
import { cn } from '@/lib/utils';

export function FaqBrowser() {
  const [term, setTerm] = React.useState('');
  const [section, setSection] = React.useState<string | null>(null);

  const normalised = term.trim().toLowerCase();

  const sections = React.useMemo(() => {
    return FAQ_SECTIONS.map((s) => ({
      ...s,
      entries: s.entries.filter(
        (entry) =>
          !normalised ||
          entry.question.toLowerCase().includes(normalised) ||
          entry.answer.toLowerCase().includes(normalised),
      ),
    })).filter((s) => s.entries.length > 0 && (!section || s.id === section));
  }, [normalised, section]);

  const totalMatches = sections.reduce((n, s) => n + s.entries.length, 0);

  return (
    <div>
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <label className="relative block">
          <span className="sr-only">Search the FAQ</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search questions — sizing, warranty, delivery, GST…"
            className="h-12 w-full rounded-md border border-input bg-surface pl-11 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus-visible:ring-2 focus-visible:ring-ring"
          />
          {term ? (
            <button
              type="button"
              onClick={() => setTerm('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground hover:bg-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </label>

        <ul className="mt-3 flex flex-wrap gap-2">
          <li>
            <button
              type="button"
              onClick={() => setSection(null)}
              aria-pressed={section === null}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                section === null
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:border-accent/50',
              )}
            >
              All topics
            </button>
          </li>
          {FAQ_SECTIONS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSection(section === s.id ? null : s.id)}
                aria-pressed={section === s.id}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                  section === s.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:border-accent/50',
                )}
              >
                {s.title}
              </button>
            </li>
          ))}
        </ul>

        {normalised ? (
          <p className="tabular mt-3 text-sm text-muted-foreground">
            {totalMatches} {totalMatches === 1 ? 'question matches' : 'questions match'} “
            {term.trim()}”
          </p>
        ) : null}
      </div>

      {sections.length === 0 ? (
        <StateBlock
          className="mt-6"
          title={`No question matches “${term.trim()}”`}
          description="Try a shorter phrase, or ask us directly — we answer every message that comes in."
          actions={
            <>
              <ButtonLink href="/support" variant="primary">
                Contact support
              </ButtonLink>
              <ButtonLink href="/tools/load-calculator" variant="outline">
                Size my system
              </ButtonLink>
            </>
          }
        />
      ) : (
        <div className="mt-8 space-y-8">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-28">
              <h2 className="heading-3">{s.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
              <Accordion
                className="mt-4"
                items={s.entries.map((entry, index) => ({
                  id: entry.id,
                  title: entry.question,
                  defaultOpen: Boolean(normalised) || (s.id === sections[0].id && index === 0),
                  children: (
                    <p className="text-sm leading-relaxed text-muted-foreground">{entry.answer}</p>
                  ),
                }))}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
