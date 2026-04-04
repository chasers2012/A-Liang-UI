"use client";

import { ChevronRight } from "lucide-react";

import { ChatAssistantBody } from "@/components/chat/chat-assistant-body";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  activeUserMessageIdsAtom,
  messageAtomFamily,
  messageReplieIdAtomFamily,
  segmentOpenAtomFamily,
} from "@/models/chat/session.atom";
import type { AssistantBlock } from "@/models/chat/types";
import { useAtom, useAtomValue } from "jotai";
import { memo } from "react";

function getTextContent(blocks: AssistantBlock[] | undefined): string {
  if (!blocks?.length) return "";
  return blocks
    .filter((b): b is { kind: "text"; content: string } => b.kind === "text")
    .map((b) => b.content)
    .join("");
}

const ChatMessageItem = memo(function ChatMessageItem({ mid, isLastSegment }: { mid: string; isLastSegment: boolean }) {
  const user = useAtomValue(messageAtomFamily(mid));
  const replyId = useAtomValue(messageReplieIdAtomFamily(mid));

  const [isOpen, setIsOpen] = useAtom(segmentOpenAtomFamily(mid));
  if (!user) return null;

  return <Collapsible
    open={isOpen}
    onOpenChange={setIsOpen}
    className="w-full min-w-0"
  >
    <CollapsibleTrigger
      className={cn(
        "sticky top-0 flex w-full min-w-0 items-start gap-2 bg-background pb-2 text-left outline-none",
        "group/trigger rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "[&[data-panel-open]_svg]:rotate-90",
      )}
    >
      <span className="inline-flex shrink-0 pt-2">
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200"
          aria-hidden
        />
      </span>
      <div
        className={cn(
          "flex min-w-0 flex-1 overflow-hidden rounded-lg border border-border/70 bg-muted/50 text-sm leading-relaxed text-foreground transition-colors",
          "group-hover/trigger:bg-muted/70",
        )}
      >
        <span className="w-1 shrink-0 bg-primary" aria-hidden />
        <div className="min-w-0 flex-1 px-3 py-2">
          <span className="sr-only">你：</span>
          <p className="whitespace-pre-wrap wrap-break-word">{getTextContent(user.blocks)}</p>
        </div>
      </div>
    </CollapsibleTrigger>
    <CollapsibleContent className="mt-2">
      <div className="border-border/40 border-l py-2 pl-7 pr-2 text-sm leading-relaxed text-foreground">
        {replyId ? (
          <>
            <span className="sr-only">助手：</span>
            <ChatAssistantBody
              mid={replyId}
              isLastSegment={isLastSegment}
            />
          </>
        ) : null}
      </div>
    </CollapsibleContent>
  </Collapsible>
});



export const AiChatMessages = memo(function AiChatMessages() {
  const userMessageIds = useAtomValue(activeUserMessageIdsAtom);

  return (
    <>
      {userMessageIds.map((mid, index) => {
        const isLastSegment = index === userMessageIds.length - 1;

        return <ChatMessageItem key={mid} mid={mid} isLastSegment={isLastSegment} />;
      })}
    </>
  );
});
