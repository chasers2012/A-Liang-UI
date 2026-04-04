"use client";

import { memo, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";

import { chatSessionsAtom, createChatSessionAtom } from "@/models/chat/session.atom";

import { ChatSessionTabsActions } from "./chat-session-tabs-actions";
import { ChatSessionTabsPane } from "./chat-session-tabs-pane";

export const ChatSessionTabs = memo(function ChatSessionTabs() {
  const sessions = useAtomValue(chatSessionsAtom);
  const createSession = useSetAtom(createChatSessionAtom);

  const onCreate = useCallback(() => {
    void createSession();
  }, [createSession]);

  return (
    <div className="flex items-center gap-2 border-b border-border/60 px-3 pt-1">
      <ChatSessionTabsPane sessions={sessions} />

      <ChatSessionTabsActions onCreate={onCreate} />
    </div>
  );
});
