"use client";

import { memo } from "react";
import { useAtomValue } from "jotai";

import { activeUserMessageIdsAtom } from "@/models/chat/session";

import "@incremark/theme/styles.css";
import { ChatMessageCollapsible } from "./chat-message-collapsible";


export const AiChatMessages = memo(function AiChatMessages() {
  const userMessageIds = useAtomValue(activeUserMessageIdsAtom);

  return (userMessageIds ?? []).map((mid) => (
    <ChatMessageCollapsible
      key={mid}
      mid={mid}
    />
  ))
});
