"use client";

import { Activity, memo } from "react";

import { ChatMessageAssistantContent } from "./chat-message-assistant-content";
import { ChatMessageUserContent } from "./chat-message-user-content";

import { segmentOpenAtomFamily, toggleSegmentOpenAtomFamily, userMessageTextAtomFamily } from "@/models/chat/session.atom";
import { useAtomValue, useSetAtom } from "jotai";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";



/**
 * 仅依赖 userText；open 状态变化时 Trigger 仍 render，但用户气泡子树可跳过。
 */
const ChatMessageCollapsibleTriggerBody = memo(
  function ChatMessageCollapsibleTriggerBody({ userText }: { userText: string }) {
    return (
      <ChatMessageUserContent text={userText} />
    );
  },
);




export const ChatMessageCollapsible = memo(function ChatMessageCollapsible({
  mid,
  isLastSegment,
}: {
  mid: string;
  isLastSegment: boolean;
}) {
  const isOpen = useAtomValue(segmentOpenAtomFamily(mid));
  const toggleOpen = useSetAtom(toggleSegmentOpenAtomFamily(mid));
  const messageText = useAtomValue(userMessageTextAtomFamily(mid));

  return (
    <div
      className="w-full min-w-0 contain-[layout]"
    >
      <div className="sticky top-0 flex w-full min-w-0 items-start gap-2 bg-background pb-2 text-left outline-none group/trigger rounded-lg\
        focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background \
        " onClick={toggleOpen}>
        <span className={cn("inline-flex shrink-0 pt-2", { "[&_svg]:rotate-90": isOpen })}>
          <ChevronRight className="size-4" aria-hidden />
        </span>
        <ChatMessageCollapsibleTriggerBody userText={messageText} />
      </div>
      <Activity mode={isOpen ? "visible" : "hidden"}>
        <div className="mt-2 border-border/40 border-l py-2 pl-7 pr-2 text-sm leading-relaxed text-foreground">
          <ChatMessageAssistantContent mid={mid} isLastSegment={isLastSegment} />
        </div>

      </Activity>
    </div >
  );
});
