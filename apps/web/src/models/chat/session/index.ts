import { atom, type Getter, type Setter } from "jotai";
import { atomFamily } from "jotai-family";
import { startTransition } from "react";

import {
  ApiError,
  archiveAgentChatSession,
  createAgentChatSession,
  listAgentChatSessions,
  postAgentChatStream,
  renameAgentChatSession,
} from "@/lib/quant-agent-api";
import type {
  AgentChatMessagePublic,
  AgentChatSessionSummaryPublic,
} from "@/models";
import {
  chatErrorAtom,
  chatHydratedAtom,
  chatInputAtom,
  chatIsSendingAtom,
  chatSessionsAtom,
} from "./atoms.base";

import { CHAT_DEFAULT_TITLE } from "./constants";
import {
  appendAssistantDelta,
  applyToolStart,
  extractTextFromBlocks,
  patchToolInBlocks,
  summarizeFirstUserMessage,
  toApiMessage,
  upsertSummary,
} from "./helpers";
import {
  activeSessionIdAtom,
  activeUserMessageIdsAtom,
  isActiveChatSessionAtomFamily,
} from "./active-session";
import {
  messagesAtomFamily,
  replieIdOfMessageAtomFamily,
  replyOfMessageAtomFamily,
  sessionDetailAtomFamily,
  sessionUserMessageIdsAtomFamily,
  userMessageReplieIdsAtomFamily,
  userMessageTextAtomFamily,
} from "./session-detail";
import {
  segmentOpenAtomFamily,
  toggleSegmentOpenAtomFamily,
} from "./segment-open";

export {
  activeUserMessageIdsAtom,
  chatErrorAtom,
  chatHydratedAtom,
  chatInputAtom,
  chatIsSendingAtom,
  chatSessionsAtom,
  replieIdOfMessageAtomFamily,
  userMessageReplieIdsAtomFamily,
  messagesAtomFamily,
  replyOfMessageAtomFamily,
  segmentOpenAtomFamily,
  sessionUserMessageIdsAtomFamily,
  toggleSegmentOpenAtomFamily,
  userMessageTextAtomFamily,
  activeSessionIdAtom,
  isActiveChatSessionAtomFamily,
};

/** 按 id 在会话列表中解析摘要；空 id 为 null（供与 activeSessionIdAtom 组合使用） */
export const chatSessionSummaryAtomFamily = atomFamily((sessionId: string) =>
  atom((get): AgentChatSessionSummaryPublic | null => {
    if (!sessionId) return null;
    const sessions = get(chatSessionsAtom);
    return sessions.find((s) => s.id === sessionId) ?? null;
  }),
);

/** 当前激活 id 是否对应列表中的会话；仅在有无有效激活之间变化，切换 tab 时通常保持 true 不触发订阅者更新 */
export const hasValidActiveChatSessionAtom = atom((get) => {
  const id = get(activeSessionIdAtom);
  if (!id) return false;
  return get(chatSessionSummaryAtomFamily(id)) != null;
});

function removeSessionMessageAtoms(
  get: Getter,
  set: Setter,
  sessionId: string,
): void {
  const userIds = get(sessionUserMessageIdsAtomFamily(sessionId));
  if (!userIds?.length) return;

  const removeIds = new Set<string>([
    ...userIds,
    ...userIds.flatMap((uid) => get(userMessageReplieIdsAtomFamily(uid)) ?? []),
  ]);

  for (const id of removeIds) {
    set(messagesAtomFamily(id), undefined);
  }
  for (const uid of userIds) {
    userMessageReplieIdsAtomFamily.remove(uid);
  }
  sessionUserMessageIdsAtomFamily.remove(sessionId);
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

const remapPendingChatMessageIdsAtom = atom(
  null,
  (
    get,
    set,
    payload: {
      sessionId: string;
      fromUser: string;
      toUser: string;
      fromAssistant: string;
      toAssistant: string;
    },
  ) => {
    const { sessionId, fromUser, toUser, fromAssistant, toAssistant } = payload;

    set(
      sessionUserMessageIdsAtomFamily(sessionId),
      (prev) => prev?.map((id) => (id === fromUser ? toUser : id)) ?? [],
    );
    const u = get(messagesAtomFamily(fromUser));
    const a = get(messagesAtomFamily(fromAssistant));
    if (u) set(messagesAtomFamily(toUser), { ...u, id: toUser });
    if (a) set(messagesAtomFamily(toAssistant), { ...a, id: toAssistant });
    set(messagesAtomFamily(fromUser), undefined);
    set(messagesAtomFamily(fromAssistant), undefined);

    const r = get(userMessageReplieIdsAtomFamily(fromUser)) ?? [];
    userMessageReplieIdsAtomFamily.remove(fromUser);
    set(userMessageReplieIdsAtomFamily(toUser), r.length ? [toAssistant] : []);
  },
);

function rollbackOptimisticSend(
  set: Setter,
  targetSessionId: string,
  userId: string,
  assistantId: string,
): void {
  set(sessionUserMessageIdsAtomFamily(targetSessionId), (prev) =>
    (prev ?? []).filter((id) => id !== userId),
  );
  set(messagesAtomFamily(userId), undefined);
  set(messagesAtomFamily(assistantId), undefined);
  userMessageReplieIdsAtomFamily.remove(userId);
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
  let activeId = get(activeSessionIdAtom);
  let nextList = list;

  if (list.length === 0) {
    const created = await createAgentChatSession({ title: CHAT_DEFAULT_TITLE });
    nextList = [
      {
        id: created.id,
        title: created.title,
        created_at: created.created_at,
        updated_at: created.updated_at,
        message_count: created.messages.length,
      },
    ];
    // set(sessionDetailAtomFamily(created.id), created);
    activeId = created.id;
  } else if (!activeId || !list.some((i) => i.id === activeId)) {
    activeId = list[0].id;
  }

  set(chatSessionsAtom, nextList);
  if (activeId) await set(sessionDetailAtomFamily(activeId));
  console.log("activeId", activeId);

  set(activeSessionIdAtom, activeId);
  set(chatHydratedAtom, true);
});

