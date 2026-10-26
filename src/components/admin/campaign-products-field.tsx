'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Which products a campaign applies to: everything, whole categories, whole
 * sub-categories, single products, or any mix of them.
 *
 * A whole category or sub-category is saved as its slug, so a product added
 * to it later is covered too; single products are saved by product key. An
 * item qualifies when it matches any of them (see `qualifies` in coupons.ts).
 * Values go out as hidden inputs named `categories`, `subcategories` and
 * `productIds`, read by the campaign Server Action.
 */

export interface PickerCategory {
  slug: string;
  name: string;
  subcategories: Array<{ slug: string; name: string }>;
}

export interface PickerProduct {
  key: string;
  title: string;
  category: string;
  subcategory: string;
  draft: boolean;
}

const OTHER = '__other';

export function CampaignProductsField({
  categories,
  products,
  defaultCategories,
  defaultSubcategories,
  defaultProducts,
}: {
  categories: PickerCategory[];
  products: PickerProduct[];
  defaultCategories: string[];
  defaultSubcategories: string[];
  defaultProducts: string[];
}) {
  const [cats, setCats] = useState(() => new Set(defaultCategories));
  const [subs, setSubs] = useState(() => new Set(defaultSubcategories));
  const [picked, setPicked] = useState(() => new Set(defaultProducts));
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Set<string>>(
    () => new Set([...defaultCategories, ...defaultSubcategories.map((s) => `sub:${s}`)]),
  );

  const anyProduct = cats.size === 0 && subs.size === 0 && picked.size === 0;
  const term = search.trim().toLowerCase();

  /** category → sub-category → products, with a catch-all for unfiled ones. */
  const tree = useMemo(
    () =>
      categories.map((category) => {
        const known = new Set(category.subcategories.map((sub) => sub.slug));
        const inCategory = products.filter((p) => p.category === category.slug);
        const groups = [
          ...category.subcategories.map((sub) => ({
            slug: sub.slug,
            name: sub.name,
            products: inCategory.filter((p) => p.subcategory === sub.slug),
          })),
          { slug: OTHER, name: 'Other', products: inCategory.filter((p) => !known.has(p.subcategory)) },
        ].filter((group) => group.slug !== OTHER || group.products.length > 0);
        return { ...category, groups, count: inCategory.length };
      }),
    [categories, products],
  );

  const matches = (p: PickerProduct) => !term || p.title.toLowerCase().includes(term);

  function toggleIn(setter: typeof setCats, value: string, on: boolean) {
    setter((was) => {
      const next = new Set(was);
      if (on) next.add(value);
      else next.delete(value);
      return next;
    });
  }
  const toggleOpen = (key: string) =>
    setOpen((was) => {
      const next = new Set(was);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  /** Ticking a whole category makes its narrower picks redundant: drop them. */
  function setCategory(category: (typeof tree)[number], on: boolean) {
    toggleIn(setCats, category.slug, on);
    if (on) {
      const inside = new Set(category.groups.map((g) => g.slug));
      setSubs((was) => new Set([...was].filter((slug) => !inside.has(slug))));
      const keys = new Set(category.groups.flatMap((g) => g.products.map((p) => p.key)));
      setPicked((was) => new Set([...was].filter((key) => !keys.has(key))));
    }
  }

  function setSubcategory(products: PickerProduct[], slug: string, on: boolean) {
    toggleIn(setSubs, slug, on);
    if (on) {
      const keys = new Set(products.map((p) => p.key));
      setPicked((was) => new Set([...was].filter((key) => !keys.has(key))));
    }
  }

  function chooseAll() {
    setCats(new Set());
    setSubs(new Set());
    setPicked(new Set());
  }

  const covered = useMemo(() => {
    let total = 0;
    for (const category of tree) {
      for (const group of category.groups) {
        for (const p of group.products) {
          if (cats.has(category.slug) || subs.has(group.slug) || picked.has(p.key)) total += 1;
        }
      }
    }
    return total;
  }, [tree, cats, subs, picked]);

  return (
    <div className="space-y-3">
      {[...cats].map((slug) => (
        <input key={`c-${slug}`} type="hidden" name="categories" value={slug} />
      ))}
      {[...subs].map((slug) => (
        <input key={`s-${slug}`} type="hidden" name="subcategories" value={slug} />
      ))}
      {[...picked].map((key) => (
        <input key={`p-${key}`} type="hidden" name="productIds" value={key} />
      ))}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2 font-medium">
          <input
            type="radio"
            name="productScope"
            checked={anyProduct}
            onChange={chooseAll}
            className="h-4 w-4 accent-[hsl(var(--accent))]"
          />
          All products (every category)
        </label>
        <label className="flex items-center gap-2 font-medium">
          <input
            type="radio"
            name="productScope"
            checked={!anyProduct}
            onChange={() => {
              // Switching to "selected" starts from every category ticked,
              // so the admin narrows down rather than builds up.
              if (anyProduct) setCats(new Set(categories.map((c) => c.slug)));
            }}
            className="h-4 w-4 accent-[hsl(var(--accent))]"
          />
          Only selected categories or products
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        {anyProduct
          ? 'The discount applies to every product.'
          : `Applies to ${covered} of ${products.length} products${
              cats.size || subs.size ? ', and to new products added to the ticked categories' : ''
            }.`}
      </p>

      <div className={cn('rounded-md border border-border', anyProduct && 'opacity-60')}>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.preventDefault();
              }}
              placeholder="Search products"
              className="h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => setCats(new Set(categories.map((c) => c.slug)))}
            className="text-xs font-medium text-primary hover:underline"
          >
            Tick all categories
          </button>
          <button
            type="button"
            onClick={() => {
              setCats(new Set());
              setSubs(new Set());
              setPicked(new Set());
            }}
            className="text-xs font-medium text-primary hover:underline"
          >
            Clear
          </button>
        </div>

        <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto">
          {tree.map((category) => {
            const whole = cats.has(category.slug);
            const partial =
              !whole &&
              category.groups.some((g) => subs.has(g.slug) || g.products.some((p) => picked.has(p.key)));
            const visible = category.groups.some((g) => g.products.some(matches)) || !term;
            if (!visible) return null;
            const expanded = Boolean(term) || open.has(category.slug);
            return (
              <li key={category.slug} className="p-3">
                <div className="flex items-center gap-2">
                  <TriState
                    checked={whole}
                    indeterminate={partial}
                    onChange={(on) => setCategory(category, on)}
                    label={`All ${category.name}`}
                  />
                  <button
                    type="button"
                    onClick={() => toggleOpen(category.slug)}
                    aria-expanded={expanded}
                    className="flex flex-1 items-center gap-1 text-left text-sm font-semibold"
                  >
                    All {category.name}
                    <span className="text-xs font-normal text-muted-foreground">
                      {category.count} product{category.count === 1 ? '' : 's'}
                    </span>
                    <ChevronRight className={cn('ml-auto h-4 w-4 transition-transform', expanded && 'rotate-90')} />
                  </button>
                </div>

                {expanded ? (
                  <ul className="mt-2 space-y-2 pl-6">
                    {category.groups.map((group) => {
                      const shown = group.products.filter(matches);
                      if (term && shown.length === 0) return null;
                      const subWhole = whole || subs.has(group.slug);
                      const subPartial = !subWhole && group.products.some((p) => picked.has(p.key));
                      const subKey = `sub:${group.slug}`;
                      const subOpen = Boolean(term) || open.has(subKey);
                      return (
                        <li key={group.slug}>
                          <div className="flex items-center gap-2">
                            {group.slug === OTHER ? (
                              <span className="w-[18px]" />
                            ) : (
                              <TriState
                                checked={subWhole}
                                indeterminate={subPartial}
                                disabled={whole}
                                onChange={(on) => setSubcategory(group.products, group.slug, on)}
                                label={`All ${group.name}`}
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => toggleOpen(subKey)}
                              aria-expanded={subOpen}
                              className="flex flex-1 items-center gap-1 text-left text-sm font-medium"
                            >
                              {group.name}
                              <span className="text-xs font-normal text-muted-foreground">
                                {group.products.length}
                              </span>
                              {group.products.length > 0 ? (
                                <ChevronRight
                                  className={cn('ml-auto h-4 w-4 transition-transform', subOpen && 'rotate-90')}
                                />
                              ) : null}
                            </button>
                          </div>
                          {subOpen && shown.length > 0 ? (
                            <ul className="mt-1 grid gap-x-4 pl-6 sm:grid-cols-2">
                              {shown.map((product) => (
                                <li key={product.key}>
                                  <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-surface">
                                    <input
                                      type="checkbox"
                                      checked={subWhole || picked.has(product.key)}
                                      disabled={subWhole}
                                      onChange={(event) => toggleIn(setPicked, product.key, event.target.checked)}
                                      className="h-4 w-4 accent-[hsl(var(--accent))]"
                                    />
                                    <span>
                                      {product.title}
                                      {product.draft ? (
                                        <span className="ml-1 text-2xs uppercase text-muted-foreground">draft</span>
                                      ) : null}
                                    </span>
                                  </label>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function TriState({
  checked,
  indeterminate,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      ref={(box) => {
        if (box) box.indeterminate = indeterminate;
      }}
      onChange={(event) => onChange(event.target.checked)}
      className="h-[18px] w-[18px] shrink-0 cursor-pointer accent-[hsl(var(--accent))] disabled:cursor-default"
    />
  );
}
