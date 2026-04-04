"use client";

import { memo } from "react";
import { Archive, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { RenameButton } from "./rename-session";

export const ChatSessionTabsActions = memo(function ChatSessionTabsActions({
  isBusy,
  hasActive,
  onCreate,
  onArchive,
}: {
  isBusy: boolean;
  hasActive: boolean;
  onCreate: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-2 px-2"
        onClick={onCreate}
        disabled={isBusy}
      >
        <Plus className="size-4" aria-hidden />
      </Button>
      <RenameButton disabled={isBusy} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={onArchive}
        disabled={isBusy || !hasActive}
        aria-label="归档当前会话"
      >
        <Archive className="size-4" aria-hidden />
      </Button>
    </div>
  );
});
