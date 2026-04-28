'use client';

import { memo } from 'react';

import { MarkdownContent } from '@/components/markdown/markdown-content';
import type { AssistantBlock } from '@/models/chat/types';

import { formatSegmentLabel } from './chat-subagent-task-blocks';
import { ChatReasoningCard } from './chat-reasoning-card';
import { ChatToolCallCard } from './chat-tool-call-card';

/** 单个 assistant 块（不含已抽离的顶层 `task` 外壳；若误入 task 则退回通用工具卡）。 */
export const ChatAssistantSingleBlock = memo(function ChatAssistantSingleBlock({
  block,
  isSending,
  sessionId,
  assistantMessageId,
}: {
  block: AssistantBlock;
  isSending: boolean;
  sessionId: string;
  assistantMessageId: string;
}) {
  if (block.kind === 'text') {
    if (!block.content.trim()) return null;
    return <MarkdownContent content={block.content} isFinished={!isSending || !!block.completed} />;
  }
  if (block.kind === 'reasoning') {
    return <ChatReasoningCard content={block.content} segmentLabel={formatSegmentLabel(block.run_segment_id)} />;
  }
  if (block.kind === 'tool') {
    return <ChatToolCallCard call={block.call} sessionId={sessionId} assistantMessageId={assistantMessageId} />;
  }
  return null;
});
