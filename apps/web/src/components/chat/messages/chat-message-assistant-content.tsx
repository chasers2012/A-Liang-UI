'use client';

import { memo } from 'react';
import { useAtomValue } from 'jotai';

import { MarkdownContent } from '@/components/markdown/markdown-content';
import { activeSessionIdAtom, isReplyStreamingOfMessageAtomFamily, replyOfMessageAtomFamily } from '@/models/chat';
import type { AssistantBlock } from '@/models/chat/types';
import { ChatReasoningCard } from './chat-reasoning-card';
import { ChatToolCallCard } from './chat-tool-call-card';

type AssistantBlockGroup = {
  agentName: string | null;
  blocks: AssistantBlock[];
};

function groupAssistantBlocksByAgent(blocks: AssistantBlock[]): AssistantBlockGroup[] {
  const groups: AssistantBlockGroup[] = [];
  for (const block of blocks) {
    const agentName = (block.agent_name || '').trim() || null;
    const last = groups[groups.length - 1];
    if (last && last.agentName === agentName) {
      last.blocks.push(block);
      continue;
    }
    groups.push({
      agentName,
      blocks: [block],
    });
  }
  return groups;
}

export const ChatMessageAssistantContent = memo(function ChatMessageAssistantContent({ mid }: { mid: string }) {
  const isSending = useAtomValue(isReplyStreamingOfMessageAtomFamily(mid));
  const message = useAtomValue(replyOfMessageAtomFamily(mid));
  const sessionId = useAtomValue(activeSessionIdAtom);

  if (!message || !sessionId) return null;

  const blocks = (message.blocks ?? []) as AssistantBlock[];
  const groups = groupAssistantBlocksByAgent(blocks);

  return (
    <div className="flex flex-col gap-1" id={`reply-${mid}`}>
      <span className="sr-only">助手：</span>
      {groups.map((group, groupIndex) => {
        const content = group.blocks.map((b, i) => {
          if (b.kind === 'text') {
            if (!b.content.trim()) return null;
            return (
              <MarkdownContent
                key={`t-${groupIndex}-${i}`}
                content={b.content}
                isFinished={!isSending || !!b.completed}
              />
            );
          }
          if (b.kind === 'reasoning') {
            return <ChatReasoningCard key={`r-${groupIndex}-${i}`} content={b.content} agentName={b.agent_name} />;
          }
          if (b.kind === 'tool') {
            return (
              <ChatToolCallCard key={b.call.id} call={b.call} sessionId={sessionId} assistantMessageId={message.id} />
            );
          }
          return null;
        });

        if (!group.agentName) {
          return (
            <div key={`g-${groupIndex}`} className="space-y-1">
              {content}
            </div>
          );
        }

        return (
          <div key={`g-${groupIndex}`} className="mb-2 rounded-md border border-border/60 bg-muted/20 p-3">
            <div className="mb-2 text-[10px] font-medium tracking-wide text-muted-foreground/90 uppercase">
              {group.agentName}
            </div>
            <div className="space-y-1">{content}</div>
          </div>
        );
      })}
      <div id={`reply-${mid}-end`} className="h-0 w-0" />
    </div>
  );
});
