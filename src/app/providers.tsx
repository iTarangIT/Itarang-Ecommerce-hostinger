'use client';

import * as React from 'react';
import { StoreProvider } from '@/lib/store/store-provider';
import { UIProvider } from '@/lib/store/ui-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <UIProvider>
      <StoreProvider>{children}</StoreProvider>
    </UIProvider>
  );
}
