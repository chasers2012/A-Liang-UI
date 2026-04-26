'use client';

import { memo } from 'react';
import { useAtomValue } from 'jotai';

import { MarkdownContent } from '@/components/markdown/markdown-content';
import {
  chatAuthorizationAtom,
  chatAuthorizationDecisionAtom,
  isReplyStreamingOfMessageAtomFamily,
  replyOfMessageAtomFamily,
} from '@/models/chat/session';
import type { AssistantBlock } from '@/models/chat/types';
import { ChatReasoningCard } from './chat-reasoning-card';
import { ChatToolCallCard } from './chat-tool-call-card';

export const ChatMessageAssistantContent = memo(function ChatMessageAssistantContent({ mid }: { mid: string }) {
  const isSending = useAtomValue(isReplyStreamingOfMessageAtomFamily(mid));
  const message = useAtomValue(replyOfMessageAtomFamily(mid));
  const auth = useAtomValue(chatAuthorizationAtom);
  const authDecision = useAtomValue(chatAuthorizationDecisionAtom);

  if (!message) return null;

  const blocks = (message.blocks ?? []) as AssistantBlock[];
  const pendingAuth = auth && auth.assistantMessageId === message.id ? auth : null;
  const decidedAuth = authDecision && authDecision.assistantMessageId === message.id ? authDecision : null;
  const targetToolCallId = pendingAuth?.toolCallId ?? decidedAuth?.toolCallId ?? null;

  return (
    <div className="flex flex-col gap-1" id={`reply-${mid}`}>
      <span className="sr-only">助手：</span>
      {blocks.map((b, i) => {
        if (b.kind === 'text') {
          if (!b.content.trim()) return null;
          return <MarkdownContent key={`t-${i}`} content={b.content} isFinished={!isSending || !!b.completed} />;
        }
        if (b.kind === 'reasoning') {
          return <ChatReasoningCard key={`r-${i}`} content={b.content} />;
        }
        if (b.kind === 'tool') {
          const pendingInCard = pendingAuth && b.call.id === targetToolCallId ? { request: pendingAuth.request } : null;
          const decidedInCard =
            decidedAuth && b.call.id === targetToolCallId
              ? { decision: decidedAuth.decision, request: decidedAuth.request }
              : null;
          return (
            <ChatToolCallCard
              key={b.call.id}
              call={b.call}
              authorization={
                pendingInCard
                  ? { stage: 'pending', request: pendingInCard.request }
                  : decidedInCard
                    ? { stage: 'decided', decision: decidedInCard.decision, request: decidedInCard.request }
                    : null
              }
            />
          );
        }
        return null;
      })}
      <div id={`reply-${mid}-end`} className="h-0 w-0" />
    </div>
  );
});
