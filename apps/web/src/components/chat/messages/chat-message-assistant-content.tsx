"use client";

import { memo } from "react";
import { useAtomValue } from "jotai";

import { ChatAssistantBody } from "@/components/chat/chat-assistant-body";
import { messageReplieIdAtomFamily } from "@/models/chat/session.atom";

export const ChatMessageAssistantContent = memo(function ChatMessageAssistantContent({
  mid,
  isLastSegment,
}: {
  mid: string;
  isLastSegment: boolean;
}) {
  const replyId = useAtomValue(messageReplieIdAtomFamily(mid));
  if (!replyId) return null;
  return (
    <>
      <span className="sr-only">助手：</span>
      <ChatAssistantBody mid={replyId} isLastSegment={isLastSegment} />
    </>
  );
});
