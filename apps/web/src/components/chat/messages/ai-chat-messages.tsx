"use client";

import { memo } from "react";
import { useAtomValue } from "jotai";

import { activeUserMessageIdsAtom } from "@/models/chat/session.atom";

import { ChatMessageItem } from "./chat-message-item";

export const AiChatMessages = memo(function AiChatMessages() {
  const userMessageIds = useAtomValue(activeUserMessageIdsAtom);
  const lastIndex = userMessageIds.length - 1;

  return userMessageIds.map((mid, idx) => (
    <ChatMessageItem
      key={mid}
      mid={mid}
      isLastSegment={idx === lastIndex}
    />
  ));
});
