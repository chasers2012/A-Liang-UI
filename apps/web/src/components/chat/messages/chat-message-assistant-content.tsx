"use client";

import { memo } from "react";
import { useAtomValue } from "jotai";

import { chatIsSendingAtom, messageAtomFamily, messageReplieIdAtomFamily } from "@/models/chat/session.atom";
import { Loader2 } from "lucide-react";
import { AiChatMarkdown } from "./ai-chat-markdown";
import { ChatToolCallCard } from "./chat-tool-call-card";


const GeneratingIndicator = memo(function GeneratingIndicator() {
  return (
    <div
      data-chat-pending-indicator="true"
      className="flex items-center gap-2 text-muted-foreground"
    >
      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
      正在生成…
    </div>
  );
});

export const ChatMessageAssistantContent = memo(function ChatMessageAssistantContent({
  mid,
  isLastSegment,
}: {
  mid: string;
  isLastSegment: boolean;
}) {
  const replyId = useAtomValue(messageReplieIdAtomFamily(mid));
  const message = useAtomValue(messageAtomFamily(replyId));

  const isSending = useAtomValue(chatIsSendingAtom);
  const pending = isLastSegment && isSending;
  if (!replyId) return null;

  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="sr-only">助手：</span>
        {(message.blocks || []).map((b, i) => {
          if (b.kind === "text") {
            if (!b.content.trim()) return null;
            return <AiChatMarkdown key={`t-${i}`} content={b.content} isFinished={!pending} />;
          }
          return <ChatToolCallCard key={b.call.id} call={b.call} />;
        })}
        {pending ? <GeneratingIndicator /> : null}
      </div>
    </>
  );
});
