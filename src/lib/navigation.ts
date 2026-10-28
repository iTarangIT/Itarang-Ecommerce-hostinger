import { cache } from 'react';
import { catalog } from '@/lib/commerce';
import { CATEGORIES } from '@/lib/commerce/mock/categories';
import { displayPrice } from '@/lib/catalog/pricing';
import { allProducts } from '@/lib/catalog/collections';
import type { CategoryIconKind } from '@/lib/commerce/types';
import { categoryPath, productPath, subcategoryPath } from '@/lib/routes';

/**
 * Serialisable navigation model.
 *
 * Built on the server from the category taxonomy plus the *active provider's*
 * catalogue, so mega-menu counts and the featured product always reflect what
 * the shopper will actually find on the category page.
 *
 * Categories come from the active provider — the database provider reads
 * `catalog_categories`, which the business edits at /admin/categories.
 */
export interface NavFeatured {
  title: string;
  subtitle: string;
  href: string;
  image: string;
  price: number;
  mrp: number;
}

export interface NavSubcategory {
  name: string;
  href: string;
  description: string;
  count: number;
  /** The most popular product's image, for the home page tiles (R-09). */
  image?: string;
}

export interface NavCategory {
  slug: string;
  name: string;
  shortName: string;
  tagline: string;
  href: string;
  icon: CategoryIconKind;
  highlights: string[];
  subcategories: NavSubcategory[];
  featured: NavFeatured | null;
  total: number;
}

/**
 * Memoised per request, and for a sharper reason than `allProducts`: this runs
 * in the root layout, so it is on the critical path of *every* route — and the
 * homepage called it a second time for its own category strip, doubling the
 * work on the most-visited page in the app.
 *
 * The two reads are independent, so they run together rather than in series.
 */
export const buildNavigation = cache(async (): Promise<NavCategory[]> => {
  const [categories, products] = await Promise.all([
    catalog().listCategories(),
    allProducts(),
  ]);

  const nav = categories.map((category) => {
    const inCategory = products.filter((p) => p.category === category.slug);

    /**
     * Subcategories a shopper can actually browse.
     *
     * A section with a count of zero is a dead end: the panel offers it, the
     * page loads, and there is nothing on it. That was the whole complaint
     * against UPS and Combos, and removing those two from the taxonomy fixes it
     * only for as long as nobody adds a third — `home-inverter` is already
     * defined and empty, deliberately, so it would be the third today.
     *
     * Hiding by count rather than by a flag means this is self-correcting in
     * both directions: the section appears on its own the day its first product
     * is published, and disappears again if the last one is withdrawn. Nothing
     * is deleted — the URL, the heading and the SEO copy all still work for
     * anyone who has the link.
     */
    const stocked = category.subcategories.filter((sub) =>
      inCategory.some((p) => p.subcategory === sub.slug),
    );

    const featuredProduct =
      inCategory.find((p) => p.badges.includes('bestseller')) ??
      [...inCategory].sort((a, b) => a.popularityRank - b.popularityRank)[0];

    const price = featuredProduct ? displayPrice(featuredProduct) : null;

    return {
      slug: category.slug,
      name: category.name,
      shortName: category.shortName,
      tagline: category.tagline,
      href: categoryPath(category.slug),
      icon: category.icon,
      highlights: category.highlights,
      subcategories: stocked.map((sub) => {
        const inSub = inCategory.filter((p) => p.subcategory === sub.slug);
        const lead = [...inSub].sort((a, b) => a.popularityRank - b.popularityRank)[0];
        return {
          name: sub.name,
          href: subcategoryPath(category.slug, sub.slug),
          description: sub.description,
          count: inSub.length,
          ...(lead?.images[0] ? { image: lead.images[0] } : {}),
        };
      }),
      featured:
        featuredProduct && price
          ? {
              title: featuredProduct.title,
              subtitle: featuredProduct.subtitle,
              href: productPath(featuredProduct.slug),
              image: featuredProduct.images[0] ?? '',
              price: price.selling,
              mrp: price.mrp,
            }
          : null,
      total: inCategory.length,
    };
  });

  // A category with nothing published is left out of the menu for the same
  // reason as an empty subcategory: a section added in the admin panel shows
  // up on its own once its first product is published.
  return nav.filter((category) => category.total > 0);
});

/** Static category list, for surfaces that need names without product counts. */
export const NAV_CATEGORIES = CATEGORIES;

