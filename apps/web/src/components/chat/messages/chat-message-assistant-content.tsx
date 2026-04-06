"use client";

import { memo } from "react";
import { useAtomValue } from "jotai";

import { replyOfMessageAtomFamily } from "@/models/chat/session.atom";
import { AiChatMarkdown } from "./ai-chat-markdown";
import { ChatToolCallCard } from "./chat-tool-call-card";




export const ChatMessageAssistantContent = memo(function ChatMessageAssistantContent({
  mid,
}: {
  mid: string;
}) {
  const message = useAtomValue(replyOfMessageAtomFamily(mid));

  if (!message) return null;

  return (
    <div className="flex flex-col gap-1" id={`reply-${mid}`}>
      <span className="sr-only">助手：</span>
      {(message.blocks || []).map((b, i) => {
        if (b.kind === "text") {
          if (!b.content.trim()) return null;
          return <AiChatMarkdown key={`t-${i}`} content={b.content} />;
        }
        return <ChatToolCallCard key={b.call.id} call={b.call} />;
      })}
      <div id={`reply-${mid}-end`} className="h-0 w-0" />
    </div>
  );
});
