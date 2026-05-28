'use client';

import { memo } from 'react';
import { useAtomValue } from 'jotai';
import { LoaderCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { isActiveChatAtomFamily, isSessionGeneratingAtomFamily } from '@/models/chat';

export const ChatTabItem = memo(function ChatTabItem({
  id,
  title,
  messageCount,
  onSelect,
}: {
  id: string;
  title: string;
  messageCount: number;
  onSelect: (id: string) => void;
}) {
  const isSelected = useAtomValue(isActiveChatAtomFamily(id));
  const loading = useAtomValue(isSessionGeneratingAtomFamily(id));
  return (
    <button
      type="button"
      role="tab"
      tabIndex={isSelected ? 0 : -1}
      aria-selected={isSelected}
      className={cn(
        'hover:text-foreground inline-flex max-w-64 items-center gap-2 truncate rounded-t-md border border-b-0 px-2.5 py-1 text-[0.82rem] outline-none',
        {
          'border-primary/70 bg-background text-foreground shadow-sm': isSelected,
          'border-border/60 bg-muted/20 text-muted-foreground ': !isSelected,
        },
      )}
      onClick={() => onSelect(id)}
    >
      {loading ? <LoaderCircle className="size-3.5 animate-spin opacity-75 shrink-0" aria-hidden /> : null}
      <span className="truncate">{title}</span>
      {messageCount > 0 ? <span className="text-xs opacity-70">{messageCount}</span> : null}
    </button>
  );
});
