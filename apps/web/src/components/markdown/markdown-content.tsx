"use client";

import { IncremarkContent } from "@incremark/react";

import { cn } from "@/lib/utils";

export function MarkdownContent(props: { content: string; className?: string }) {
  const { content, className } = props;
  return (
    <div className={cn("ai-chat-md wrap-break-word text-xs leading-relaxed", className)}>
      <IncremarkContent content={content} />
    </div>
  );
}
