'use client';

import { Fragment, memo, useMemo } from 'react';
import { useAtomValue } from 'jotai';

import { activeSessionIdAtom, isSessionGeneratingAtomFamily, replyOfMessageAtomFamily } from '@/models/chat';
import type { AssistantBlock } from '@/models/chat/types';
import { ChatAssistantSingleBlock } from './chat-assistant-single-block';
import { ChatSubagentTaskCard } from './chat-subagent-task-card';
import { blockStreamPartitionKey, formatSegmentLabel, partitionAssistantRuns } from './chat-subagent-task-blocks';

type AssistantBlockGroup = {
  partitionKey: string;
  /** 取自 ``run_segment_id`` 路径末段（无则不成组边框） */
  segmentLabel: string | null;
  blocks: AssistantBlock[];
};

function groupAssistantBlocksByStream(blocks: AssistantBlock[]): AssistantBlockGroup[] {
  const groups: AssistantBlockGroup[] = [];
  for (const block of blocks) {
    const partitionKey = blockStreamPartitionKey(block);
    const segmentLabel = formatSegmentLabel(block.run_segment_id);
    const last = groups[groups.length - 1];
    if (last && last.partitionKey === partitionKey) {
      last.blocks.push(block);
      continue;
    }
    groups.push({
      partitionKey,
      segmentLabel,
      blocks: [block],
    });
  }
  return groups;
}

export const ChatMessageAssistantContent = memo(function ChatMessageAssistantContent({ mid }: { mid: string }) {
  const isSending = useAtomValue(isSessionGeneratingAtomFamily(mid));
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

        const groups = groupAssistantBlocksByStream(run.blocks);
        return (
          <Fragment key={`plain-${runIndex}`}>
            {groups.map((group, groupIndex) => {
              const content = group.blocks.map((b, i) => (
                <ChatAssistantSingleBlock
                  key={b.kind === 'tool' ? b.call.id : `g-${runIndex}-${groupIndex}-${i}-${b.kind}`}
                  block={b}
                  isSending={isSending}
                  sessionId={sessionId}
                  assistantMessageId={message.id}
                />
              ));

              if (!group.segmentLabel) {
                return (
                  <div key={`g-${runIndex}-${groupIndex}`} className="space-y-1">
                    {content}
                  </div>
                );
              }

              return (
                <div
                  key={`g-${runIndex}-${groupIndex}`}
                  className="mb-2 rounded-md border border-border/60 bg-muted/20 p-3"
                >
                  <div className="mb-2 text-[10px] font-medium tracking-wide text-muted-foreground/90 uppercase">
                    {group.segmentLabel}
                  </div>
                  <div className="space-y-1">{content}</div>
                </div>
              );
            })}
          </Fragment>
        );
      })}
      <div id={`reply-${mid}-end`} className="h-0 w-0" />
    </div>
  );
});
