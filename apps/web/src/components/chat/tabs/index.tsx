"use client";

import { memo } from "react";
import { useAtomValue } from "jotai";

import { chatSessionsAtom } from "@/models/chat/session.atom";

import { ChatSessionTabsActions } from "./chat-session-tabs-actions";
import { ChatSessionTabsPane } from "./chat-session-tabs-pane";

export const ChatSessionTabs = memo(function ChatSessionTabs() {
  const sessions = useAtomValue(chatSessionsAtom);


  return (
    <div className="flex items-center gap-2 border-b border-border/60 px-3 pt-1">
      <ChatSessionTabsPane sessions={sessions} />
      <ChatSessionTabsActions />
    </div>
  );
});