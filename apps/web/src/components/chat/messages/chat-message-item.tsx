"use client";

import { memo } from "react";
import { useAtom, useAtomValue } from "jotai";

import {
  messageAtomFamily,
  segmentOpenAtomFamily,
} from "@/models/chat/session.atom";

import { ChatMessageCollapsible } from "./chat-message-collapsible";
import { getUserMessageText } from "./get-user-text";

export const ChatMessageItem = memo(function ChatMessageItem({
  mid,
  isLastSegment,
}: {
  mid: string;
  isLastSegment: boolean;
}) {
  const user = useAtomValue(messageAtomFamily(mid));
  const [isOpen, setIsOpen] = useAtom(segmentOpenAtomFamily(mid));

  if (!user) return null;

  return (
    <ChatMessageCollapsible
      mid={mid}
      userText={getUserMessageText(user.blocks)}
      open={isOpen}
      onOpenChange={setIsOpen}
      isLastSegment={isLastSegment}
    />
  );
});
