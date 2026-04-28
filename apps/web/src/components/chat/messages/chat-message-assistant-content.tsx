'use client';

import { memo, useMemo } from 'react';
import { useAtomValue } from 'jotai';

import { activeSessionIdAtom, isReplyStreamingOfMessageAtomFamily, replyOfMessageAtomFamily } from '@/models/chat';
import type { AssistantBlock } from '@/models/chat/types';
import { ChatAssistantSingleBlock } from './chat-assistant-single-block';
import { ChatSubagentTaskCard } from './chat-subagent-task-card';
import { partitionAssistantRuns } from './chat-subagent-task-blocks';

export const ChatMessageAssistantContent = memo(function ChatMessageAssistantContent({ mid }: { mid: string }) {
  const isSending = useAtomValue(isReplyStreamingOfMessageAtomFamily(mid));
  const message = useAtomValue(replyOfMessageAtomFamily(mid));
  const sessionId = useAtomValue(activeSessionIdAtom);

  const renderRuns = useMemo(() => {
    const blocks = (message?.blocks ?? []) as AssistantBlock[];
    return partitionAssistantRuns(blocks);
  }, [message]);

  if (!message || !sessionId) return null;

  return (
    <div className="flex flex-col gap-1" id={`reply-${mid}`}>
      <span className="sr-only">助手：</span>
      {renderRuns.map((run, runIndex) => {
        if (run.kind === 'shell') {
          const tb = run.shell.taskBlock;
          return (
            <ChatSubagentTaskCard
              key={tb.call.id}
              call={tb.call}
              nestedBlocks={run.shell.nested}
              sessionId={sessionId}
              assistantMessageId={message.id}
              isSending={isSending}
            />
          );
        }

        return (
          <div key={`plain-${runIndex}`} className="space-y-1">
            {run.blocks.map((b, i) => (
              <ChatAssistantSingleBlock
                key={b.kind === 'tool' ? b.call.id : `g-${runIndex}-${i}-${b.kind}`}
                block={b}
                isSending={isSending}
                sessionId={sessionId}
                assistantMessageId={message.id}
              />
            ))}
          </div>
        );
      })}
      <div id={`reply-${mid}-end`} className="h-0 w-0" />
    </div>
  );
});
