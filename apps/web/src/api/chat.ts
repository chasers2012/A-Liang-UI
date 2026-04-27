import type {
  ChatBatchDeleteBody,
  ChatBatchDeleteResult,
  ChatBatchUpdateBody,
  ChatBatchUpdateResult,
  ChatArchivedSummaryPublic,
  ChatCreateBody,
  ChatDetailPublic,
  ChatRenameBody,
  ChatRequestPublic,
  ChatSummaryPublic,
} from '@/models/agent-llm/dto';
import { ApiError, apiFetchJson, getQuantAgentApiBase, parseDetail } from './client';

/** Mirrors ``app.chat.events.ToolPayload``. */
type ChatSseToolPayload =
  | { stage: 'start'; id: string; name: string; args?: unknown; agent_name?: string }
  | { stage: 'result'; id: string; result?: unknown; agent_name?: string }
  | { stage: 'error'; id: string; error?: string | null; agent_name?: string }
  | { stage: 'authorize'; id: string; agent_name?: string };

type ChatSseTextPayload = {
  text: string;
  agent_name?: string;
};

/** Mirrors ``app.chat.events.MessageIdsPayload``. */
type ChatSseMessageIdsPayload = {
  user: string;
  assistant: string;
};

/**
 * Mirrors ``StreamEvent`` in ``app.chat.events`` after client normalization.
 * Wire: SSE ``event:`` names the kind; ``data:`` is the payload JSON (no ``type`` field).
 */
type ChatSseStreamEvent =
  | { type: 'message_ids'; payload: ChatSseMessageIdsPayload }
  | { type: 'delta'; payload: ChatSseTextPayload }
  | { type: 'reasoning'; payload: ChatSseTextPayload }
  | { type: 'tool'; payload: ChatSseToolPayload }
  | { type: 'done'; payload?: null | undefined }
  | { type: 'error'; payload: string };

/** Parse outcome: a wire event, or ``undefined`` when the chunk is ignored / invalid. */
type ChatSseParsedEvent = ChatSseStreamEvent | undefined;

function sseStringField(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function sseOptionalStringField(v: unknown): string | undefined {
  const text = sseStringField(v).trim();
  return text || undefined;
}

function parseTextPayload(payload: unknown): ChatSseTextPayload | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const p = payload as Record<string, unknown>;
  const text = sseStringField(p.text);
  if (!text) return undefined;
  return {
    text,
    agent_name: sseOptionalStringField(p.agent_name),
  };
}

function parseToolPayload(payload: unknown): ChatSseParsedEvent {
  if (!payload || typeof payload !== 'object') return undefined;
  const p = payload as Record<string, unknown>;
  const stage = sseStringField(p.stage);
  const agentName = sseOptionalStringField(p.agent_name);
  if (stage === 'start') {
    const name = sseStringField(p.name);
    const id = sseStringField(p.id);
    if (!name || !id) return undefined;
    return { type: 'tool', payload: { stage: 'start', name, id, args: p.args, agent_name: agentName } };
  }
  if (stage === 'result') {
    const id = sseStringField(p.id);
    if (!id) return undefined;
    return {
      type: 'tool',
      payload: { stage: 'result', id, result: p.result, agent_name: agentName },
    };
  }
  if (stage === 'error') {
    const id = sseStringField(p.id);
    if (!id) return undefined;
    return {
      type: 'tool',
      payload: {
        stage: 'error',
        id,
        error: typeof p.error === 'string' ? p.error : String(p.error ?? ''),
        agent_name: agentName,
      },
    };
  }
  if (stage === 'authorize') {
    const id = sseStringField(p.id);
    if (!id) return undefined;
    return {
      type: 'tool',
      payload: {
        stage: 'authorize',
        id,
        agent_name: agentName,
      },
    };
  }
  return undefined;
}

/** Maps SSE ``event:`` name to normalized stream events. */
const CHAT_SSE_TYPED_EVENT_PARSERS = {
  delta: (payload) => {
    const parsed = parseTextPayload(payload);
    return parsed ? { type: 'delta', payload: parsed } : undefined;
  },
  reasoning: (payload) => {
    const parsed = parseTextPayload(payload);
    return parsed ? { type: 'reasoning', payload: parsed } : undefined;
  },
  done: () => ({ type: 'done' }),
  error: (payload) => ({
    type: 'error',
    payload: typeof payload === 'string' && payload.length > 0 ? payload : '流式错误',
  }),
  message_ids: (payload) => {
    if (!payload || typeof payload !== 'object') return undefined;
    const p = payload as Record<string, unknown>;
    return {
      type: 'message_ids',
      payload: {
        user: sseStringField(p.user),
        assistant: sseStringField(p.assistant),
      },
    };
  },
  tool: (payload) => parseToolPayload(payload),
} satisfies Record<string, (payload: unknown) => ChatSseParsedEvent>;

type ChatSseEventType = keyof typeof CHAT_SSE_TYPED_EVENT_PARSERS;

function parseAgentChatSseBlock(block: string): ChatSseParsedEvent {
  const rawLines = block.split('\n');
  let sseEventType: string | undefined;
  const dataLines: string[] = [];
  for (const line of rawLines) {
    if (line.startsWith('event:')) {
      sseEventType = line.replace(/^event:\s?/, '').trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.replace(/^data:\s?/, '').trimEnd());
    }
  }

  if (!sseEventType || !Object.hasOwn(CHAT_SSE_TYPED_EVENT_PARSERS, sseEventType)) {
    return undefined;
  }
  const json = dataLines.join('\n');
  let payload: unknown;
  try {
    payload = json === '' ? undefined : JSON.parse(json);
  } catch {
    return undefined;
  }
  return CHAT_SSE_TYPED_EVENT_PARSERS[sseEventType as ChatSseEventType](payload);
}

