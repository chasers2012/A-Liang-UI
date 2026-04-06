"use client";

import { memo, useCallback, useState } from "react";
import { Pencil } from "lucide-react";
import { useAtomValue, useSetAtom } from "jotai";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  chatSessionSummaryAtomFamily,
  renameChatSessionAtom,
} from "@/models/chat/session";

import { ActiveSessionSnapshotTrigger } from "./active-session-snapshot-trigger";

const RenameSessionDialogForm = memo(function RenameSessionDialogForm({
  sessionId,
  initialTitle,
  onClose,
}: {
  sessionId: string;
  initialTitle: string;
  onClose: () => void;
}) {
  const [renameValue, setRenameValue] = useState(initialTitle);
  const renameSession = useSetAtom(renameChatSessionAtom);
  const active = useAtomValue(chatSessionSummaryAtomFamily(sessionId));

  const submitRename = useCallback(() => {
    const title = renameValue.trim();
    if (!title) return;
    void renameSession({ sessionId, title });
    onClose();
  }, [renameSession, renameValue, sessionId, onClose]);

  return (
    <>
      <DialogHeader title="重命名会话" />
      <DialogBody variant="inset">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">请输入新的会话名称。</p>
          <Input
            autoFocus
            value={renameValue}
            onChange={(ev) => setRenameValue(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key !== "Enter") return;
              ev.preventDefault();
              submitRename();
            }}
            placeholder="会话名称"
            maxLength={120}
          />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          取消
        </Button>
        <Button
          type="button"
          onClick={submitRename}
          disabled={!active || !renameValue.trim()}
        >
          保存
        </Button>
      </DialogFooter>
    </>
  );
});

export const RenameButton = memo(function RenameButton({
  disabled,
}: {
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<{
    sessionId: string;
    title: string;
  } | null>(null);
  const [formKey, setFormKey] = useState(0);

  const onRequestOpen = useCallback((sessionId: string, title: string) => {
    setPayload({ sessionId, title });
    setFormKey((k) => k + 1);
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

  return (
    <>
      <ActiveSessionSnapshotTrigger
        disabled={disabled}
        onRequestOpen={onRequestOpen}
        ariaLabel="重命名当前会话"
      >
        <Pencil className="size-4" aria-hidden />
      </ActiveSessionSnapshotTrigger>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="md">
          {payload ? (
            <RenameSessionDialogForm
              key={formKey}
              sessionId={payload.sessionId}
              initialTitle={payload.title}
              onClose={onClose}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
});
