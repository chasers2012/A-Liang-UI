import { atom, type Getter, type Setter } from "jotai";

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
  AgentChatRequestMessage,
  AgentChatSessionDetailPublic,
  AgentChatSessionSummaryPublic,
  AgentChatToolCallPublic,
  TextBlockPublic,
} from "@/models";
import type { AssistantBlock } from "@/models/chat/types";
import { atomFamily } from "jotai-family";
import { startTransition, type SetStateAction } from "react";

const LAST_ACTIVE_KEY = "quant-agent-chat-last-active-session-id";

function appendAssistantDelta(
  prev: AgentChatMessagePublic,
  delta: string,
): AgentChatMessagePublic {
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

function applyToolStart(
  prev: AgentChatMessagePublic,
  payload: { name: string; id: string; args?: unknown },
): AgentChatMessagePublic {
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

function patchToolInBlocks(
  prev: AgentChatMessagePublic,
  id: string,
  patch: Partial<AgentChatToolCallPublic>,
): AgentChatMessagePublic {
  const blocks = (prev.blocks ?? []).map((b): AssistantBlock => {
    if (b.kind !== "tool" || b.call.id !== id) return b;
    return { kind: "tool", call: { ...b.call, ...patch } };
  });
  return { ...prev, blocks };
}

export const chatSessionsAtom = atom<AgentChatSessionSummaryPublic[]>([]);

/** 写入时同步 localStorage（last active），读仍走单一来源 */
export const activeChatSessionIdAtom = (() => {
  const base = atom<string | null>(null);
  return atom(
    (get) => get(base),
    (get, set, update: SetStateAction<string | null>) => {
      set(base, update);
      setTimeout(() => {
        requestAnimationFrame(() => {
          const next = get(base);
          setLastActiveSessionId(next);
        });

        requestAnimationFrame(() => {
          set(activeUserMessageIdsAtom, () => {
            return get(sessionMessageIdsAtomFamily(get(base)));
          });
        });
        requestAnimationFrame(() => {
          set(openLastFiveSegmentsForNewActiveSessionAtom);
        });
      }, 0);
    },
  );
})();

/**
 * 仅当该会话是否在「当前激活」之间切换时通知订阅者。
 * 用于 tab 项：避免整表订阅 `activeChatSessionIdAtom` 导致切换时 O(n) 重渲染。
 */
export const isActiveChatSessionAtomFamily = atomFamily((sessionId: string) =>
  atom((get) => get(activeChatSessionIdAtom) === sessionId),
);

/** 按 id 在会话列表中解析摘要；空 id 为 null（供与 activeChatSessionIdAtom 组合使用） */
export const chatSessionSummaryAtomFamily = atomFamily((sessionId: string) =>
  atom((get): AgentChatSessionSummaryPublic | null => {
    if (!sessionId) return null;
    const sessions = get(chatSessionsAtom);
    return sessions.find((s) => s.id === sessionId) ?? null;
  }),
);

/** 当前激活 id 是否对应列表中的会话；仅在有无有效激活之间变化，切换 tab 时通常保持 true 不触发订阅者更新 */
export const hasValidActiveChatSessionAtom = atom((get) => {
  const id = get(activeChatSessionIdAtom);
  if (!id) return false;
  return get(chatSessionSummaryAtomFamily(id)) != null;
});
export const chatInputAtom = atom("");
export const chatIsSendingAtom = atom(false);
export const chatErrorAtom = atom<string | null>(null);
export const chatHydratedAtom = atom(false);

export const sessionMessageIdsAtomFamily = atomFamily(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (_sessionId: string | undefined | null) => {
    return atom<string[]>([]);
  },
);

// message id -> AgentChatMessagePublic
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const messagesAtomFamily = atomFamily((_id: string) =>
  atom<AgentChatMessagePublic | undefined>(undefined),
);

// user message id → assistant message ids
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const messageReplieIdsAtomFamily = atomFamily((_id: string) =>
  atom<string[]>([]),
);

export const messageAtomFamily = atomFamily(
  (id: string) => atom((get) => get(messagesAtomFamily(id))),
  (a, b) => a === b,
);

export const replyOfMessageAtomFamily = atomFamily(
  (id: string) =>
    atom((get) => {
      const rid = (get(messageReplieIdsAtomFamily(id)) ?? [])[0];
      if (!rid) {
        return undefined;
      }
      return get(messageAtomFamily(rid));
    }),
  (a, b) => a === b,
);

export const userMessageTextAtomFamily = atomFamily(
  (id: string) =>
    atom((get) =>
      (
        (get(messageAtomFamily(id))?.blocks?.filter((b) => b.kind === "text") ||
          []) as TextBlockPublic[]
      )
        .map((b) => b.content)
        .join(""),
    ),
  (a, b) => a === b,
);

export const messageReplieIdAtomFamily = atomFamily(
  (id: string) => atom((get) => get(messageReplieIdsAtomFamily(id))[0]),
  (a, b) => a === b,
);

/** 当前激活会话下的 segment id 顺序（与每条 user 消息的 id 一致） */
export const activeUserMessageIdsAtom = atom<string[]>([]);

/**
 * 当前会话「最后一条助手回复」内容签名；流式 delta / 工具块更新时变化，
 * 供聊天区在 isSending 期间仍能随内容增高触发跟随滚动。
 */
export const activeLastAssistantLayoutSignatureAtom = atom((get) => {
  const ids = get(activeUserMessageIdsAtom);
  const lastUserId = ids[ids.length - 1];
  if (!lastUserId) return 0;
  const replyId = get(messageReplieIdAtomFamily(lastUserId));
  if (!replyId) return 0;
  const msg = get(messageAtomFamily(replyId));
  const blocks = msg?.blocks;
  if (!blocks?.length) return 0;
  let sig = 0;
  for (const b of blocks) {
    if (b.kind === "text") {
      sig = (sig * 33 + b.content.length) | 0;
    } else {
      const st = b.call.status === "running" ? 1 : 0;
      sig = (sig * 33 + b.call.id.length + st) | 0;
    }
  }
  return sig;
});

/** 折叠状态改为 atomFamily，避免单个 map atom 触发整表订阅 */
export const segmentOpenAtomFamily = atomFamily((id: string) => {
  const base = atom(false);
  return atom(
    (get) => get(base),
    (get, set, update: SetStateAction<boolean>) => {
      startTransition(() => {
        requestAnimationFrame(() => {
          set(base, update);
        });
      });
    },
  );
});

export const toggleSegmentOpenAtomFamily = atomFamily((id: string) => {
  return atom(null, (get, set) => {
    set(segmentOpenAtomFamily(id), (prev) => !prev);
  });
});

const stableDelayMs = 20;
const scrollAfterDomSettles = (target: HTMLElement) => {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const container = document.getElementById("chat-messages-container");
  if (!container) return;
  const observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: "auto" });
      });
      observer.disconnect();
      debounceTimer = null;
    }, stableDelayMs);
  });

  observer.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "auto" });
    });
    observer.disconnect();
    debounceTimer = null;
  }, stableDelayMs);
};

