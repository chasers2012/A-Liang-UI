import { atom, type Getter, type Setter } from "jotai";
import { startTransition } from "react";

import {
  ApiError,
  archiveAgentChatSession,
  createAgentChatSession,
  listAgentChatSessions,
  postAgentChatStream,
  renameAgentChatSession,
} from "@/lib/quant-agent-api";
import type { AgentChatMessagePublic } from "@/models";
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
  chatSessionSummaryAtomFamily,
  hasValidActiveChatSessionAtom,
  isActiveChatSessionAtomFamily,
} from "./active-session";
import {
  messagesAtomFamily,
  removeSessionMessageAtom,
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
import {
  refetchChatSessionsListAtom,
  selectChatSessionAtom,
} from "./session-list";

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
  chatSessionSummaryAtomFamily,
  hasValidActiveChatSessionAtom,
  refetchChatSessionsListAtom,
  selectChatSessionAtom,
};

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

const patchAssistantMessageAtom = atom(
  null,
  (
    get,
    set,
    {
      mid,
      patch,
    }: {
      mid: string;
      patch: (
        message: AgentChatMessagePublic | undefined,
      ) => AgentChatMessagePublic | undefined;
    },
  ) => {
    startTransition(() => {
      const message = get(messagesAtomFamily(mid));
      if (!message) return;
      set(messagesAtomFamily(mid), patch);
    });
  },
);

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

  set(activeSessionIdAtom, activeId);
  set(chatHydratedAtom, true);
});

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
    set(removeSessionMessageAtom, sessionId);

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
          set(patchAssistantMessageAtom, {
            mid: streamAssistantId,
            patch: (message) => appendAssistantDelta(message, delta),
          });
        },
        onToolStart: (payload) => {
          set(patchAssistantMessageAtom, {
            mid: streamAssistantId,
            patch: (message) => applyToolStart(message, payload),
          });
        },
        onToolResult: (payload) => {
          set(patchAssistantMessageAtom, {
            mid: streamAssistantId,
            patch: (message) =>
              patchToolInBlocks(message, payload.id, {
                status: "ok",
                result: payload.result,
              }),
          });
        },
        onToolError: (payload) => {
          set(patchAssistantMessageAtom, {
            mid: streamAssistantId,
            patch: (message) =>
              patchToolInBlocks(message, payload.id, {
                status: "error",
                error: payload.error,
              }),
          });
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
