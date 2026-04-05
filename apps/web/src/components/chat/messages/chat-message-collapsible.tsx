"use client";

import { Activity, memo } from "react";

import { ChatMessageAssistantContent } from "./chat-message-assistant-content";
import { ChatMessageUserContent } from "./chat-message-user-content";

import { segmentOpenAtomFamily, userMessageTextAtomFamily } from "@/models/chat/session.atom";
import { useAtom, useAtomValue } from "jotai";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";




export const ChatMessageCollapsible = memo(function ChatMessageCollapsible({
  mid,
  isLastSegment,
}: {
  mid: string;
  isLastSegment: boolean;
}) {
  const [isOpen, setOpen] = useAtom(segmentOpenAtomFamily(mid));
  const messageText = useAtomValue(userMessageTextAtomFamily(mid));

  return (
    <div
      className="w-full min-w-0 contain-[layout]" id={mid}
    >
      <div className="mb-3 z-10 sticky top-3 flex w-full min-w-0 items-start gap-2 bg-background text-left outline-none group/trigger rounded-lg\
        focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background \
        " onClick={() => setOpen(!isOpen)}>
        <span className={cn("inline-flex shrink-0 pt-3", { "[&_svg]:rotate-90": isOpen })}>
          <ChevronRight className="size-4" aria-hidden />
        </span>
        <ChatMessageUserContent text={messageText} />
      </div>
      <Activity mode={isOpen ? "visible" : "hidden"}>
        <div className="ml-2 mt-2 border-border/40 border-l py-2 pl-6 pr-2 text-sm leading-relaxed text-foreground">
          <ChatMessageAssistantContent mid={mid} isLastSegment={isLastSegment} />
        </div>
      </Activity>
    </div >
  );
});
