"use client";

import { memo } from "react";
import { Loader2 } from "lucide-react";
import { useAtomValue } from "jotai";

import { ChatToolCallCard } from "@/components/chat/chat-tool-call-card";
import { messageAtomFamily, chatIsSendingAtom } from "@/models/chat/session.atom";
import { AiChatMarkdown } from "./ai-chat-markdown";

interface ChatAssistantBodyProps {
  mid: string;
  isLastSegment: boolean;
}


export const ChatAssistantBody = memo(function ChatAssistantBody({
  mid,
  isLastSegment,
}: ChatAssistantBodyProps) {
  const message = useAtomValue(messageAtomFamily(mid));

  const isSending = useAtomValue(chatIsSendingAtom);
  const pending = isLastSegment && isSending;
  return (
    <div className="flex flex-col gap-1">
      {(message.blocks || []).map((b, i) => {
        if (b.kind === "text") {
          if (!b.content.trim()) return null;
          return <AiChatMarkdown key={`t-${i}`} content={b.content} isFinished={!pending} />;
        }
        return <ChatToolCallCard key={b.call.id} call={b.call} />;
      })}
      {pending ? (
        <div
          data-chat-pending-indicator="true"
          className="flex items-center gap-2 text-muted-foreground"
        >
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          正在生成…
        </div>
      ) : null}
    </div>
  );
});