const openLastFiveSegmentsForNewActiveSessionAtom = atom(null, (get, set) => {
  const activeSession = get(activeChatSessionIdAtom);
  if (!activeSession) return;
  const userMessageIds = get(sessionMessageIdsAtomFamily(activeSession));
  if (!userMessageIds?.length) return;
  const lastFiveMessageIds = userMessageIds.slice(-1);
  startTransition(() => {
    for (const messageId of lastFiveMessageIds) {
      set(segmentOpenAtomFamily(messageId), true);
    }
    const lastUserMessageId = userMessageIds[userMessageIds.length - 1];
    if (!lastUserMessageId) return;

    const targetId = `reply-${lastUserMessageId}-end`;

    const existing = document.getElementById(targetId);
    if (existing) {
      scrollAfterDomSettles(existing);
      return;
    }

    const appearObserver = new MutationObserver(() => {
      const el = document.getElementById(targetId);
      if (!el) return;
      appearObserver.disconnect();
      scrollAfterDomSettles(el);
    });
    const container = document.getElementById("chat-messages-container");
    if (!container) return;
    appearObserver.observe(container, {
      childList: true,
      subtree: true,
    });
  });
});

function replaceSessionTurns(
  get: Getter,
  set: Setter,
  sessionId: string,
  turns: AgentChatMessagePublic[],
): void {
  const userIds: string[] = [];
  const prevUserIds = get(sessionMessageIdsAtomFamily(sessionId));

  for (const uid of prevUserIds ?? []) {
    set(messagesAtomFamily(uid), undefined);
    const ridList = get(messageReplieIdsAtomFamily(uid)) ?? [];
    for (const rid of ridList) {
      set(messagesAtomFamily(rid), undefined);
    }
    messageReplieIdsAtomFamily.remove(uid);
  }

  let i = 0;
  while (i < turns.length) {
    const m = turns[i];
    if (m.role !== "user") {
      i += 1;
      continue;
    }

    userIds.push(m.id);
    set(messagesAtomFamily(m.id), m);

    const next = turns[i + 1];
    if (next?.role === "assistant") {
      set(messagesAtomFamily(next.id), next);
      set(messageReplieIdsAtomFamily(m.id), [next.id]);
      i += 2;
      continue;
    }

    set(messageReplieIdsAtomFamily(m.id), []);
    i += 1;
  }

  set(sessionMessageIdsAtomFamily(sessionId), userIds);
}

