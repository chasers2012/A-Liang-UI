"use client";

import { IncremarkContent } from "@incremark/react";
import { memo } from "react";

import { cn } from "@/lib/utils";



export const AiChatMarkdown = memo(function AiChatMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={cn("ai-chat-md wrap-break-word text-sm leading-relaxed", className)}>
      <IncremarkContent content={content} />
    </div>
  );
});
