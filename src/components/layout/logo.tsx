import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SITE } from '@/lib/site';

/**
 * The official iTarang wordmark.
 *
 * The asset is the parent site's own file, copied byte for byte — the mark is a
 * layered wave (*tarang* is "wave") in a rounded square, beside the wordmark.
 * What stood here before was a hand-drawn approximation: a Lucide `Zap` bolt on
 * a tinted tile with the name set as live text. It resembled nothing on
 * itarang.com, and no real asset had ever been committed to this repository.
 *
 * Two variants ship because the wordmark is baked into the artwork rather than
 * inheriting colour: `dark` is the near-black lettering for light chrome,
 * `light` is the white lettering for the ink footer. That is exactly the
 * distinction `tone` already drew, so no caller changes.
 *
 * Rendered at a fixed height with `width: auto`, so the 995 x 251 source scales
 * by its own aspect ratio; at ~4x the displayed size it stays crisp on dense
 * screens without art direction.
 */
export function Logo({
  className,
  tone = 'default',
}: {
  className?: string;
  tone?: 'default' | 'inverse';
}) {
  const inverse = tone === 'inverse';

  return (
    <Link
      href="/"
      aria-label={`${SITE.name} — home`}
      className={cn(
        'inline-flex items-center rounded-sm transition-opacity hover:opacity-90',
        className,
      )}
    >
      <Image
        src={inverse ? '/images/logo-wordmark-light.png' : '/images/logo-wordmark-dark.png'}
        alt={SITE.name}
        width={995}
        height={251}
        // The header mark is above the fold on every route, so it is worth
        // preloading; the footer copy is not.
        priority={!inverse}
        sizes="(min-width: 640px) 160px, 132px"
        className="h-8 w-auto sm:h-9"
      />
    </Link>
  );
}
