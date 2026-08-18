'use client';

import * as React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { SITE } from '@/lib/site';
import { Button, ButtonLink } from '@/components/ui/button';
import { StateBlock } from '@/components/ui/states';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Wire this to the error reporter when one is configured.
    console.error(error);
  }, [error]);

  return (
    <div className="container py-16 lg:py-24">
      <StateBlock
        tone="error"
        icon={<AlertTriangle className="h-6 w-6" />}
        title="Something went wrong at our end"
        description={
          <>
            This is not something you did. Try again — if it keeps happening, tell us and we will
            look into it.
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
            <ButtonLink href="/" variant="outline">
              Go to the homepage
            </ButtonLink>
            <ButtonLink href={`mailto:${SITE.email}`} variant="ghost">
              Report this
            </ButtonLink>
          </>
        }
      />
    </div>
  );
}