function removeSessionMessageAtoms(
  get: Getter,
  set: Setter,
  sessionId: string,
): void {
  const userIds = get(sessionMessageIdsAtomFamily(sessionId));
  if (!userIds?.length) return;

  const removeIds = new Set<string>([
    ...userIds,
    ...userIds.flatMap((uid) => get(messageReplieIdsAtomFamily(uid)) ?? []),
  ]);

  for (const id of removeIds) {
    set(messagesAtomFamily(id), undefined);
  }
  for (const uid of userIds) {
    messageReplieIdsAtomFamily.remove(uid);
  }
  sessionMessageIdsAtomFamily.remove(sessionId);
}

export const sessionMessagesLoadedAtomFamily = atomFamily((sessionId: string) =>
  atom(() => new Set(sessionMessageIdsAtomFamily.getParams()).has(sessionId)),
);

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

function extractTextFromBlocks(blocks: AssistantBlock[] | undefined): string {
  if (!blocks?.length) return "";
  return blocks
    .filter(
      (b): b is Extract<AssistantBlock, { kind: "text" }> => b.kind === "text",
    )
    .map((b) => b.content)
    .join("");
}

function summarizeFirstUserMessage(text: string): string {
  const s = text.replace(/\s+/g, " ").trim();
  if (!s) return "新会话";
  const max = 18;
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

async function ensureSessionTurnsLoaded(
  get: Getter,
  set: Setter,
  sessionId: string,
): Promise<AgentChatSessionDetailPublic | null> {
  if (get(sessionMessagesLoadedAtomFamily(sessionId))) return null;
  const detail = await getAgentChatSession(sessionId);
  replaceSessionTurns(get, set, sessionId, detail.messages);
  return detail;
}

function toApiMessage(
  turn: AgentChatMessagePublic,
  omitId?: boolean,
): AgentChatRequestMessage {
  const base: AgentChatRequestMessage = {
    role: turn.role,
    blocks: turn.blocks ?? [],
  };
  if (omitId) return base;
  return { ...base, id: turn.id };
}

function buildPayloadMessages(
  get: Getter,
  userIds: string[],
  getReplies: (userId: string) => string[],
  optimisticAssistantId: string,
  pendingLocalUserId: string,
) {
  return userIds.flatMap((uid) => {
    const user = get(messagesAtomFamily(uid));
    if (!user) return [];

    const userPart = toApiMessage(user, uid === pendingLocalUserId);
    const firstReplyId = (getReplies(uid) ?? [])[0];
    if (!firstReplyId || firstReplyId === optimisticAssistantId)
      return [userPart];

    const assistant = get(messagesAtomFamily(firstReplyId));
    if (!assistant) return [userPart];

    return [userPart, toApiMessage(assistant)];
  });
}

function remapPendingChatMessageIds(
  get: Getter,
  set: Setter,
  sessionId: string,
  fromUser: string,
  toUser: string,
  fromAssistant: string,
  toAssistant: string,
): void {
  set(
    sessionMessageIdsAtomFamily(sessionId),
    (prev) => prev?.map((id) => (id === fromUser ? toUser : id)) ?? [],
  );
  const u = get(messagesAtomFamily(fromUser));
  const a = get(messagesAtomFamily(fromAssistant));
  if (u) {
    set(messagesAtomFamily(toUser), { ...u, id: toUser });
  }
  if (a) {
    set(messagesAtomFamily(toAssistant), { ...a, id: toAssistant });
  }
  set(messagesAtomFamily(fromUser), undefined);
  set(messagesAtomFamily(fromAssistant), undefined);

  const r = get(messageReplieIdsAtomFamily(fromUser)) ?? [];
  messageReplieIdsAtomFamily.remove(fromUser);
  set(messageReplieIdsAtomFamily(toUser), r.length ? [toAssistant] : []);
  // set(segmentOpenAtomFamily, (prev) => {
  //   if (!(fromUser in prev)) return prev;
  //   const { [fromUser]: wasOpen, ...rest } = prev;
  //   return { ...rest, [toUser]: wasOpen };
  // });
}

function rollbackOptimisticSend(
  set: Setter,
  targetSessionId: string,
  userId: string,
  assistantId: string,
): void {
  set(sessionMessageIdsAtomFamily(targetSessionId), (prev) =>
    (prev ?? []).filter((id) => id !== userId),
  );
  set(messagesAtomFamily(userId), undefined);
  set(messagesAtomFamily(assistantId), undefined);
  messageReplieIdsAtomFamily.remove(userId);
}

function patchAssistantMessage(
  get: Getter,
  set: Setter,
  assistantId: string,
  patch: (assistant: AgentChatMessagePublic) => AgentChatMessagePublic,
): void {
  startTransition(() => {
    const assistant = get(messagesAtomFamily(assistantId));
    if (!assistant) return;
    const newAssistant = patch(assistant);
    set(messagesAtomFamily(assistantId), newAssistant);
  });
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
    replaceSessionTurns(get, set, created.id, created.messages);
    activeId = created.id;
  } else if (!activeId || !list.some((i) => i.id === activeId)) {
    activeId = list[0].id;
  }

  set(chatSessionsAtom, nextList);
  set(activeChatSessionIdAtom, activeId);
  if (activeId && !get(sessionMessagesLoadedAtomFamily(activeId))) {
    const detail = await getAgentChatSession(activeId);
    replaceSessionTurns(get, set, activeId, detail.messages);
  }
  set(chatHydratedAtom, true);
});

