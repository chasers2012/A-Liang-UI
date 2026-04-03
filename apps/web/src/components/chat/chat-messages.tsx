"use client";

import { ChevronRight, Loader2 } from "lucide-react";

import { AiChatMarkdown } from "@/components/ai-chat-markdown";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { type ChatTurn } from "@/models/chat/session.atom";

import { buildChatSegments } from "./chat-segments";

interface AiChatMessageListProps {
  messages: ChatTurn[];
  isSending: boolean;
}

export function AiChatMessages({ messages, isSending }: AiChatMessageListProps) {
  const segments = buildChatSegments(messages);

  return (
    <>
      {segments.map((seg, index) => {
        if (seg.kind === "solo-assistant") {
          return (
            <div
              key={seg.message.id}
              className="mr-auto max-w-[min(100%,36rem)] rounded-lg border border-border/70 bg-card py-3 pl-6 pr-4 text-sm leading-relaxed text-card-foreground"
            >
              <span className="sr-only">助手：</span>
              <AiChatMarkdown content={seg.message.content} />
            </div>
          );
        }

        const isLastSegment = index === segments.length - 1;
        const showPending = isSending && isLastSegment && seg.assistant === undefined;

        return (
          <Collapsible key={seg.user.id} defaultOpen className="w-full min-w-0">
            <CollapsibleTrigger
              style={{ zIndex: 10 + index }}
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
                  <p className="whitespace-pre-wrap wrap-break-word">{seg.user.content}</p>
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="border-border/40 border-l py-2 pl-7 pr-2 text-sm leading-relaxed text-foreground">
                {seg.assistant ? (
                  <>
                    <span className="sr-only">助手：</span>
                    {seg.assistant.content === "" && isSending && isLastSegment ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                        正在生成…
                      </div>
                    ) : null}
                    {seg.assistant.content !== "" ? (
                      <AiChatMarkdown content={seg.assistant.content} />
                    ) : null}
                  </>
                ) : showPending ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                    正在生成…
                  </div>
                ) : null}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </>
  );
}
