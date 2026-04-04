"use client";

import { memo, useCallback, useState } from "react";
import { useAtomValue, useSetAtom, useStore } from "jotai";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  activeChatSessionIdAtom,
  archiveChatSessionAtom,
  chatIsSendingAtom,
  chatSessionsAtom,
  chatSessionSummaryAtomFamily,
  createChatSessionAtom,
} from "@/models/chat/session.atom";

import { ChatSessionTabsActions } from "./chat-session-tabs-actions";
import { ChatSessionTabsPane } from "./chat-session-tabs-pane";

export const ChatSessionTabs = memo(function ChatSessionTabs() {
  const sessions = useAtomValue(chatSessionsAtom);
  const activeId = useAtomValue(activeChatSessionIdAtom);
  const createSession = useSetAtom(createChatSessionAtom);
  const archiveSession = useSetAtom(archiveChatSessionAtom);
  const active = useAtomValue(chatSessionSummaryAtomFamily(activeId ?? ""));
  const store = useStore();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const isSending = useAtomValue(chatIsSendingAtom);
  const isBusy = isSending;

  const onCreate = useCallback(() => {
    void createSession();
  }, [createSession]);

  const onArchive = useCallback(() => {
    const id = store.get(activeChatSessionIdAtom);
    if (!id) return;
    const a = store.get(chatSessionSummaryAtomFamily(id));
    if (!a) return;
    setArchiveOpen(true);
  }, [store]);

  const onArchiveConfirm = useCallback(() => {
    const id = store.get(activeChatSessionIdAtom);
    if (!id) return;
    const a = store.get(chatSessionSummaryAtomFamily(id));
    if (!a) return;
    void archiveSession(a.id);
    setArchiveOpen(false);
  }, [archiveSession, store]);

  return (
    <div className="flex items-center gap-2 border-b border-border/60 px-3 pt-1">
      <ChatSessionTabsPane sessions={sessions} activeId={activeId} isBusy={isBusy} />

      <ChatSessionTabsActions
        isBusy={isBusy}
        hasActive={!!active}
        onCreate={onCreate}
        onArchive={onArchive}
      />
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="归档会话"
        description={
          <div className="space-y-2">
            <p className="text-sm text-foreground">确认归档会话「{active?.title ?? ""}」？</p>
            <p className="text-sm text-muted-foreground">
              归档后会从当前列表隐藏，消息会保留；可在「已归档」页面恢复。
            </p>
          </div>
        }
        confirmLabel="归档"
        onConfirm={onArchiveConfirm}
      />
    </div>
  );
});