/** 从服务端重新拉取当前会话列表（例如归档恢复后同步首页侧栏）。 */
export const refetchChatSessionsListAtom = atom(null, async (get, set) => {
  set(chatErrorAtom, null);
  try {
    const list = await listAgentChatSessions();
    set(chatSessionsAtom, list);

    const activeId = get(activeChatSessionIdAtom);
    if (activeId && !list.some((s) => s.id === activeId)) {
      const fallback = list[0]?.id ?? null;
      set(activeChatSessionIdAtom, fallback);
      if (fallback) await ensureSessionTurnsLoaded(get, set, fallback);
    }
  } catch (e) {
    set(chatErrorAtom, e instanceof ApiError ? e.message : "刷新会话列表失败");
  }
});

export const selectChatSessionAtom = atom(
  null,
  async (get, set, sessionId: string) => {
    set(activeChatSessionIdAtom, sessionId);
    startTransition(async () => {
      const detail = await ensureSessionTurnsLoaded(get, set, sessionId);
      if (detail) {
        set(chatSessionsAtom, (prev) => upsertSummary(prev, detail));
      }
    });
  },
);

export const createChatSessionAtom = atom(null, async (get, set) => {
  const detail = await createAgentChatSession({ title: "新会话" });
  set(chatSessionsAtom, (prev) => upsertSummary(prev, detail));
  replaceSessionTurns(get, set, detail.id, detail.messages);
  set(activeChatSessionIdAtom, detail.id);
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
    removeSessionMessageAtoms(get, set, sessionId);

    if (get(activeChatSessionIdAtom) !== sessionId) return;

    const fallback = nextSessions[0]?.id ?? null;
    set(activeChatSessionIdAtom, fallback);
    if (fallback) await ensureSessionTurnsLoaded(get, set, fallback);
  },
);

