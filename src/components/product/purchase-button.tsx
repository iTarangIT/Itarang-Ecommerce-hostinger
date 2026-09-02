'use client';

import * as React from 'react';
import { PURCHASE_DISABLED_NOTE, PURCHASE_ENABLED } from '@/lib/commerce/purchase';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Add to cart / Buy now, disabled while purchase is switched off.
 *
 * Every purchase control on the site goes through this component so the gate
 * has one implementation rather than seven. Two details are why it exists at
 * all rather than each call site passing `disabled`:
 *
 *   The button keeps `disabled:pointer-events-none` from the shared button
 *   base, so a `title` on the button itself never fires a tooltip. The reason
 *   has to live on a wrapper that still receives hover.
 *
 *   A disabled control needs its reason announced, not merely implied by
 *   opacity. Unless the caller renders a visible note and passes its id as
 *   `describedBy`, this mints a screen-reader-only one per instance — ids have
 *   to be unique, and a grid renders twenty of these at once.
 *
 * The wrapper renders identically whether or not purchase is enabled, so
 * flipping `PURCHASE_ENABLED` back to `true` shifts nothing on the page.
 */
export function PurchaseButton({
  wrapperClassName,
  describedBy,
  disabled,
  fullWidth,
  children,
  ...props
}: ButtonProps & {
  /** Layout classes for the wrapper, e.g. `sm:flex-1` inside a button row. */
  wrapperClassName?: string;
  /** Id of a visible note the caller already renders; suppresses the hidden one. */
  describedBy?: string;
}) {
  const generatedId = React.useId();
  const blocked = !PURCHASE_ENABLED;
  const noteId = describedBy ?? generatedId;

  return (
    <span
      className={cn('block', fullWidth && 'w-full', wrapperClassName)}
      title={blocked ? PURCHASE_DISABLED_NOTE : undefined}
    >
      <Button
        {...props}
        fullWidth={fullWidth}
        disabled={blocked || disabled}
        aria-describedby={blocked ? noteId : undefined}
      >
        {children}
      </Button>
      {blocked && !describedBy ? (
        <span id={generatedId} className="sr-only">
          {PURCHASE_DISABLED_NOTE}
        </span>
      ) : null}
    </span>
  );
}
