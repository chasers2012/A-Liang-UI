'use client';

import type { Atom } from 'jotai';
import { useStore } from 'jotai';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { shouldConfirmNavigationAway } from '@/lib/navigation-edit-path';

type GuardSlot = {
  id: symbol;
  isEditing: () => boolean;
  onAbandon: () => void;
};

export type NavigationEditGuardContextValue = {
  tryDeferNavigation: (targetHref: string, currentPathname: string) => boolean;
  pendingHref: string | null;
  setPendingHref: (href: string | null) => void;
  getActiveAbandon: () => (() => void) | null;
  assignGuard: (slot: GuardSlot) => void;
  releaseGuard: (id: symbol) => void;
};

const NavigationEditGuardContext = createContext<NavigationEditGuardContextValue | null>(null);

export function NavigationEditGuardProvider({ children }: { children: ReactNode }) {
  const slotRef = useRef<GuardSlot | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const tryDeferNavigation = useCallback((targetHref: string, currentPathname: string) => {
    if (!shouldConfirmNavigationAway(currentPathname, targetHref)) return false;
    if (!slotRef.current?.isEditing()) return false;
    setPendingHref(targetHref);
    return true;
  }, []);

  const assignGuard = useCallback((slot: GuardSlot) => {
    slotRef.current = slot;
  }, []);

  const releaseGuard = useCallback((id: symbol) => {
    if (slotRef.current?.id === id) slotRef.current = null;
  }, []);

  const getActiveAbandon = useCallback(() => slotRef.current?.onAbandon ?? null, []);

  const value = useMemo(
    () => ({
      tryDeferNavigation,
      pendingHref,
      setPendingHref,
      getActiveAbandon,
      assignGuard,
      releaseGuard,
    }),
    [tryDeferNavigation, pendingHref, getActiveAbandon, assignGuard, releaseGuard],
  );

  return <NavigationEditGuardContext.Provider value={value}>{children}</NavigationEditGuardContext.Provider>;
}

/**
 * 在挂载页面调用：传入当前页的「是否编辑中」atom 与放弃编辑回调（与页内「取消」一致）。
 * 离开本页（侧栏/面包屑等站内跳转）且编辑为 true 时会弹出确认框。
 */
export function useNavigationEditGuard(editingAtom: Atom<boolean>, options: { onAbandon: () => void }) {
  const ctx = useContext(NavigationEditGuardContext);
  if (!ctx) {
    throw new Error('useNavigationEditGuard 必须在 NavigationEditGuardProvider 内使用');
  }
  const { assignGuard, releaseGuard } = ctx;
  const store = useStore();
  const idRef = useRef(Symbol('navigation-edit-guard'));
  const onAbandonRef = useRef(options.onAbandon);
  onAbandonRef.current = options.onAbandon;

  useEffect(() => {
    const id = idRef.current;
    assignGuard({
      id,
      isEditing: () => !!store.get(editingAtom),
      onAbandon: () => onAbandonRef.current(),
    });
    return () => releaseGuard(id);
  }, [assignGuard, releaseGuard, store, editingAtom]);
}

export function useNavigationEditGuardShell(): NavigationEditGuardContextValue | null {
  return useContext(NavigationEditGuardContext);
}
