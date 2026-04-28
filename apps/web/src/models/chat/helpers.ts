import type {
  ChatMessagePublic,
  ChatRequestMessage,
  ChatDetailPublic,
  ChatSummaryPublic,
  ChatToolCallPublic,
} from '@/models/agent-llm/dto';
import type { AssistantBlock } from '@/models/chat/types';

export function appendAssistantDelta(
  prev: ChatMessagePublic | undefined,
  payload: { text: string; run_segment_id?: string },
): ChatMessagePublic | undefined {
  if (!prev) return prev;
  const { text: delta, run_segment_id: runSegmentId } = payload;
  const blocks = [...(prev.blocks ?? [])];
  const last = blocks[blocks.length - 1];
  if (last?.kind === 'text' && (last.run_segment_id ?? '') === (runSegmentId ?? '')) {
    blocks[blocks.length - 1] = {
      kind: 'text',
      content: last.content + delta,
      run_segment_id: runSegmentId,
      completed: last.completed,
    };
  } else {
    blocks.push({ kind: 'text', content: delta, run_segment_id: runSegmentId });
  }
  return { ...prev, blocks };
}

export function appendAssistantReasoning(
  prev: ChatMessagePublic | undefined,
  payload: { text: string; run_segment_id?: string },
): ChatMessagePublic | undefined {
  if (!prev) return prev;
  const { text: delta, run_segment_id: runSegmentId } = payload;
  const blocks = [...(prev.blocks ?? [])];
  const last = blocks[blocks.length - 1];
  if (last?.kind === 'reasoning' && (last.run_segment_id ?? '') === (runSegmentId ?? '')) {
    blocks[blocks.length - 1] = {
      kind: 'reasoning',
      content: last.content + delta,
      run_segment_id: runSegmentId,
    };
  } else {
    blocks.push({ kind: 'reasoning', content: delta, run_segment_id: runSegmentId });
  }
  return { ...prev, blocks };
}

export function applyToolStart(
  prev: ChatMessagePublic | undefined,
  payload: { name: string; id: string; args?: unknown; run_segment_id?: string },
): ChatMessagePublic | undefined {
  if (!prev) return prev;
  const call: ChatToolCallPublic = {
    id: payload.id,
    name: payload.name,
    args: payload.args,
    status: 'running',
    authorization_status: 'none',
  };
  const blocks: AssistantBlock[] = [
    ...(prev.blocks ?? []),
    {
      kind: 'tool',
      run_segment_id: payload.run_segment_id,
      call,
    },
  ];
  return { ...prev, blocks };
}

export function patchToolInBlocks(
  prev: ChatMessagePublic | undefined,
  id: string,
  patch: Partial<ChatToolCallPublic>,
): ChatMessagePublic | undefined {
  if (!prev) return prev;
  const blocks = (prev.blocks ?? []).map((b): AssistantBlock => {
    if (b.kind !== 'tool' || b.call.id !== id) return b;
    return {
      kind: 'tool',
      run_segment_id: b.run_segment_id,
      call: { ...b.call, ...patch },
    };
  });
  return { ...prev, blocks };
}

export function upsertSummary(list: ChatSummaryPublic[], detail: ChatDetailPublic): ChatSummaryPublic[] {
  const nextSummary: ChatSummaryPublic = {
    id: detail.id,
    title: detail.title,
    created_at: detail.created_at,
    updated_at: detail.updated_at,
    message_count: detail.messages.length,
  };
  const filtered = list.filter((i) => i.id !== detail.id);
  return [nextSummary, ...filtered].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function extractTextFromBlocks(blocks: AssistantBlock[] | undefined): string {
  if (!blocks?.length) return '';
  return blocks
    .filter((b): b is Extract<AssistantBlock, { kind: 'text' }> => b.kind === 'text')
    .map((b) => b.content)
    .join('');
}

export function summarizeFirstUserMessage(text: string): string {
  const s = text.replace(/\s+/g, ' ').trim();
  if (!s) return '新会话';
  const max = 18;
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function toApiMessage(turn: ChatMessagePublic & { role: 'user' }, omitId?: boolean): ChatRequestMessage {
  const base: ChatRequestMessage = {
    role: 'user',
    blocks: turn.blocks ?? [],
  };
  if (omitId) return base;
  return { ...base, id: turn.id };
}
