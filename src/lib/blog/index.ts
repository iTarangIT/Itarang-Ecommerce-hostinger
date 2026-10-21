import { categoryName, subcategoryName } from '@/lib/catalog/category-names';
import { chargingLithiumSafely } from './posts/charging-lithium-safely';
import { chooseERickshawBattery } from './posts/choose-e-rickshaw-battery';
import { sizeHomeInverterBattery } from './posts/size-home-inverter-battery';
import { twoWheelerEvBattery } from './posts/two-wheeler-ev-battery';
import { whatABmsDoes } from './posts/what-a-bms-does';
import {
  BLOG_CATEGORIES,
  type Block,
  type BlogCategory,
  type BlogPost,
  type RichText,
  type TocEntry,
} from './types';

export * from './types';

/** Every published post, newest first. */
export const ALL_POSTS: BlogPost[] = [
  chooseERickshawBattery,
  twoWheelerEvBattery,
  sizeHomeInverterBattery,
  chargingLithiumSafely,
  whatABmsDoes,
].sort((a, b) => b.date.localeCompare(a.date));

const POST_BY_SLUG = new Map(ALL_POSTS.map((post) => [post.slug, post]));

export function getPost(slug: string): BlogPost | undefined {
  return POST_BY_SLUG.get(slug);
}

export const BLOG_PATH = '/blog';

export function postPath(slug: string): string {
  return `${BLOG_PATH}/${slug}`;
}

/* ------------------------------------------------------------- categories */

/** URL-safe form of a category, used as the `?category=` value. */
export function categoryParam(category: BlogCategory): string {
  return slugify(category);
}

export function categoryFromParam(param: string | undefined): BlogCategory | undefined {
  if (!param) return undefined;
  return BLOG_CATEGORIES.find((category) => categoryParam(category) === param);
}

export function postsInCategory(category: BlogCategory | undefined): BlogPost[] {
  return category ? ALL_POSTS.filter((post) => post.category === category) : ALL_POSTS;
}

/* ------------------------------------------------ storefront cross-links */

function normalisePath(path: string): string {
  const trimmed = path.trim().replace(/\/+$/, '');
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/**
 * Posts that support a storefront listing, newest first.
 *
 * Matches in both directions along the path: a subcategory page
 * (`/batteries/ev-3-wheeler`) gets posts tagged with it, and a category page
 * (`/batteries`) gets every post tagged with any of its subcategories. A post
 * tagged with a whole category (`/chargers`) also shows on that category's
 * subcategory pages (`/chargers/ev-chargers`).
 */
export function postsForCategoryPath(path: string, limit?: number): BlogPost[] {
  const target = normalisePath(path);
  const matches = ALL_POSTS.filter((post) =>
    post.relatedCategoryPaths.some((raw) => {
      const related = normalisePath(raw);
      return (
        related === target ||
        target.startsWith(`${related}/`) ||
        related.startsWith(`${target}/`)
      );
    }),
  );
  return limit === undefined ? matches : matches.slice(0, limit);
}

/** A readable name for a storefront listing path, from the catalogue names. */
export function categoryPathLabel(path: string): string {
  const [category, subcategory] = normalisePath(path).split('/').filter(Boolean);
  if (subcategory) return subcategoryName(subcategory);
  return categoryName(category ?? '');
}

/**
 * Other posts to read next: those sharing a storefront path or category
 * first, then the rest, newest first within each group.
 */
export function relatedPosts(post: BlogPost, limit = 3): BlogPost[] {
  const score = (candidate: BlogPost) =>
    (candidate.category === post.category ? 1 : 0) +
    candidate.relatedCategoryPaths.filter((path) => post.relatedCategoryPaths.includes(path))
      .length;
  return ALL_POSTS.filter((candidate) => candidate.slug !== post.slug)
    .map((candidate, index) => ({ candidate, index, score: score(candidate) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

/* ------------------------------------------------------ headings and TOC */

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Stable, unique ids for every heading block, keyed by block index.
 *
 * Shared by the table of contents and the article renderer so a contents link
 * and its target can never disagree.
 */
export function headingIds(body: Block[]): Map<number, string> {
  const ids = new Map<number, string>();
  const seen = new Map<string, number>();
  body.forEach((block, index) => {
    if (block.type !== 'heading') return;
    const base = slugify(block.text) || 'section';
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    ids.set(index, count === 0 ? base : `${base}-${count + 1}`);
  });
  return ids;
}

export function tableOfContents(body: Block[]): TocEntry[] {
  const ids = headingIds(body);
  return body.flatMap((block, index) =>
    block.type === 'heading' ? [{ id: ids.get(index)!, text: block.text, level: block.level }] : [],
  );
}

/** Plain text of a rich-text value, for metadata and structured data. */
export function plainText(text: RichText): string {
  if (typeof text === 'string') return text;
  return text
    .map((run) => (typeof run === 'string' ? run : 'strong' in run ? run.strong : run.text))
    .join('');
}

/** Approximate word count of a post body. */
export function wordCount(post: BlogPost): number {
  const parts = post.body.flatMap((block): string[] => {
    switch (block.type) {
      case 'heading':
        return [block.text];
      case 'paragraph':
        return [plainText(block.text)];
      case 'list':
        return block.items.map(plainText);
      case 'callout':
        return [block.title ?? '', plainText(block.text)];
      case 'table':
        return [block.caption ?? '', ...block.columns, ...block.rows.flat()];
    }
  });
  return parts.join(' ').split(/\s+/).filter(Boolean).length;
}

export function formatPostDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));
}
