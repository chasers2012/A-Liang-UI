"use client";

import { memo } from "react";
import { useAtomValue } from "jotai";

import { activeUserMessageIdsAtom } from "@/models/chat/session.atom";

import "@incremark/theme/styles.css";
import { ChatMessageCollapsible } from "./chat-message-collapsible";





export const AiChatMessages = memo(function AiChatMessages() {
  const userMessageIds = useAtomValue(activeUserMessageIdsAtom);
  const lastIndex = userMessageIds.length - 1;

  return userMessageIds.map((mid, idx) => (
    <ChatMessageCollapsible
      key={mid}
      mid={mid}
      isLastSegment={idx === lastIndex}
    />
  ))
});
