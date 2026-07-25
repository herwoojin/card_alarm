'use client';

import { createContext, useContext } from 'react';

export type TabKey = 'home' | 'cards' | 'sms' | 'opt' | 'stats';

export type SheetState =
  | { kind: 'card'; cardId?: string }
  | { kind: 'presets' }
  | { kind: 'manual'; unrecId: string }
  | { kind: 'txn'; txnId: string }
  | { kind: 'settings' };

export interface UIApi {
  tab: TabKey;
  go: (t: TabKey) => void;
  toast: (msg: string) => void;
  openSheet: (s: SheetState) => void;
  closeSheet: () => void;
}

export const UIContext = createContext<UIApi | null>(null);

export function useUI(): UIApi {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIContext.Provider');
  return ctx;
}