export type AgentChatStreamOptions = {
  /** 首包：本轮 user / assistant 消息在服务端持久化所用的 id（用于替换乐观 key）。 */
  onMessageIds?: (payload: { user: string; assistant: string }) => void;
  onDelta: (payload: { text: string; agent_name?: string }) => void;
  onReasoning?: (payload: { text: string; agent_name?: string }) => void;
  onToolStart?: (payload: { name: string; id: string; args?: unknown; agent_name?: string }) => void;
  onToolResult?: (payload: { id: string; result: unknown }) => void;
  onToolError?: (payload: { id: string; error: string }) => void;
  onToolAuthorize?: (payload: { id: string }) => void;
  signal?: AbortSignal;
};

/** @returns ``true`` to keep reading the stream; ``false`` when a terminal ``done`` event was handled. */
// eslint-disable-next-line complexity
function handleParsedAgentChatSseEvent(ev: ChatSseParsedEvent, options: AgentChatStreamOptions): boolean {
  if (ev === undefined) return true;
  if (ev.type === 'error') throw new ApiError(ev.payload, 502);
  if (ev.type === 'done') return false;
  if (ev.type === 'delta') {
    options.onDelta(ev.payload);
    return true;
  }
  if (ev.type === 'reasoning') {
    options.onReasoning?.(ev.payload);
    return true;
  }
  if (ev.type === 'message_ids') {
    options.onMessageIds?.(ev.payload);
    return true;
  }
  if (ev.type !== 'tool') return true;
  const { stage } = ev.payload;
  if (stage === 'start') {
    options.onToolStart?.({
      name: ev.payload.name,
      id: ev.payload.id,
      args: ev.payload.args,
      agent_name: ev.payload.agent_name,
    });
    return true;
  }
  if (stage === 'result') {
    options.onToolResult?.({
      id: ev.payload.id,
      result: ev.payload.result,
    });
    return true;
  }
  if (stage === 'authorize') {
    options.onToolAuthorize?.({
      id: ev.payload.id,
    });
    return true;
  }
  options.onToolError?.({
    id: ev.payload.id,
    error: ev.payload.error ?? '',
  });
  return true;
}

/**
 * POST ``/chat/message`` (SSE). Wire: ``event:`` + payload-only ``data:`` (see ``app.chat`` controller stream).
 */
export async function postAgentChatStream(body: ChatRequestPublic, options: AgentChatStreamOptions): Promise<void> {
  const url = `${getQuantAgentApiBase()}/chat/message`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(parseDetail(text), res.status);
  }
  const reader = res.body?.getReader();
  if (!reader) {
    throw new ApiError('响应无正文', res.status || 502);
  }
  const decoder = new TextDecoder();
  let buffer = '';

  const flushBuffer = (): boolean => {
    // SSE events are separated by a blank line (\n\n).
    while (true) {
      const idxLF = buffer.indexOf('\n\n');
      if (idxLF === -1) return true;
      const block = buffer.slice(0, idxLF).trim();
      buffer = buffer.slice(idxLF + 2);
      if (!block) continue;

      const ev = parseAgentChatSseBlock(block);
      const keepGoing = handleParsedAgentChatSseEvent(ev, options);
      if (!keepGoing) return false;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;
    buffer += decoder.decode(value, { stream: true });
    const keepGoing = flushBuffer();
    if (!keepGoing) return;
  }

  // Flush any remaining decoder state and buffered events.
  buffer += decoder.decode();
  flushBuffer();
}

export async function postAgentChatAuthorize(body: {
  session_id: string;
  assistant_message_id: string;
  decisions: Array<{ type: 'approve' | 'reject'; tool_call_id: string }>;
}): Promise<void> {
  const url = `${getQuantAgentApiBase()}/chat/authorize`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(parseDetail(text), res.status);
  }
}

export function listAgentChats(): Promise<ChatSummaryPublic[]> {
  return apiFetchJson<ChatSummaryPublic[]>('/chat');
}

export function listArchivedAgentChats(): Promise<ChatArchivedSummaryPublic[]> {
  return apiFetchJson<ChatArchivedSummaryPublic[]>('/chat/archived');
}

export function restoreAgentChat(id: string): Promise<ChatDetailPublic> {
  return apiFetchJson<ChatDetailPublic>(`/chat/${encodeURIComponent(id)}/restore`, { method: 'POST' });
}

export function purgeArchivedAgentChat(id: string): Promise<void> {
  return apiFetchJson<void>(`/chat/${encodeURIComponent(id)}/archived`, {
    method: 'DELETE',
  });
}

export function createAgentChat(body: ChatCreateBody): Promise<ChatDetailPublic> {
  return apiFetchJson<ChatDetailPublic>('/chat', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getAgentChat(id: string): Promise<ChatDetailPublic> {
  return apiFetchJson<ChatDetailPublic>(`/chat/${encodeURIComponent(id)}`);
}

export function renameAgentChat(id: string, body: ChatRenameBody): Promise<ChatDetailPublic> {
  return apiFetchJson<ChatDetailPublic>(`/chat/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function archiveAgentChat(id: string): Promise<void> {
  return apiFetchJson<void>(`/chat/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function batchUpdateAgentChats(body: ChatBatchUpdateBody): Promise<ChatBatchUpdateResult> {
  return apiFetchJson<ChatBatchUpdateResult>('/chat/batch/update', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function batchDeleteAgentChats(body: ChatBatchDeleteBody): Promise<ChatBatchDeleteResult> {
  return apiFetchJson<ChatBatchDeleteResult>('/chat/batch/delete', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
