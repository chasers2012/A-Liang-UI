import { atom } from "jotai";

import {
  ApiError,
  archiveAgentChatSession,
  createAgentChatSession,
  getAgentChatSession,
  listAgentChatSessions,
  postAgentChatStream,
  renameAgentChatSession,
} from "@/lib/quant-agent-api";
import type {
  AgentChatMessagePublic,
  AgentChatSessionDetailPublic,
  AgentChatSessionSummaryPublic,
  AgentChatToolCallPublic,
} from "@/models";
import type { AssistantBlock } from "@/models/chat/types";

const LAST_ACTIVE_KEY = "quant-agent-chat-last-active-session-id";

export interface ChatTurn extends AgentChatMessagePublic {
  id: string;
}

function appendAssistantDelta(prev: ChatTurn, delta: string): ChatTurn {
  const content = prev.content + delta;
  if (!prev.blocks?.length) {
    return { ...prev, content };
  }
  const blocks = [...prev.blocks];
  const last = blocks[blocks.length - 1];
  if (last.kind === "text") {
    blocks[blocks.length - 1] = {
      kind: "text",
      content: last.content + delta,
    };
  } else {
    blocks.push({ kind: "text", content: delta });
  }
  return { ...prev, content, blocks };
}

function applyToolStart(
  prev: ChatTurn,
  payload: { name: string; id: string; args?: unknown },
): ChatTurn {
  const call: AgentChatToolCallPublic = {
    id: payload.id,
    name: payload.name,
    args: payload.args,
    status: "running",
  };
  const blocks: AssistantBlock[] = prev.blocks?.length
    ? [...prev.blocks, { kind: "tool", call }]
    : [{ kind: "text", content: prev.content }, { kind: "tool", call }];
  return { ...prev, blocks };
}

function patchToolInBlocks(
  prev: ChatTurn,
  id: string,
  patch: Partial<AgentChatToolCallPublic>,
): ChatTurn {
  if (!prev.blocks?.length) return prev;
  const blocks = prev.blocks.map((b): AssistantBlock => {
    if (b.kind !== "tool" || b.call.id !== id) return b;
    return { kind: "tool", call: { ...b.call, ...patch } };
  });
  return { ...prev, blocks };
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toChatTurns(messages: AgentChatMessagePublic[]): ChatTurn[] {
  return messages.map((m) => ({ ...m, id: createId() }));
}

export const chatSessionsAtom = atom<AgentChatSessionSummaryPublic[]>([]);
export const activeChatSessionIdAtom = atom<string | null>(null);
export const chatMessagesBySessionAtom = atom<Record<string, ChatTurn[]>>({});
export const chatInputAtom = atom("");
export const chatIsSendingAtom = atom(false);
export const chatErrorAtom = atom<string | null>(null);
export const chatHydratedAtom = atom(false);

export const activeChatMessagesAtom = atom((get) => {
  const id = get(activeChatSessionIdAtom);
  if (!id) return [] as ChatTurn[];
  return get(chatMessagesBySessionAtom)[id] ?? [];
});

function setLastActiveSessionId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (!id) {
    window.localStorage.removeItem(LAST_ACTIVE_KEY);
    return;
  }
  window.localStorage.setItem(LAST_ACTIVE_KEY, id);
}

function getLastActiveSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LAST_ACTIVE_KEY);
}

