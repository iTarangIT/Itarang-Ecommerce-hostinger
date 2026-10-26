'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A searchable list of checkboxes with "Select all" and "Clear", for picking
 * any number of values — every state, two cities, one whole state's cities.
 *
 * Each selected value is submitted as its own hidden `<input name=…>`, exactly
 * what a `<select multiple>` sends, so the Server Action reading
 * `formData.getAll(name)` does not change.
 *
 * Options may carry a `group` (a city's state): groups fold away and get their
 * own "all in this group" box, and open by themselves while searching.
 * A selected value that is not among the options (a city saved before the list
 * existed, or one whose state was since unticked) is kept and shown as a chip,
 * never dropped silently.
 */

export interface MultiSelectOption {
  value: string;
  label?: string;
  group?: string;
}

const MAX_CHIPS = 24;

export function MultiSelect({
  name,
  options,
  value,
  defaultValue = [],
  onChange,
  noun,
  emptyLabel,
  loading = false,
  className,
}: {
  name: string;
  options: MultiSelectOption[];
  /** Controlled selection; leave out to let the component keep its own. */
  value?: string[];
  defaultValue?: string[];
  onChange?: (values: string[]) => void;
  /** Plural, lower-case: "states", "cities". */
  noun: string;
  /** What an empty selection means, e.g. "Any state". */
  emptyLabel: string;
  loading?: boolean;
  className?: string;
}) {
  const [own, setOwn] = useState<string[]>(defaultValue);
  const selected = value ?? own;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const chosen = useMemo(() => new Set(selected), [selected]);
  const term = search.trim().toLowerCase();
  const shown = useMemo(
    () =>
      term
        ? options.filter((option) => (option.label ?? option.value).toLowerCase().includes(term))
        : options,
    [options, term],
  );

  const groups = useMemo(() => {
    const map = new Map<string, MultiSelectOption[]>();
    for (const option of shown) {
      const key = option.group ?? '';
      const list = map.get(key);
      if (list) list.push(option);
      else map.set(key, [option]);
    }
    return [...map.entries()];
  }, [shown]);
  const grouped = groups.some(([key]) => key !== '');

  function set(next: string[]) {
    const unique = [...new Set(next)];
    if (value === undefined) setOwn(unique);
    onChange?.(unique);
  }
  const add = (values: string[]) => set([...selected, ...values]);
  const remove = (values: string[]) => {
    const drop = new Set(values);
    set(selected.filter((item) => !drop.has(item)));
  };
  const toggle = (item: string) => (chosen.has(item) ? remove([item]) : add([item]));

  const allShownChosen = shown.length > 0 && shown.every((option) => chosen.has(option.value));
  const allOptionsChosen = options.length > 0 && options.every((option) => chosen.has(option.value));
  const summary =
    selected.length === 0
      ? emptyLabel
      : allOptionsChosen && selected.length === options.length
        ? `All ${options.length} ${noun}`
        : `${selected.length} ${selected.length === 1 ? noun.replace(/ies$/, 'y').replace(/s$/, '') : noun} selected`;

  const labelOf = (item: string) => options.find((option) => option.value === item)?.label ?? item;

  return (
    <div className={cn('rounded-md border border-input bg-card', className)}>
      {selected.map((item) => (
        <input key={item} type="hidden" name={name} value={item} />
      ))}

      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="flex h-11 w-full items-center justify-between gap-2 px-3 text-left text-sm"
      >
        <span className={cn(selected.length === 0 && 'text-muted-foreground')}>{summary}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2">
          {selected.slice(0, MAX_CHIPS).map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2 py-0.5 text-xs text-foreground"
            >
              {labelOf(item)}
              <button
                type="button"
                onClick={() => remove([item])}
                aria-label={`Remove ${labelOf(item)}`}
                className="rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {selected.length > MAX_CHIPS ? (
            <span className="text-xs text-muted-foreground">and {selected.length - MAX_CHIPS} more</span>
          ) : null}
          <button
            type="button"
            onClick={() => set([])}
            className="ml-auto text-xs font-medium text-primary hover:underline"
          >
            Clear all
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="border-t border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${noun}`}
              className="h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm"
              // Enter in the search box must not submit the campaign form.
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.preventDefault();
              }}
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <button
              type="button"
              disabled={shown.length === 0}
              onClick={() =>
                allShownChosen ? remove(shown.map((o) => o.value)) : add(shown.map((o) => o.value))
              }
              className="font-medium text-primary hover:underline disabled:opacity-50"
            >
              {allShownChosen
                ? term
                  ? 'Unselect these'
                  : 'Unselect all'
                : term
                  ? `Select these ${shown.length}`
                  : `Select all ${shown.length} ${noun}`}
            </button>
            <span className="text-muted-foreground">
              {loading ? 'Loading…' : `${shown.length} shown`}
            </span>
          </div>

          <div className="mt-2 max-h-72 overflow-y-auto pr-1">
            {groups.length === 0 && !loading ? (
              <p className="py-3 text-sm text-muted-foreground">No {noun} match.</p>
            ) : null}
            {groups.map(([group, list]) => {
              if (!grouped) {
                return (
                  <ul key="all" className="grid gap-x-4 sm:grid-cols-2">
                    {list.map((option) => (
                      <Row key={option.value} option={option} checked={chosen.has(option.value)} onToggle={toggle} />
                    ))}
                  </ul>
                );
              }
              const expanded = Boolean(term) || openGroups.has(group);
              const inGroup = list.map((option) => option.value);
              const count = inGroup.filter((item) => chosen.has(item)).length;
              const all = count === inGroup.length;
              return (
                <div key={group} className="border-b border-border/60 py-1 last:border-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenGroups((was) => {
                          const next = new Set(was);
                          if (next.has(group)) next.delete(group);
                          else next.add(group);
                          return next;
                        })
                      }
                      aria-expanded={expanded}
                      className="flex flex-1 items-center gap-1 py-1 text-left text-sm font-medium"
                    >
                      <ChevronRight className={cn('h-4 w-4 transition-transform', expanded && 'rotate-90')} />
                      {group}
                      <span className="text-xs font-normal text-muted-foreground">
                        {count > 0 ? `${count} of ${inGroup.length}` : inGroup.length}
                      </span>
                    </button>
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={all}
                        ref={(box) => {
                          if (box) box.indeterminate = count > 0 && !all;
                        }}
                        onChange={() => (all ? remove(inGroup) : add(inGroup))}
                        className="h-4 w-4 accent-[hsl(var(--accent))]"
                      />
                      All
                    </label>
                  </div>
                  {expanded ? (
                    <ul className="grid gap-x-4 pb-1 pl-5 sm:grid-cols-2">
                      {list.map((option) => (
                        <Row key={option.value} option={option} checked={chosen.has(option.value)} onToggle={toggle} />
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({
  option,
  checked,
  onToggle,
}: {
  option: MultiSelectOption;
  checked: boolean;
  onToggle: (value: string) => void;
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-surface">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(option.value)}
          className="h-4 w-4 accent-[hsl(var(--accent))]"
        />
        {option.label ?? option.value}
      </label>
    </li>
  );
}
