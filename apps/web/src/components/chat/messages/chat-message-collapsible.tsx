"use client";

import { memo } from "react";

import { ChatMessageAssistantContent } from "./chat-message-assistant-content";
import { ChatMessageUserContent } from "./chat-message-user-content";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";


/**
 * 无 props：折叠动画时 Trigger 会频繁 render，memo 可跳过 SVG reconciler。
 */
const CollapsibleChevronIcon = memo(function CollapsibleChevronIcon() {
  return (
    <svg
      className="size-4 shrink-0 text-muted-foreground transition-transform duration-100 ease-out"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
});

/**
 * 仅依赖 userText；open 状态变化时 Trigger 仍 render，但用户气泡子树可跳过。
 */
const ChatMessageCollapsibleTriggerBody = memo(
  function ChatMessageCollapsibleTriggerBody({ userText }: { userText: string }) {
    return (
      <>
        <span className="inline-flex shrink-0 pt-2">
          <CollapsibleChevronIcon />
        </span>
        <ChatMessageUserContent text={userText} />
      </>
    );
  },
);

export const ChatMessageCollapsible = memo(function ChatMessageCollapsible({
  open,
  onOpenChange,
  userText,
  mid,
  isLastSegment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userText: string;
  mid: string;
  isLastSegment: boolean;
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="w-full min-w-0 contain-[layout]"
    >
      <CollapsibleTrigger className="sticky top-0 flex w-full min-w-0 items-start gap-2 bg-background pb-2 text-left outline-none group/trigger rounded-lg\
  focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background \
  [&[data-panel-open]_svg]:rotate-90">
        <ChatMessageCollapsibleTriggerBody userText={userText} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="border-border/40 border-l py-2 pl-7 pr-2 text-sm leading-relaxed text-foreground">
          <ChatMessageAssistantContent mid={mid} isLastSegment={isLastSegment} />
        </div>
      </CollapsibleContent>
    </Collapsible >
  );
});
