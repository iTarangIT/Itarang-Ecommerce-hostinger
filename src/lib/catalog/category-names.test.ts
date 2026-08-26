import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/lib/commerce/mock/categories';
import { CATEGORY_NAMES, SUBCATEGORY_NAMES, categoryName, subcategoryName } from './category-names';

/**
 * `category-names.ts` duplicates the display names on purpose, so that the
 * client bundle does not have to carry the full taxonomy and its SEO prose.
 * Duplication only stays safe while something checks it, which is this.
 */

describe('category names stay in step with the taxonomy', () => {
  it('names every category, with the same name', () => {
    for (const category of CATEGORIES) {
      expect(CATEGORY_NAMES[category.slug], `missing name for category "${category.slug}"`).toBe(
        category.name,
      );
    }
  });

  it('names every subcategory, with the same name', () => {
    for (const category of CATEGORIES) {
      for (const sub of category.subcategories) {
        expect(SUBCATEGORY_NAMES[sub.slug], `missing name for subcategory "${sub.slug}"`).toBe(
          sub.name,
        );
      }
    }
  });

  it('carries no entries the taxonomy does not have', () => {
    const categorySlugs = CATEGORIES.map((c) => c.slug);
    const subSlugs = CATEGORIES.flatMap((c) => c.subcategories.map((s) => s.slug));

    expect(Object.keys(CATEGORY_NAMES).sort()).toEqual([...categorySlugs].sort());
    expect(Object.keys(SUBCATEGORY_NAMES).sort()).toEqual([...subSlugs].sort());
  });

  it('falls back to the slug for anything unknown', () => {
    // A product filed under a slug with no entry must still render something.
    expect(categoryName('not-a-category')).toBe('not-a-category');
    expect(subcategoryName('not-a-subcategory')).toBe('not-a-subcategory');
  });
});
