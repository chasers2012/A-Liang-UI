"use client";

import { memo, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { chatIsSendingAtom, createChatSessionAtom } from "@/models/chat/session";

import { ArchiveButton } from "./archive-session";
import { RenameButton } from "./rename-session";

const NewChatSessionButton = memo(function NewChatSessionButton({
  disabled,
  onCreate,
}: {
  disabled: boolean;
  onCreate: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 gap-2 px-2"
      onClick={onCreate}
      disabled={disabled}
    >
      <Plus className="size-4" aria-hidden />
    </Button>
  );
});

export const ChatSessionTabsActions = memo(function ChatSessionTabsActions() {
  const isBusy = useAtomValue(chatIsSendingAtom);
  const createSession = useSetAtom(createChatSessionAtom);

  const onCreate = useCallback(() => {
    void createSession();
  }, [createSession]);

  return (
    <div className="flex shrink-0 items-center gap-1">
      <NewChatSessionButton disabled={isBusy} onCreate={onCreate} />
      <RenameButton disabled={isBusy} />
      <ArchiveButton disabled={isBusy} />
    </div>
  );
});
