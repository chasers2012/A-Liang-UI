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

type AgentChatSseParsed =
  | { kind: "delta"; text: string }
  | { kind: "done" }
  | { kind: "error"; message: string }
  | {
      kind: "message_ids";
      payload: { user: string; assistant: string };
    }
  | {
      kind: "tool_start";
      payload: { name: string; id: string; args?: unknown };
    }
  | {
      kind: "tool_result";
      payload: { name: string; id: string; result: unknown };
    }
  | {
      kind: "tool_error";
      payload: { name: string; id: string; error: string };
    }
  | { kind: "skip" };

function sseStringField(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function parseToolPayload(payload: unknown): AgentChatSseParsed {
  if (!payload || typeof payload !== "object") return { kind: "skip" };
  const p = payload as Record<string, unknown>;
  const stage = sseStringField(p.stage);
  const base = {
    name: sseStringField(p.name),
    id: sseStringField(p.id),
  };
  if (stage === "start") {
    return { kind: "tool_start", payload: { ...base, args: p.args } };
  }
  if (stage === "result") {
    return { kind: "tool_result", payload: { ...base, result: p.result } };
  }
  if (stage === "error") {
    return {
      kind: "tool_error",
      payload: {
        ...base,
        error: typeof p.error === "string" ? p.error : String(p.error ?? ""),
      },
    };
  }
  return { kind: "skip" };
}

function parseTypedEvent(type: string, payload: unknown): AgentChatSseParsed {
  switch (type) {
    case "delta":
      return typeof payload === "string" && payload.length > 0
        ? { kind: "delta", text: payload }
        : { kind: "skip" };
    case "done":
      return { kind: "done" };
    case "error":
      return {
        kind: "error",
        message: typeof payload === "string" ? payload : "",
      };
    case "message_ids":
      if (!payload || typeof payload !== "object") return { kind: "skip" };
      return {
        kind: "message_ids",
        payload: {
          user: sseStringField((payload as Record<string, unknown>).user),
          assistant: sseStringField(
            (payload as Record<string, unknown>).assistant,
          ),
        },
      };
    case "tool":
      return parseToolPayload(payload);
    default:
      return { kind: "skip" };
  }
}

function parseAgentChatSsePayloadObject(
  o: Record<string, unknown>,
): AgentChatSseParsed {
  const type = o.type;
  const payload = o.payload;
  if (typeof type !== "string") return { kind: "skip" };
  return parseTypedEvent(type, payload);
}

function parseAgentChatSseBlock(block: string): AgentChatSseParsed {
  const dataLines = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace(/^data:\s?/, "").trim());
  if (dataLines.length === 0) return { kind: "skip" };
  const payload = dataLines.join("\n");
  if (!payload) return { kind: "skip" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return { kind: "skip" };
  }
  if (typeof parsed !== "object" || parsed === null) return { kind: "skip" };
  return parseAgentChatSsePayloadObject(parsed as Record<string, unknown>);
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

/**
 * POST ``/chat/message`` (SSE). Invokes ``onDelta`` for each text chunk; optional tool callbacks; throws ``ApiError`` on HTTP or stream ``error`` events.
 */
function handleParsedAgentChatSseEvent(
  ev: AgentChatSseParsed,
  options: AgentChatStreamOptions,
): "continue" | "done" | "throw" {
  if (ev.kind === "skip") return "continue";
  if (ev.kind === "error") throw new ApiError(ev.message, 502);
  if (ev.kind === "done") return "done";
  if (ev.kind === "delta") {
    options.onDelta(ev.text);
    return "continue";
  }
  if (ev.kind === "message_ids") {
    options.onMessageIds?.(ev.payload);
    return "continue";
  }
  if (ev.kind === "tool_start") {
    options.onToolStart?.(ev.payload);
    return "continue";
  }
  if (ev.kind === "tool_result") {
    options.onToolResult?.(ev.payload);
    return "continue";
  }
  options.onToolError?.(ev.payload);
  return "continue";
}

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
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    for (;;) {
      const sep = buffer.indexOf("\n\n");
      if (sep === -1) break;
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const ev = parseAgentChatSseBlock(block);
      const action = handleParsedAgentChatSseEvent(ev, options);
      if (action === "done") return;
    }
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
