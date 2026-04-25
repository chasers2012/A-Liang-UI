'use client';

import { memo, useCallback, type ReactNode } from 'react';
import { useAtomValue, useStore } from 'jotai';

import { Button } from '@/components/ui/button';
import { activeSessionIdAtom, chatSessionSummaryAtomFamily, hasValidActiveChatAtom } from '@/models/chat/session';

/** 对当前激活会话做 store 快照后回调；不因切换 tab 而重绘（仅订阅是否存在有效激活会话） */
export const ActiveSessionSnapshotTrigger = memo(function ActiveSessionSnapshotTrigger({
  disabled,
  onRequestOpen,
  ariaLabel,
  children,
}: {
  disabled: boolean;
  onRequestOpen: (sessionId: string, title: string) => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  const store = useStore();
  const canAct = useAtomValue(hasValidActiveChatAtom);

  const onClick = useCallback(() => {
    const id = store.get(activeSessionIdAtom);
    if (!id) return;
    const a = store.get(chatSessionSummaryAtomFamily(id));
    if (!a) return;
    onRequestOpen(a.id, a.title);
  }, [store, onRequestOpen]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8"
      onClick={onClick}
      disabled={disabled || !canAct}
      aria-label={ariaLabel}
    >
      {children}
    </Button>
  );
});
