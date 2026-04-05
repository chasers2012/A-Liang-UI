"use client";

import { memo } from "react";


import { ChatSessionTabsActions } from "./chat-session-tabs-actions";
import { ChatSessionTabsScrollArea } from "./chat-session-tabs-scroll-area";

export const ChatSessionTabs = memo(function ChatSessionTabs() {


  return (
    <div className="flex items-center gap-2 border-b border-border/60 px-3 pt-1">
      <div className="min-w-0 flex-1">
        <ChatSessionTabsScrollArea />
      </div>
      <ChatSessionTabsActions />
    </div>
  );
});