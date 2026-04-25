'use client';

import { Activity, memo } from 'react';

import { ChatMessageAssistantContent } from './chat-message-assistant-content';
import { ChatMessageUserContent } from './chat-message-user-content';

import { segmentOpenAtomFamily, toggleSegmentOpenAtomFamily, userMessageTextAtomFamily } from '@/models/chat/session';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { segementOpenEffect } from '@/models/chat/session/segment-open';

export const ChatMessageCollapsible = memo(function ChatMessageCollapsible({ mid }: { mid: string }) {
  useAtom(segementOpenEffect);
  const isOpen = useAtomValue(segmentOpenAtomFamily(mid));
  const toggleOpen = useSetAtom(toggleSegmentOpenAtomFamily(mid));
  const messageText = useAtomValue(userMessageTextAtomFamily(mid));

  return (
    <div className="w-full min-w-0 contain-[layout]" id={mid}>
      <div
        className="mb-3 z-10 sticky top-3 flex w-full min-w-0 items-start gap-2 bg-background text-left outline-none rounded-lg"
        onClick={toggleOpen}
      >
        <span className="inline-flex shrink-0 pt-3">
          <ChevronRight className={cn('size-4', { 'rotate-90': isOpen })} aria-hidden />
        </span>
        <ChatMessageUserContent text={messageText} />
      </div>
      <Activity mode={isOpen ? 'visible' : 'hidden'}>
        <div className="ml-2 mt-2 border-border/40 border-l py-2 pl-6 pr-2 text-sm leading-relaxed text-foreground">
          <ChatMessageAssistantContent mid={mid} />
        </div>
      </Activity>
    </div>
  );
});
