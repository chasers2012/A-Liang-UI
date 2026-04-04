"use client";

import { memo } from "react";
import { useSetAtom } from "jotai";

import { Tabs } from "@/components/ui/tabs";
import type { AgentChatSessionSummaryPublic } from "@/models";
import { selectChatSessionAtom } from "@/models/chat/session.atom";

import { ChatSessionTabsScrollArea } from "./chat-session-tabs-scroll-area";

export const ChatSessionTabsPane = memo(function ChatSessionTabsPane({
  sessions,
  activeId,
  isBusy,
}: {
  sessions: AgentChatSessionSummaryPublic[];
  activeId: string | null;
  isBusy: boolean;
}) {
  const selectSession = useSetAtom(selectChatSessionAtom);

  return (
    <Tabs
      value={activeId ?? ""}
      onValueChange={(v) => {
        if (!v) return;
        void selectSession(v);
      }}
      className="min-w-0 flex-1"
    >
      <ChatSessionTabsScrollArea sessions={sessions} isBusy={isBusy} />
    </Tabs>
  );
});
