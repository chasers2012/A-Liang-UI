"use client";

import { memo, useCallback, useState } from "react";
import { useSetAtom } from "jotai";
import { Archive } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { archiveChatAtom } from "@/models/chat/session";

import { ActiveSessionSnapshotTrigger } from "./active-session-snapshot-trigger";

export const ArchiveButton = memo(function ArchiveButton({
  disabled,
}: {
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<{
    sessionId: string;
    title: string;
  } | null>(null);
  const archiveSession = useSetAtom(archiveChatAtom);

  const onRequestOpen = useCallback((sessionId: string, title: string) => {
    setPayload({ sessionId, title });
    setOpen(true);
  }, []);

  const onClose = useCallback(() => {
    setOpen(false);
    setPayload(null);
  }, []);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setPayload(null);
  }, []);

  const onConfirm = useCallback(() => {
    if (!payload) return;
    void archiveSession(payload.sessionId);
    onClose();
  }, [archiveSession, onClose, payload]);

  return (
    <>
      <ActiveSessionSnapshotTrigger
        disabled={disabled}
        onRequestOpen={onRequestOpen}
        ariaLabel="归档当前会话">
        <Archive className="size-4" aria-hidden />
      </ActiveSessionSnapshotTrigger>
      <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        title="归档会话"
        description={
          <div className="space-y-2">
            <p className="text-sm text-foreground">
              确认归档会话「{payload?.title ?? ""}」？
            </p>
            <p className="text-sm text-muted-foreground">
              归档后会从当前列表隐藏，消息会保留；可在「已归档」页面恢复。
            </p>
          </div>
        }
        confirmLabel="归档"
        onConfirm={onConfirm}
      />
    </>
  );
});
