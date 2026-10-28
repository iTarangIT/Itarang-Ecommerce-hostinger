'use client';

import * as React from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Expand } from 'lucide-react';
import { Modal } from '@/components/ui/overlay';
import { BadgeStack } from '@/components/ui/badge';
import type { BadgeKind } from '@/lib/commerce/types';
import { cn } from '@/lib/utils';

/**
 * Product gallery.
 *
 * Photos only (R-07): the first one large, as the hero, with the rest as a
 * thumbnail row beneath it. Spec-sheet posters (`Product.specImages`) are left
 * out — the page offers them under "Download spec sheet" — and Key Highlights
 * sit beside the gallery in the buy column instead of taking a tile here.
 * Mobile keeps the swipeable snap carousel, and both open the same lightbox.
 */
export function Gallery({
  images: allImages,
  specImages = [],
  title,
  badges = [],
}: {
  images: string[];
  /** Posters to keep out of the gallery. */
  specImages?: string[];
  title: string;
  badges?: BadgeKind[];
}) {
  const posters = new Set(specImages);
  const photos = allImages.filter((src) => !posters.has(src));
  // A product whose only images are posters still shows them rather than nothing.
  const images = photos.length > 0 ? photos : allImages;

  const [index, setIndex] = React.useState(0);
  const [lightbox, setLightbox] = React.useState(false);
  const [zoomed, setZoomed] = React.useState(false);
  const scrollerRef = React.useRef<HTMLDivElement>(null);

  const go = React.useCallback(
    (next: number) => {
      const bounded = (next + images.length) % images.length;
      setIndex(bounded);
      const el = scrollerRef.current;
      if (el) el.scrollTo({ left: bounded * el.clientWidth, behavior: 'smooth' });
    },
    [images.length],
  );

  // A product with no imagery at all would otherwise index into `undefined`
  // here and in the lightbox.
  if (images.length === 0) return null;

  // Keep the active dot in sync when the shopper swipes rather than taps.
  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    if (next !== index) setIndex(next);
  };

  const hero = images[index] ?? images[0]!;

  return (
    <div>
      <div className="min-w-0 flex-1">
        {/* Desktop — the selected photo large, the others as thumbnails. */}
        <div className="hidden lg:block">
          <button
            type="button"
            onClick={() => setLightbox(true)}
            aria-label={`Expand image ${index + 1} of ${images.length}`}
            className="group relative block aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-primary/40"
          >
            <Image
              src={hero}
              alt={`${title} — view ${index + 1}`}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 680px"
              className="object-contain p-8"
            />
            <span className="pointer-events-none absolute left-3 top-3">
              <BadgeStack badges={badges} max={3} />
            </span>
            <span className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full border border-border bg-card/95 text-foreground opacity-0 shadow-card transition-opacity group-hover:opacity-100">
              <Expand className="h-4 w-4" />
            </span>
          </button>
          {images.length > 1 ? (
            <div className="mt-3 grid grid-cols-5 gap-3">
              {images.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Show image ${i + 1}`}
                  aria-current={i === index}
                  className={cn(
                    'relative aspect-square overflow-hidden rounded-lg border-2 bg-surface',
                    i === index ? 'border-accent' : 'border-border hover:border-primary/40',
                  )}
                >
                  <Image src={src} alt="" fill sizes="120px" className="object-contain p-2" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Mobile / tablet swipe carousel */}
        <div className="relative lg:hidden">
          <div
            ref={scrollerRef}
            onScroll={onScroll}
            className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
          >
            {images.map((src, i) => (
              <div
                key={`${src}-${i}`}
                className="relative aspect-[4/5] w-full shrink-0 snap-center bg-surface"
              >
                <Image
                  src={src}
                  alt={`${title} — view ${i + 1}`}
                  fill
                  priority={i === 0}
                  sizes="100vw"
                  className="object-contain p-6"
                />
              </div>
            ))}
          </div>

          <div className="pointer-events-none absolute left-3 top-3">
            <BadgeStack badges={badges} max={3} />
          </div>

          <button
            type="button"
            onClick={() => setLightbox(true)}
            aria-label="Expand image"
            className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border border-border bg-card/95 text-foreground shadow-card"
          >
            <Expand className="h-4 w-4" />
          </button>

          <div className="mt-3 flex items-center justify-center gap-1.5">
            {images.map((src, i) => (
              <button
                key={`${src}-${i}`}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to image ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === index ? 'w-6 bg-accent' : 'w-1.5 bg-border',
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <Modal
        open={lightbox}
        onClose={() => {
          setLightbox(false);
          setZoomed(false);
        }}
        label={`${title} images`}
        className="max-w-5xl"
      >
        <div className="relative aspect-square w-full overflow-auto bg-surface sm:aspect-[4/3]">
          <button
            type="button"
            onClick={() => setZoomed((z) => !z)}
            aria-label={zoomed ? 'Zoom out' : 'Zoom in'}
            className={cn(
              'relative block h-full w-full',
              zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in',
            )}
          >
            <Image
              src={images[index]}
              alt={`${title} — view ${index + 1}`}
              fill
              sizes="90vw"
              className={cn(
                'object-contain p-6 transition-transform duration-300',
                zoomed && 'scale-[1.8]',
              )}
            />
          </button>

          {images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-card/95 text-foreground shadow-card"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => go(index + 1)}
                aria-label="Next image"
                className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-card/95 text-foreground shadow-card"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}
        </div>

        <div className="flex items-center justify-center gap-2 border-t border-border bg-card p-3">
          {images.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`View image ${i + 1}`}
              className={cn(
                'relative h-14 w-14 overflow-hidden rounded-md border-2 bg-surface',
                i === index ? 'border-accent' : 'border-border',
              )}
            >
              <Image src={src} alt="" fill sizes="56px" className="object-contain p-1" />
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
