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
 * Thumbnail rail on desktop, swipeable snap carousel on mobile, and a
 * full-screen lightbox with zoom on both.
 */
export function Gallery({
  images,
  title,
  badges = [],
}: {
  images: string[];
  title: string;
  badges?: BadgeKind[];
}) {
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

  // Keep the active dot in sync when the shopper swipes rather than taps.
  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    if (next !== index) setIndex(next);
  };

  return (
    <div className="lg:flex lg:gap-4">
      {/* Desktop thumbnail rail */}
      <div className="hidden shrink-0 lg:block">
        <ul className="flex w-20 flex-col gap-2">
          {images.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`View image ${i + 1} of ${images.length}`}
                aria-current={i === index}
                className={cn(
                  'relative block aspect-square w-full overflow-hidden rounded-md border-2 bg-surface transition-colors',
                  i === index
                    ? 'border-accent'
                    : 'border-border hover:border-primary/40',
                )}
              >
                <Image src={src} alt="" fill sizes="80px" className="object-contain p-1" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="min-w-0 flex-1">
        {/* Desktop main image */}
        <div className="relative hidden aspect-square overflow-hidden rounded-xl border border-border bg-surface lg:block">
          <Image
            src={images[index]}
            alt={`${title} — view ${index + 1}`}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 520px"
            className="object-contain p-8"
          />
          <div className="pointer-events-none absolute left-4 top-4">
            <BadgeStack badges={badges} max={3} />
          </div>
          <button
            type="button"
            onClick={() => setLightbox(true)}
            className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-card/95 px-3 py-2 text-xs font-semibold text-foreground shadow-card transition-colors hover:bg-secondary"
          >
            <Expand className="h-4 w-4" />
            Expand
          </button>
        </div>

        {/* Mobile / tablet swipe carousel */}
        <div className="relative lg:hidden">
          <div
            ref={scrollerRef}
            onScroll={onScroll}
            className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
          >
            {images.map((src, i) => (
              <div key={src} className="relative aspect-square w-full shrink-0 snap-center bg-surface">
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
                key={src}
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
              key={src}
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