/** 从服务端重新拉取当前会话列表（例如归档恢复后同步首页侧栏）。 */
export const refetchChatSessionsListAtom = atom(null, async (get, set) => {
  set(chatErrorAtom, null);
  try {
    const list = await listAgentChatSessions();
    set(chatSessionsAtom, list);

    const activeId = get(activeSessionIdAtom);
    if (activeId && !list.some((s) => s.id === activeId)) {
      const fallback = list[0]?.id ?? null;
      set(activeSessionIdAtom, fallback);
      if (fallback) set(sessionDetailAtomFamily(fallback));
    }
  } catch (e) {
    set(chatErrorAtom, e instanceof ApiError ? e.message : "刷新会话列表失败");
  }
});

export const selectChatSessionAtom = atom(
  null,
  async (get, set, sessionId: string) => {
    set(activeSessionIdAtom, sessionId);
    startTransition(async () => {
      await set(sessionDetailAtomFamily(sessionId));
      const detail = get(sessionDetailAtomFamily(sessionId));
      if (detail) {
        set(chatSessionsAtom, (prev) => upsertSummary(prev, detail));
      }
    });
  },
);

export const createChatSessionAtom = atom(null, async (get, set) => {
  const detail = await createAgentChatSession({ title: CHAT_DEFAULT_TITLE });
  set(chatSessionsAtom, (prev) => upsertSummary(prev, detail));
  await set(sessionDetailAtomFamily(detail.id));
  set(activeSessionIdAtom, detail.id);
});

export const renameChatSessionAtom = atom(
  null,
  async (get, set, payload: { sessionId: string; title: string }) => {
    const detail = await renameAgentChatSession(payload.sessionId, {
      title: payload.title,
    });
    set(chatSessionsAtom, (prev) => upsertSummary(prev, detail));
    const activeId = get(activeSessionIdAtom);
    if (activeId === payload.sessionId) {
      set(activeSessionIdAtom, detail.id);
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

    if (get(activeSessionIdAtom) !== sessionId) return;

    const fallback = nextSessions[0]?.id ?? null;
    set(activeSessionIdAtom, fallback);
    if (fallback) await set(sessionDetailAtomFamily(fallback));
  },
);

export const sendChatMessageAtom = atom(null, async (get, set) => {
  const trimmed = get(chatInputAtom).trim();
  if (!trimmed || get(chatIsSendingAtom)) return;

  let targetSessionId = get(activeSessionIdAtom);
  if (!targetSessionId) {
    const created = await createAgentChatSession({ title: CHAT_DEFAULT_TITLE });
    set(chatSessionsAtom, (prev) => upsertSummary(prev, created));
    get(sessionDetailAtomFamily(created.id));
    set(activeSessionIdAtom, created.id);
    targetSessionId = created.id;
  }
  if (!targetSessionId) return;
  const sessionId = targetSessionId;

  const sessionSummary =
    get(chatSessionsAtom).find((s) => s.id === sessionId) ?? null;
  const shouldAutoTitle =
    !!sessionSummary &&
    (sessionSummary.title || "").trim() === CHAT_DEFAULT_TITLE &&
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
  set(sessionUserMessageIdsAtomFamily(sessionId), (prev) =>
    (prev ?? []).concat(userTurn.id),
  );
  set(messagesAtomFamily(userTurn.id), userTurn);
  set(messagesAtomFamily(provisionalAssistantId), {
    id: provisionalAssistantId,
    role: "assistant",
    blocks: [],
  });
  set(userMessageReplieIdsAtomFamily(userTurn.id), [provisionalAssistantId]);

  try {
    const payloadMessages = buildPayloadMessages(
      get,
      get(sessionUserMessageIdsAtomFamily(sessionId)) ?? [],
      (uid) => get(userMessageReplieIdsAtomFamily(uid)) ?? [],
      provisionalAssistantId,
      provisionalUserId,
    );

    await postAgentChatStream(
      { session_id: sessionId, messages: payloadMessages },
      {
        onMessageIds: (ids) => {
          if (!ids.user || !ids.assistant) return;
          set(remapPendingChatMessageIdsAtom, {
            sessionId,
            fromUser: streamUserId,
            toUser: ids.user,
            fromAssistant: streamAssistantId,
            toAssistant: ids.assistant,
          });
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
