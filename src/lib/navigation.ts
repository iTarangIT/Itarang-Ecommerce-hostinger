import { catalog } from '@/lib/commerce';
import { CATEGORIES } from '@/lib/commerce/mock/categories';
import { displayPrice } from '@/lib/catalog/pricing';
import { allProducts } from '@/lib/catalog/collections';
import type { ProductArtKind } from '@/lib/commerce/types';

/**
 * Serialisable navigation model.
 *
 * Built on the server from the category taxonomy plus the *active provider's*
 * catalogue, so mega-menu counts and the featured product always reflect what
 * the shopper will actually find on the category page.
 *
 * Categories themselves stay local: they are editorial content, and the
 * Hostinger store reports no collections.
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
}

export interface NavCategory {
  slug: string;
  name: string;
  shortName: string;
  tagline: string;
  href: string;
  icon: ProductArtKind;
  highlights: string[];
  subcategories: NavSubcategory[];
  featured: NavFeatured | null;
  total: number;
}

export async function buildNavigation(): Promise<NavCategory[]> {
  const categories = await catalog().listCategories();
  const products = await allProducts();

  return categories.map((category) => {
    const inCategory = products.filter((p) => p.category === category.slug);

    const featuredProduct =
      inCategory.find((p) => p.badges.includes('bestseller')) ??
      [...inCategory].sort((a, b) => a.popularityRank - b.popularityRank)[0];

    const price = featuredProduct ? displayPrice(featuredProduct) : null;

    return {
      slug: category.slug,
      name: category.name,
      shortName: category.shortName,
      tagline: category.tagline,
      href: `/c/${category.slug}`,
      icon: category.icon,
      highlights: category.highlights,
      subcategories: category.subcategories.map((sub) => ({
        name: sub.name,
        href: `/c/${category.slug}/${sub.slug}`,
        description: sub.description,
        count: inCategory.filter((p) => p.subcategory === sub.slug).length,
      })),
      featured:
        featuredProduct && price
          ? {
              title: featuredProduct.title,
              subtitle: featuredProduct.subtitle,
              href: `/p/${featuredProduct.slug}`,
              image: featuredProduct.images[0] ?? '',
              price: price.selling,
              mrp: price.mrp,
            }
          : null,
      total: inCategory.length,
    };
  });
}

/** Static category list, for surfaces that need names without product counts. */
export const NAV_CATEGORIES = CATEGORIES;
