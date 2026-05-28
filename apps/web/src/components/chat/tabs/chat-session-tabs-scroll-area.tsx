'use client';

import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useAtomValue, useSetAtom, useStore } from 'jotai';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChatSummaryPublic } from '@/models/agent-llm/dto';
import { activeSessionIdAtom, chatSessionsAtom } from '@/models/chat';

import { ChatTabItem } from './chat-session-tab-item';

const TabScrollChevronButton = memo(function TabScrollChevronButton({
  direction,
  disabled,
  onPress,
  ariaLabel,
}: {
  direction: 'left' | 'right';
  disabled: boolean;
  onPress: () => void;
  ariaLabel: string;
}) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 shrink-0"
      onClick={onPress}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <Icon className="size-4" aria-hidden />
    </Button>
  );
});

const ChatTabsTabList = memo(function ChatTabsTabList({
  sessions,
  onSelectSession,
}: {
  sessions: ChatSummaryPublic[];
  onSelectSession: (id: string) => void;
}) {
  const store = useStore();

  const onTabListKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (sessions.length === 0) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const activeId = store.get(activeSessionIdAtom);
      const cur = activeId != null ? sessions.findIndex((s) => s.id === activeId) : -1;
      const i = cur >= 0 ? cur : 0;
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      const next = sessions[(i + delta + sessions.length) % sessions.length];
      if (next) onSelectSession(next.id);
    },
    [onSelectSession, sessions, store],
  );

  return (
    <div role="tablist" className="flex min-w-max items-end gap-1 pr-1 h-full" onKeyDown={onTabListKeyDown}>
      {sessions.map((s) => (
        <ChatTabItem key={s.id} id={s.id} title={s.title} messageCount={s.message_count} onSelect={onSelectSession} />
      ))}
    </div>
  );
});

export const ChatTabsScrollArea = memo(function ChatTabsScrollArea() {
  const sessions = useAtomValue(chatSessionsAtom);
  const selectSession = useSetAtom(activeSessionIdAtom);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) {
      setCanScrollLeft((p) => (p ? false : p));
      setCanScrollRight((p) => (p ? false : p));
      return;
    }
    const left = el.scrollLeft;
    const maxLeft = el.scrollWidth - el.clientWidth;
    const nextLeft = left > 0;
    const nextRight = maxLeft > 0 && left < maxLeft - 1;
    setCanScrollLeft((p) => (p === nextLeft ? p : nextLeft));
    setCanScrollRight((p) => (p === nextRight ? p : nextRight));
  }, []);

  useEffect(() => {
    queueMicrotask(() => updateScrollButtons());
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => updateScrollButtons();
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(() => updateScrollButtons());
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [sessions.length, updateScrollButtons]);

  const scrollByTabs = useCallback((dir: 'left' | 'right') => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(180, Math.floor(el.clientWidth * 0.7));
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  }, []);

  const onScrollLeft = useCallback(() => scrollByTabs('left'), [scrollByTabs]);
  const onScrollRight = useCallback(() => scrollByTabs('right'), [scrollByTabs]);

  return (
    <div className="min-w-0 flex items-stretch gap-1">
      <TabScrollChevronButton
        direction="left"
        disabled={!canScrollLeft}
        onPress={onScrollLeft}
        ariaLabel="向左滚动会话"
      />

      <div
        ref={scrollerRef}
        className={cn(
          'min-w-0 flex-1 overflow-x-auto overflow-y-hidden',
          '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
          'items-end justify-end',
        )}
      >
        <ChatTabsTabList sessions={sessions} onSelectSession={selectSession} />
      </div>

      <TabScrollChevronButton
        direction="right"
        disabled={!canScrollRight}
        onPress={onScrollRight}
        ariaLabel="向右滚动会话"
      />
    </div>
  );
});
