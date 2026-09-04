import { NextResponse } from 'next/server';
import { productsByIds, productsBySlugs } from '@/lib/catalog/collections';
import { MAX_WISHLIST } from '@/lib/store/types';

/**
 * Card summaries by slug or id.
 *
 * Used by client surfaces that hold references rather than data — recently
 * viewed (slugs, from local storage) and the wishlist (ids, from local storage
 * or the account).
 *
 * **The cap used to be 24, and that was a bug rather than a policy.** A
 * wishlist is not capped at 24, so a customer with more saw the extra ones
 * silently vanish from the grid while the header badge still counted them —
 * the two disagreed and nothing said why. It is now the same bound the wishlist
 * itself uses, so the list a customer can build is the list this can resolve.
 *
 * `MAX_SLUGS` stays small because `productsBySlugs` fetches one product per
 * slug in parallel, and its only caller is recently-viewed, which holds eight.
 */
const MAX_SLUGS = 24;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  // `searchParams.get` has already percent-decoded the value, so ids arrive
  // exactly as they were encoded by the caller.
  const parse = (value: string | null, limit: number) =>
    (value ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, limit);

  const slugs = parse(params.get('slugs'), MAX_SLUGS);
  const ids = parse(params.get('ids'), MAX_WISHLIST);

  const products = slugs.length > 0 ? await productsBySlugs(slugs) : await productsByIds(ids);

  return NextResponse.json({ products });
}
