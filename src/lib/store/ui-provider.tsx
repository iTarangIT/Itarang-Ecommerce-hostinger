'use client';

import * as React from 'react';

export type OverlayId = 'cart' | 'search' | 'nav' | null;

export interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: 'success' | 'error' | 'info';
  action?: { label: string; onClick: () => void };
}

interface UIContextValue {
  overlay: OverlayId;
  open: (id: Exclude<OverlayId, null>) => void;
  close: () => void;
  toasts: Toast[];
  toast: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

const UIContext = React.createContext<UIContextValue | null>(null);

let toastId = 0;

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [overlay, setOverlay] = React.useState<OverlayId>(null);
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (t: Omit<Toast, 'id'>) => {
      toastId += 1;
      const id = toastId;
      setToasts((current) => [...current.slice(-2), { ...t, id }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const value = React.useMemo<UIContextValue>(
    () => ({
      overlay,
      open: (id) => setOverlay(id),
      close: () => setOverlay(null),
      toasts,
      toast,
      dismiss,
    }),
    [overlay, toasts, toast, dismiss],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const ctx = React.useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used inside <UIProvider>');
  return ctx;
}
