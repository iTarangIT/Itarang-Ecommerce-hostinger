import { NextResponse } from 'next/server';
import { productsByIds, productsBySlugs } from '@/lib/catalog/collections';

/**
 * Card summaries by slug or id.
 *
 * Used by client surfaces that hold references rather than data — recently
 * viewed (slugs, from local storage) and the wishlist (ids).
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const parse = (value: string | null) =>
    (value ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 24);

  const slugs = parse(params.get('slugs'));
  const ids = parse(params.get('ids'));

  const products = slugs.length > 0 ? await productsBySlugs(slugs) : await productsByIds(ids);

  return NextResponse.json({ products });
}
