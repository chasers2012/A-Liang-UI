'use client';

import { memo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { chatIsSendingAtom, createChatAtom } from '@/models/chat';

import { ArchiveButton } from './archive-session';
import { RenameButton } from './rename-session';

const NewChatButton = memo(function NewChatButton({ disabled, onCreate }: { disabled: boolean; onCreate: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="h-7 gap-2 px-2" onClick={onCreate} disabled={disabled}>
      <Plus className="size-4" aria-hidden />
    </Button>
  );
});

export const ChatTabsActions = memo(function ChatTabsActions() {
  const isBusy = useAtomValue(chatIsSendingAtom);
  const createSession = useSetAtom(createChatAtom);

  return (
    <div className="flex shrink-0 items-center gap-1">
      <NewChatButton disabled={isBusy} onCreate={createSession} />
      <RenameButton disabled={isBusy} />
      <ArchiveButton disabled={isBusy} />
    </div>
  );
});
