/**
 * Blog content model.
 *
 * Posts are TypeScript modules, not Markdown: the body is a list of typed
 * blocks that `components/blog/article-body.tsx` renders with ordinary JSX.
 * There is no parser and no HTML string anywhere, so an article can never
 * inject markup — and the compiler checks every block's shape.
 */

export const BLOG_CATEGORIES = ['Buying guide', 'Care & safety', 'EV', 'Home backup'] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

/**
 * A run of inline text. A plain string is the common case; the object forms
 * carry emphasis or an internal link without resorting to markup.
 */
export type Inline = string | { strong: string } | { text: string; href: string };

/** Rich text: either one plain string or a sequence of inline runs. */
export type RichText = string | Inline[];

export type Block =
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'paragraph'; text: RichText }
  | { type: 'list'; ordered?: boolean; items: RichText[] }
  | { type: 'callout'; tone: 'info' | 'tip' | 'warning'; title?: string; text: RichText }
  | { type: 'table'; caption?: string; columns: string[]; rows: string[][] };

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  /** ISO date, e.g. "2026-10-12". */
  date: string;
  /** ISO date of the last substantive edit, when different from `date`. */
  updated?: string;
  author: 'iTarang team';
  category: BlogCategory;
  readingMinutes: number;
  /** Storefront listing paths this article supports, e.g. '/batteries/ev-3-wheeler'. */
  relatedCategoryPaths: string[];
  body: Block[];
}

export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}
