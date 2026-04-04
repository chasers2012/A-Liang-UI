"use client";

import { Loader2 } from "lucide-react";

import { ChatToolCallCard } from "@/components/chat/chat-tool-call-card";
import type { ChatTurn } from "@/models/chat/session.atom";
import { AiChatMarkdown } from "./ai-chat-markdown";

interface ChatAssistantBodyProps {
  message: ChatTurn;
  showPendingSpinner: boolean;
}

export function ChatAssistantBody({
  message,
  showPendingSpinner,
}: ChatAssistantBodyProps) {
  if (message.blocks?.length) {
    return (
      <div className="flex flex-col gap-1">
        {message.blocks.map((b, i) => {
          if (b.kind === "text") {
            if (!b.content.trim()) return null;
            return <AiChatMarkdown key={`t-${i}`} content={b.content} />;
          }
          return <ChatToolCallCard key={b.call.id} call={b.call} />;
        })}
        {showPendingSpinner ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            正在生成…
          </div>
        ) : null}
      </div>
    );
  }

  if (message.content !== "") {
    return <AiChatMarkdown content={message.content} />;
  }

  if (showPendingSpinner) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        正在生成…
      </div>
    );
  }

  return null;
}
