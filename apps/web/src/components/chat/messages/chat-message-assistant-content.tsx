'use client';

import { memo, useCallback, useMemo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  activeSessionIdAtom,
  chatIsSendingAtom,
  isReplyStreamingOfMessageAtomFamily,
  replyOfMessageAtomFamily,
  resendChatMessageAtom,
  userMessageTextAtomFamily,
} from '@/models/chat';
import type { AssistantBlock } from '@/models/chat/types';
import { ChatAssistantSingleBlock } from './chat-assistant-single-block';
import { ChatSubagentTaskCard } from './chat-subagent-task-card';
import { partitionAssistantRuns } from './chat-subagent-task-blocks';
import { RotateCcw } from 'lucide-react';

export const ChatMessageAssistantContent = memo(function ChatMessageAssistantContent({ mid }: { mid: string }) {
  const isSending = useAtomValue(isReplyStreamingOfMessageAtomFamily(mid));
  const message = useAtomValue(replyOfMessageAtomFamily(mid));
  const sessionId = useAtomValue(activeSessionIdAtom);
  const isChatSending = useAtomValue(chatIsSendingAtom);
  const messageText = useAtomValue(userMessageTextAtomFamily(mid));
  const resend = useSetAtom(resendChatMessageAtom);

  const handleResend = useCallback(() => {
    const trimmed = messageText.trim();
    if (!sessionId || !trimmed || isChatSending) return;
    void resend({ sessionId, replaceFromMessageId: mid, text: trimmed });
  }, [isChatSending, messageText, mid, resend, sessionId]);

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
      {!isSending ? (
        <div className="mt-2 flex items-center justify-start">
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="inline-flex">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
                    aria-label="重新发送（将替换本条及之后的对话）"
                    disabled={!sessionId || !messageText.trim() || isChatSending}
                    onClick={handleResend}
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                  </Button>
                </span>
              }
            />
            <TooltipContent side="top">重新发送（将替换本条及之后的对话）</TooltipContent>
          </Tooltip>
        </div>
      ) : null}
      <div id={`reply-${mid}-end`} className="h-0 w-0" />
    </div>
  );
});
