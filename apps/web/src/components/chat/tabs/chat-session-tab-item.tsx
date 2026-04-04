"use client";

import { memo } from "react";

import { TabsTrigger } from "@/components/ui/tabs";

import { chatSessionTabTriggerClassName } from "./tab-trigger-styles";

export const ChatSessionTabItem = memo(function ChatSessionTabItem({
  id,
  title,
  messageCount,
  disabled,
}: {
  id: string;
  title: string;
  messageCount: number;
  disabled: boolean;
}) {
  return (
    <TabsTrigger value={id} disabled={disabled} className={chatSessionTabTriggerClassName}>
      <span className="truncate">{title}</span>
      {messageCount > 0 ? (
        <span className="text-xs opacity-70">{messageCount}</span>
      ) : null}
    </TabsTrigger>
  );
});
