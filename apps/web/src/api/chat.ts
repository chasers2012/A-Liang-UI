import type {
  ChatArchivedSummaryPublic,
  ChatCreateBody,
  ChatDetailPublic,
  ChatRenameBody,
  ChatRequestPublic,
  ChatSummaryPublic,
} from "@/models";
import {
  ApiError,
  apiFetchJson,
  getQuantAgentApiBase,
  parseDetail,
} from "./client";

/** Mirrors ``app.chat.events.ToolPayload``. */
type ChatSseToolPayload = {
  stage: "start" | "result" | "error";
  name: string;
  id: string;
  args?: unknown;
  result?: unknown;
  error?: string | null;
};

/** Mirrors ``app.chat.events.MessageIdsPayload``. */
type ChatSseMessageIdsPayload = {
  user: string;
  assistant: string;
};

/**
 * Mirrors ``StreamEvent`` in ``app.chat.events`` (wire JSON: ``type`` + ``payload``).
 * ``done`` may omit ``payload`` (``exclude_none=True`` on the server).
 */
type ChatSseStreamEvent =
  | { type: "message_ids"; payload: ChatSseMessageIdsPayload }
  | { type: "delta"; payload: string }
  | { type: "tool"; payload: ChatSseToolPayload }
  | { type: "done"; payload?: null | undefined }
  | { type: "error"; payload: string };

/** Parse outcome: a wire event, or ``undefined`` when the chunk is ignored / invalid. */
type ChatSseParsedEvent = ChatSseStreamEvent | undefined;

function sseStringField(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function parseToolPayload(payload: unknown): ChatSseParsedEvent {
  if (!payload || typeof payload !== "object") return undefined;
  const p = payload as Record<string, unknown>;
  const stage = sseStringField(p.stage);
  const base = { name: sseStringField(p.name), id: sseStringField(p.id) };
  if (stage === "start") {
    return { type: "tool", payload: { stage: "start", ...base, args: p.args } };
  }
  if (stage === "result") {
    return {
      type: "tool",
      payload: { stage: "result", ...base, result: p.result },
    };
  }
  if (stage === "error") {
    return {
      type: "tool",
      payload: {
        stage: "error",
        ...base,
        error: typeof p.error === "string" ? p.error : String(p.error ?? ""),
      },
    };
  }
  return undefined;
}

/**
 * Mirrors ``app.chat.events.EventType`` wire shape; each SSE line is
 * ``data: {StreamEvent.model_dump_json(exclude_none=true)}`` then blank line, per ``controller.stream``.
 */
const CHAT_SSE_TYPED_EVENT_PARSERS = {
  delta: (payload) =>
    typeof payload === "string" && payload.length > 0
      ? { type: "delta", payload }
      : undefined,
  done: () => ({ type: "done" }),
  error: (payload) => ({
    type: "error",
    payload:
      typeof payload === "string" && payload.length > 0
        ? payload
        : "流式错误",
  }),
  message_ids: (payload) => {
    if (!payload || typeof payload !== "object") return undefined;
    const p = payload as Record<string, unknown>;
    return {
      type: "message_ids",
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
  const dataLines = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace(/^data:\s?/, "").trim());
  if (dataLines.length === 0) return undefined;
  const json = dataLines.join("\n");
  if (!json) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) return undefined;
  const o = parsed as Record<string, unknown>;
  const type = o.type;
  if (
    typeof type !== "string" ||
    !Object.hasOwn(CHAT_SSE_TYPED_EVENT_PARSERS, type)
  ) {
    return undefined;
  }
  return CHAT_SSE_TYPED_EVENT_PARSERS[type as ChatSseEventType](o.payload);
}

export type AgentChatStreamOptions = {
  /** 首包：本轮 user / assistant 消息在服务端持久化所用的 id（用于替换乐观 key）。 */
  onMessageIds?: (payload: { user: string; assistant: string }) => void;
  onDelta: (text: string) => void;
  onToolStart?: (payload: { name: string; id: string; args?: unknown }) => void;
  onToolResult?: (payload: {
    name: string;
    id: string;
    result: unknown;
  }) => void;
  onToolError?: (payload: { name: string; id: string; error: string }) => void;
};

/** @returns ``true`` to keep reading the stream; ``false`` when a terminal ``done`` event was handled. */
function handleParsedAgentChatSseEvent(
  ev: ChatSseParsedEvent,
  options: AgentChatStreamOptions,
): boolean {
  if (ev === undefined) return true;
  if (ev.type === "error") throw new ApiError(ev.payload, 502);
  if (ev.type === "done") return false;
  if (ev.type === "delta") {
    options.onDelta(ev.payload);
    return true;
  }
  if (ev.type === "message_ids") {
    options.onMessageIds?.(ev.payload);
    return true;
  }
  const { stage } = ev.payload;
  if (stage === "start") {
    options.onToolStart?.({
      name: ev.payload.name,
      id: ev.payload.id,
      args: ev.payload.args,
    });
    return true;
  }
  if (stage === "result") {
    options.onToolResult?.({
      name: ev.payload.name,
      id: ev.payload.id,
      result: ev.payload.result,
    });
    return true;
  }
  options.onToolError?.({
    name: ev.payload.name,
    id: ev.payload.id,
    error: ev.payload.error ?? "",
  });
  return true;
}

/**
 * POST ``/chat/message`` (SSE). Same JSON envelope as ``controller.stream`` / ``app.chat.events``.
 * **Contract:** each ``reader.read()`` chunk is one complete SSE event (e.g. ``data: {...}\\n\\n``); no cross-chunk framing.
 */
export async function postAgentChatStream(
  body: ChatRequestPublic,
  options: AgentChatStreamOptions,
): Promise<void> {
  const url = `${getQuantAgentApiBase()}/chat/message`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(parseDetail(text), res.status);
  }
  const reader = res.body?.getReader();
  if (!reader) {
    throw new ApiError("响应无正文", res.status || 502);
  }
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;
    const block = decoder.decode(value);
    const ev = parseAgentChatSseBlock(block);
    const keepGoing = handleParsedAgentChatSseEvent(ev, options);
    if (!keepGoing) return;
  }
}

export function listAgentChats(): Promise<ChatSummaryPublic[]> {
  return apiFetchJson<ChatSummaryPublic[]>("/chat");
}

export function listArchivedAgentChats(): Promise<
  ChatArchivedSummaryPublic[]
> {
  return apiFetchJson<ChatArchivedSummaryPublic[]>("/chat/archived");
}

export function restoreAgentChat(id: string): Promise<ChatDetailPublic> {
  return apiFetchJson<ChatDetailPublic>(
    `/chat/${encodeURIComponent(id)}/restore`,
    { method: "POST" },
  );
}

export function purgeArchivedAgentChat(id: string): Promise<void> {
  return apiFetchJson<void>(`/chat/${encodeURIComponent(id)}/archived`, {
    method: "DELETE",
  });
}

export function createAgentChat(
  body: ChatCreateBody,
): Promise<ChatDetailPublic> {
  return apiFetchJson<ChatDetailPublic>("/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getAgentChat(id: string): Promise<ChatDetailPublic> {
  return apiFetchJson<ChatDetailPublic>(`/chat/${encodeURIComponent(id)}`);
}

export function renameAgentChat(
  id: string,
  body: ChatRenameBody,
): Promise<ChatDetailPublic> {
  return apiFetchJson<ChatDetailPublic>(
    `/chat/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export function archiveAgentChat(id: string): Promise<void> {
  return apiFetchJson<void>(`/chat/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