export const sendChatMessageAtom = atom(null, async (get, set) => {
  const trimmed = get(chatInputAtom).trim();
  if (!trimmed || get(chatIsSendingAtom)) return;

  let targetSessionId = get(activeChatSessionIdAtom);
  if (!targetSessionId) {
    const created = await createAgentChatSession({ title: "新会话" });
    set(chatSessionsAtom, (prev) => upsertSummary(prev, created));
    replaceSessionTurns(get, set, created.id, created.messages);
    set(activeChatSessionIdAtom, created.id);
    targetSessionId = created.id;
  }
  if (!targetSessionId) return;
  const sessionId = targetSessionId;

  const sessionSummary =
    get(chatSessionsAtom).find((s) => s.id === sessionId) ?? null;
  const shouldAutoTitle =
    !!sessionSummary &&
    (sessionSummary.title || "").trim() === "新会话" &&
    (sessionSummary.message_count ?? 0) === 0;

  const provisionalUserId = crypto.randomUUID();
  const provisionalAssistantId = crypto.randomUUID();
  const userTurn: AgentChatMessagePublic = {
    id: provisionalUserId,
    role: "user",
    blocks: [{ kind: "text", content: trimmed }],
  };
  let streamUserId = provisionalUserId;
  let streamAssistantId = provisionalAssistantId;

  set(chatErrorAtom, null);
  set(chatInputAtom, "");
  set(chatIsSendingAtom, true);
  set(sessionMessageIdsAtomFamily(sessionId), (prev) =>
    (prev ?? []).concat(userTurn.id),
  );
  set(messagesAtomFamily(userTurn.id), userTurn);
  set(messagesAtomFamily(provisionalAssistantId), {
    id: provisionalAssistantId,
    role: "assistant",
    blocks: [],
  });
  set(messageReplieIdsAtomFamily(userTurn.id), [provisionalAssistantId]);

  try {
    const payloadMessages = buildPayloadMessages(
      get,
      get(sessionMessageIdsAtomFamily(sessionId)) ?? [],
      (uid) => get(messageReplieIdsAtomFamily(uid)) ?? [],
      provisionalAssistantId,
      provisionalUserId,
    );

    await postAgentChatStream(
      { session_id: sessionId, messages: payloadMessages },
      {
        onMessageIds: (ids) => {
          if (!ids.user || !ids.assistant) return;
          remapPendingChatMessageIds(
            get,
            set,
            sessionId,
            streamUserId,
            ids.user,
            streamAssistantId,
            ids.assistant,
          );
          streamUserId = ids.user;
          streamAssistantId = ids.assistant;
        },
        onDelta: (delta) => {
          patchAssistantMessage(get, set, streamAssistantId, (assistant) =>
            appendAssistantDelta(assistant, delta),
          );
        },
        onToolStart: (payload) => {
          patchAssistantMessage(get, set, streamAssistantId, (assistant) =>
            applyToolStart(assistant, payload),
          );
        },
        onToolResult: (payload) => {
          patchAssistantMessage(get, set, streamAssistantId, (assistant) =>
            patchToolInBlocks(assistant, payload.id, {
              status: "ok",
              result: payload.result,
            }),
          );
        },
        onToolError: (payload) => {
          patchAssistantMessage(get, set, streamAssistantId, (assistant) =>
            patchToolInBlocks(assistant, payload.id, {
              status: "error",
              error: payload.error,
            }),
          );
        },
      },
    );

    if (shouldAutoTitle) {
      try {
        await renameAgentChatSession(sessionId, {
          title: summarizeFirstUserMessage(
            extractTextFromBlocks(userTurn.blocks),
          ),
        });
      } catch {
        // ignore title failures; chat content is already persisted.
      }
    }
  } catch (e) {
    set(
      chatErrorAtom,
      e instanceof ApiError ? e.message : "请求失败，请检查 API 与网络。",
    );
    rollbackOptimisticSend(set, sessionId, streamUserId, streamAssistantId);
    set(chatInputAtom, trimmed);
  } finally {
    set(chatIsSendingAtom, false);
  }
});
