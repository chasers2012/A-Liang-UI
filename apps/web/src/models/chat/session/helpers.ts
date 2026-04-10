import type {
  AgentChatMessagePublic,
  AgentChatRequestMessage,
  AgentChatDetailPublic,
  AgentChatSummaryPublic,
  AgentChatToolCallPublic,
} from "@/models";
import type { AssistantBlock } from "@/models/chat/types";

export function appendAssistantDelta(
  prev: AgentChatMessagePublic | undefined,
  delta: string,
): AgentChatMessagePublic | undefined {
  if (!prev) return prev;
  const blocks = [...(prev.blocks ?? [])];
  const last = blocks[blocks.length - 1];
  if (last?.kind === "text") {
    blocks[blocks.length - 1] = {
      kind: "text",
      content: last.content + delta,
    };
  } else {
    blocks.push({ kind: "text", content: delta });
  }
  return { ...prev, blocks };
}

export function applyToolStart(
  prev: AgentChatMessagePublic | undefined,
  payload: { name: string; id: string; args?: unknown },
): AgentChatMessagePublic | undefined {
  if (!prev) return prev;
  const call: AgentChatToolCallPublic = {
    id: payload.id,
    name: payload.name,
    args: payload.args,
    status: "running",
  };
  const blocks: AssistantBlock[] = [
    ...(prev.blocks ?? []),
    { kind: "tool", call },
  ];
  return { ...prev, blocks };
}

export function patchToolInBlocks(
  prev: AgentChatMessagePublic | undefined,
  id: string,
  patch: Partial<AgentChatToolCallPublic>,
): AgentChatMessagePublic | undefined {
  if (!prev) return prev;
  const blocks = (prev.blocks ?? []).map((b): AssistantBlock => {
    if (b.kind !== "tool" || b.call.id !== id) return b;
    return { kind: "tool", call: { ...b.call, ...patch } };
  });
  return { ...prev, blocks };
}

export function upsertSummary(
  list: AgentChatSummaryPublic[],
  detail: AgentChatDetailPublic,
): AgentChatSummaryPublic[] {
  const nextSummary: AgentChatSummaryPublic = {
    id: detail.id,
    title: detail.title,
    created_at: detail.created_at,
    updated_at: detail.updated_at,
    message_count: detail.messages.length,
  };
  const filtered = list.filter((i) => i.id !== detail.id);
  return [nextSummary, ...filtered].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  );
}

export function extractTextFromBlocks(
  blocks: AssistantBlock[] | undefined,
): string {
  if (!blocks?.length) return "";
  return blocks
    .filter(
      (b): b is Extract<AssistantBlock, { kind: "text" }> => b.kind === "text",
    )
    .map((b) => b.content)
    .join("");
}

export function summarizeFirstUserMessage(text: string): string {
  const s = text.replace(/\s+/g, " ").trim();
  if (!s) return "新会话";
  const max = 18;
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function toApiMessage(
  turn: AgentChatMessagePublic & { role: "user" },
  omitId?: boolean,
): AgentChatRequestMessage {
  const base: AgentChatRequestMessage = {
    role: "user",
    blocks: turn.blocks ?? [],
  };
  if (omitId) return base;
  return { ...base, id: turn.id };
}