function upsertSummary(
  list: AgentChatSessionSummaryPublic[],
  detail: AgentChatSessionDetailPublic,
): AgentChatSessionSummaryPublic[] {
  const nextSummary: AgentChatSessionSummaryPublic = {
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

function summarizeFirstUserMessage(text: string): string {
  const s = text.replace(/\s+/g, " ").trim();
  if (!s) return "新会话";
  const max = 18;
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export const hydrateChatStateAtom = atom(null, async (get, set) => {
  if (get(chatHydratedAtom)) return;
  set(chatErrorAtom, null);
  const list = await listAgentChatSessions();
  let activeId = getLastActiveSessionId();
  let nextList = list;

  if (list.length === 0) {
    const created = await createAgentChatSession({ title: "新会话" });
    nextList = [
      {
        id: created.id,
        title: created.title,
        created_at: created.created_at,
        updated_at: created.updated_at,
        message_count: created.messages.length,
      },
    ];
    set(chatMessagesBySessionAtom, {
      [created.id]: toChatTurns(created.messages),
    });
    activeId = created.id;
  } else if (!activeId || !list.some((i) => i.id === activeId)) {
    activeId = list[0].id;
  }

  set(chatSessionsAtom, nextList);
  set(activeChatSessionIdAtom, activeId);
  setLastActiveSessionId(activeId);
  if (activeId && !get(chatMessagesBySessionAtom)[activeId]) {
    const detail = await getAgentChatSession(activeId);
    set(chatMessagesBySessionAtom, (prev) => ({
      ...prev,
      [activeId as string]: toChatTurns(detail.messages),
    }));
  }
  set(chatHydratedAtom, true);
});

export const selectChatSessionAtom = atom(
  null,
  async (get, set, sessionId: string) => {
    set(activeChatSessionIdAtom, sessionId);
    setLastActiveSessionId(sessionId);
    if (get(chatMessagesBySessionAtom)[sessionId]) return;
    const detail = await getAgentChatSession(sessionId);
    set(chatMessagesBySessionAtom, (prev) => ({
      ...prev,
      [sessionId]: toChatTurns(detail.messages),
    }));
    set(chatSessionsAtom, (prev) => upsertSummary(prev, detail));
  },
);

export const createChatSessionAtom = atom(null, async (_get, set) => {
  const detail = await createAgentChatSession({ title: "新会话" });
  set(chatSessionsAtom, (prev) => upsertSummary(prev, detail));
  set(chatMessagesBySessionAtom, (prev) => ({
    ...prev,
    [detail.id]: toChatTurns(detail.messages),
  }));
  set(activeChatSessionIdAtom, detail.id);
  setLastActiveSessionId(detail.id);
});

export const renameChatSessionAtom = atom(
  null,
  async (get, set, payload: { sessionId: string; title: string }) => {
    const detail = await renameAgentChatSession(payload.sessionId, {
      title: payload.title,
    });
    set(chatSessionsAtom, (prev) => upsertSummary(prev, detail));
    const activeId = get(activeChatSessionIdAtom);
    if (activeId === payload.sessionId) {
      set(activeChatSessionIdAtom, detail.id);
    }
  },
);

export const archiveChatSessionAtom = atom(
  null,
  async (get, set, sessionId: string) => {
    const sessions = get(chatSessionsAtom);
    await archiveAgentChatSession(sessionId);
    const nextSessions = sessions.filter((s) => s.id !== sessionId);
    set(chatSessionsAtom, nextSessions);
    set(chatMessagesBySessionAtom, (prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
    const activeId = get(activeChatSessionIdAtom);
    if (activeId !== sessionId) return;
    const fallback = nextSessions[0]?.id ?? null;
    set(activeChatSessionIdAtom, fallback);
    setLastActiveSessionId(fallback);
    if (fallback && !get(chatMessagesBySessionAtom)[fallback]) {
      const detail = await getAgentChatSession(fallback);
      set(chatMessagesBySessionAtom, (prev) => ({
        ...prev,
        [fallback]: toChatTurns(detail.messages),
      }));
    }
  },
);

export const sendChatMessageAtom = atom(null, async (get, set) => {
  const input = get(chatInputAtom);
  const trimmed = input.trim();
  if (!trimmed || get(chatIsSendingAtom)) return;

  let sessionId = get(activeChatSessionIdAtom);
  if (!sessionId) {
    const created = await createAgentChatSession({ title: "新会话" });
    set(chatSessionsAtom, (prev) => upsertSummary(prev, created));
    set(chatMessagesBySessionAtom, (prev) => ({
      ...prev,
      [created.id]: toChatTurns(created.messages),
    }));
    set(activeChatSessionIdAtom, created.id);
    setLastActiveSessionId(created.id);
    sessionId = created.id;
  }
  if (!sessionId) return;
  const targetSessionId = sessionId;

  const sessionSummary =
    get(chatSessionsAtom).find((s) => s.id === targetSessionId) ?? null;
  const shouldAutoTitle =
    !!sessionSummary &&
    (sessionSummary.title || "").trim() === "新会话" &&
    (sessionSummary.message_count ?? 0) === 0;

  set(chatErrorAtom, null);
  const userTurn: ChatTurn = { id: createId(), role: "user", content: trimmed };
  const assistantId = createId();
  set(chatMessagesBySessionAtom, (prev) => ({
    ...prev,
    [targetSessionId]: [
      ...(prev[targetSessionId] ?? []),
      userTurn,
      { id: assistantId, role: "assistant", content: "" },
    ],
  }));
  set(chatInputAtom, "");
  set(chatIsSendingAtom, true);

  try {
    const turns = get(chatMessagesBySessionAtom)[targetSessionId] ?? [];
    const payloadMessages = turns
      .filter((m) => m.id !== assistantId)
      .map(({ role, content, blocks }) => ({
        role,
        content,
        ...(blocks?.length ? { blocks } : {}),
      }));
    await postAgentChatStream(
      { session_id: targetSessionId, messages: payloadMessages },
      {
        onDelta: (delta) => {
          set(chatMessagesBySessionAtom, (prev) => ({
            ...prev,
            [targetSessionId]: (prev[targetSessionId] ?? []).map((m) =>
              m.id === assistantId ? appendAssistantDelta(m, delta) : m,
            ),
          }));
        },
        onToolStart: (payload) => {
          set(chatMessagesBySessionAtom, (prev) => ({
            ...prev,
            [targetSessionId]: (prev[targetSessionId] ?? []).map((m) =>
              m.id === assistantId ? applyToolStart(m, payload) : m,
            ),
          }));
        },
        onToolResult: (payload) => {
          set(chatMessagesBySessionAtom, (prev) => ({
            ...prev,
            [targetSessionId]: (prev[targetSessionId] ?? []).map((m) =>
              m.id === assistantId
                ? patchToolInBlocks(m, payload.id, {
                    status: "ok",
                    result: payload.result,
                  })
                : m,
            ),
          }));
        },
        onToolError: (payload) => {
          set(chatMessagesBySessionAtom, (prev) => ({
            ...prev,
            [targetSessionId]: (prev[targetSessionId] ?? []).map((m) =>
              m.id === assistantId
                ? patchToolInBlocks(m, payload.id, {
                    status: "error",
                    error: payload.error,
                  })
                : m,
            ),
          }));
        },
      },
    );
    if (shouldAutoTitle) {
      try {
        const title = summarizeFirstUserMessage(trimmed);
        await renameAgentChatSession(targetSessionId, { title });
      } catch {
        // ignore title failures; chat content is already persisted.
      }
    }
    const detail = await getAgentChatSession(targetSessionId);
    set(chatMessagesBySessionAtom, (prev) => ({
      ...prev,
      [targetSessionId]: toChatTurns(detail.messages),
    }));
    set(chatSessionsAtom, (prev) => upsertSummary(prev, detail));
  } catch (e) {
    set(
      chatErrorAtom,
      e instanceof ApiError ? e.message : "请求失败，请检查 API 与网络。",
    );
    set(chatMessagesBySessionAtom, (prev) => ({
      ...prev,
      [targetSessionId]: (prev[targetSessionId] ?? []).filter(
        (m) => m.id !== userTurn.id && m.id !== assistantId,
      ),
    }));
    set(chatInputAtom, trimmed);
  } finally {
    set(chatIsSendingAtom, false);
  }
});
