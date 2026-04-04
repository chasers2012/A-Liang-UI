"use client";

import { memo, useCallback } from "react";
import { useSetAtom } from "jotai";

import type { AgentChatSessionSummaryPublic } from "@/models";
import { selectChatSessionAtom } from "@/models/chat/session.atom";

import { ChatSessionTabsScrollArea } from "./chat-session-tabs-scroll-area";

export const ChatSessionTabsPane = memo(function ChatSessionTabsPane({
  sessions,
}: {
  sessions: AgentChatSessionSummaryPublic[];
}) {
  const selectSession = useSetAtom(selectChatSessionAtom);

  const onSelectSession = useCallback(
    (id: string) => {
      void selectSession(id);
    },
    [selectSession],
  );

  return (
    <div className="min-w-0 flex-1">
      <ChatSessionTabsScrollArea
        sessions={sessions}
        onSelectSession={onSelectSession}
      />
    </div>
  );
});
