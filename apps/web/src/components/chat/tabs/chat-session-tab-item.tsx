"use client";

import { memo } from "react";
import { useAtomValue } from "jotai";

import { cn } from "@/lib/utils";
import { isActiveChatSessionAtomFamily } from "@/models/chat/session.atom";

const chatSessionTabTriggerClassName = cn(
  "inline-flex max-w-64 items-center gap-2 truncate rounded-t-md border border-b-0 px-2.5 py-1 text-[0.82rem] transition-colors outline-none",
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
  "aria-selected:border-primary/70 aria-selected:bg-background aria-selected:text-foreground aria-selected:shadow-sm",
  "data-selected:border-primary/70 data-selected:bg-background data-selected:text-foreground data-selected:shadow-sm",
);

export const ChatSessionTabItem = memo(function ChatSessionTabItem({
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
  const isSelected = useAtomValue(isActiveChatSessionAtomFamily(id));

  return (
    <button
      type="button"
      role="tab"
      tabIndex={isSelected ? 0 : -1}
      aria-selected={isSelected}
      disabled={disabled}
      data-selected={isSelected ? "" : undefined}
      className={chatSessionTabTriggerClassName}
      onClick={() => onSelect(id)}
    >
      <span className="truncate">{title}</span>
      {messageCount > 0 ? (
        <span className="text-xs opacity-70">{messageCount}</span>
      ) : null}
    </button>
  );
});
