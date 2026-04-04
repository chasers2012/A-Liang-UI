"use client";

import { memo } from "react";

import { cn } from "@/lib/utils";

const userBubbleClassName = cn(
  "flex min-w-0 flex-1 overflow-hidden rounded-lg border border-border/70 bg-muted/50 text-sm leading-relaxed text-foreground",
  "group-hover/trigger:bg-muted/70",
);

export const ChatMessageUserContent = memo(function ChatMessageUserContent({
  text,
}: {
  text: string;
}) {
  return (
    <div className={userBubbleClassName}>
      <span className="w-1 shrink-0 bg-primary" aria-hidden />
      <div className="min-w-0 flex-1 px-3 py-2">
        <span className="sr-only">你：</span>
        <p className="whitespace-pre-wrap wrap-break-word">{text}</p>
      </div>
    </div>
  );
});
