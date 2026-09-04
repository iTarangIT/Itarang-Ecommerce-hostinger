'use client';

import * as React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { StateBlock } from '@/components/ui/states';

/**
 * What `/account` shows when it cannot load.
 *
 * **Why this file exists.** The page reads three things from Postgres — the
 * session, the order history and the product rail — and `loading.tsx` covers
 * all of it with a skeleton. Without a boundary *on this segment*, a failure
 * unwound past the segment to the root `app/error.tsx`, and the skeleton
 * `loading.tsx` had already streamed stayed on screen: the header rendered, the
 * placeholders sat there, and nothing ever replaced them. Verified against a
 * server pointed at an unreachable database — after the 15s connection timeout
 * the response carried the skeleton and an error *digest*, and the words
 * "Something went wrong" appeared nowhere in it.
 *
 * A segment boundary is what makes the failure land where the skeleton is.
 * Next renders the segment as `<ErrorBoundary><Suspense fallback={loading}>`,
 * so an error thrown by the page swaps the skeleton for this, in place.
 *
 * `reset()` re-runs the segment, which is the right retry for this page: every
 * dependency is a database read, and the usual reason for one to fail is
 * momentary.
 *
 * **Nothing about the failure is described to the visitor beyond the digest.**
 * `error.message` from a server component is already redacted to a generic
 * string in production, but it is not this page's job to relay it either — a
 * connection string or a query fragment is not something an account page
 * should ever be able to print.
 */
export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Wire this to the error reporter when one is configured, as `app/error.tsx`
    // does. The digest is what ties this to the line in the server log.
    console.error('[account] failed to load', error.digest ?? error);
  }, [error]);

  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className="container py-6 sm:py-8">
          <h1 className="heading-1">Your account</h1>
        </div>
      </div>

      <div className="container py-12 lg:py-16">
        <StateBlock
          tone="error"
          icon={<AlertTriangle className="h-6 w-6" />}
          title="We could not load your account just now"
          description={
            <>
              This is not something you did, and nothing about your account or your orders has
              changed. It is usually momentary — try again in a moment.
              {error.digest ? (
                <span className="tabular mt-3 block text-xs text-muted-foreground">
                  Reference: {error.digest}
                </span>
              ) : null}
            </>
          }
          actions={
            <>
              <Button onClick={reset} variant="primary">
                <RotateCcw className="h-4 w-4" />
                Try again
              </Button>
              {/* Order lookup by number and mobile does not depend on the
                  session, so it is still worth offering when this page is the
                  thing that is broken. */}
              <ButtonLink href="/track" variant="outline">
                Track an order instead
              </ButtonLink>
              <ButtonLink href="/support" variant="ghost">
                Contact support
              </ButtonLink>
            </>
          }
        />
      </div>
    </>
  );
}
