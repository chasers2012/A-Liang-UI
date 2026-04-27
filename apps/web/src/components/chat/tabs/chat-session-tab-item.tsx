'use client';

import { memo } from 'react';
import { useAtomValue } from 'jotai';

import { cn } from '@/lib/utils';
import { isActiveChatAtomFamily } from '@/models/chat';

export const ChatTabItem = memo(function ChatTabItem({
  id,
  title,
  messageCount,
  disabled,
  onSelect,
}: {
  id: string;
  title: string;
  messageCount: number;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const isSelected = useAtomValue(isActiveChatAtomFamily(id));
  return (
    <button
      type="button"
      role="tab"
      tabIndex={isSelected ? 0 : -1}
      aria-selected={isSelected}
      disabled={disabled}
      className={cn(
        'hover:text-foreground inline-flex max-w-64 items-center gap-2 truncate rounded-t-md border border-b-0 px-2.5 py-1 text-[0.82rem] outline-none',
        {
          'border-primary/70 bg-background text-foreground shadow-sm': isSelected,
          'border-border/60 bg-muted/20 text-muted-foreground ': !isSelected,
        },
      )}
      onClick={() => onSelect(id)}
    >
      <span className="truncate">{title}</span>
      {messageCount > 0 ? <span className="text-xs opacity-70">{messageCount}</span> : null}
    </button>
  );
});
