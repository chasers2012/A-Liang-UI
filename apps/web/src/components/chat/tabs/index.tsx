'use client';

import { memo } from 'react';

import { ChatTabsActions } from './chat-session-tabs-actions';
import { ChatTabsScrollArea } from './chat-session-tabs-scroll-area';

export const ChatTabs = memo(function ChatTabs() {
  return (
    <div className="flex items-center gap-2 border-b border-border/60 px-3 pt-1">
      <div className="min-w-0 flex-1">
        <ChatTabsScrollArea />
      </div>
      <ChatTabsActions />
    </div>
  );
});
