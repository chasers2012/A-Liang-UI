import { atom, type Setter } from 'jotai';

import {
  archiveAgentChat,
  createAgentChat,
  listAgentChats,
  postAgentChatAuthorize,
  postAgentChatStream,
  renameAgentChat,
} from '@/api/chat';
import type { ChatMessagePublic } from '@/models/agent-llm/dto';
import {
  chatAbortControllerAtom,
  chatAuthorizationAtom,
  chatAuthorizationDecisionAtom,
  chatErrorAtom,
  chatHydratedAtom,
  chatInputAtom,
  chatIsSendingAtom,
  chatStreamingReplyIdAtom,
} from './atoms.base';

import { CHAT_DEFAULT_TITLE } from './constants';
import {
  appendAssistantDelta,
  appendAssistantReasoning,
  applyToolStart,
  extractTextFromBlocks,
  patchToolInBlocks,
  summarizeFirstUserMessage,
  toApiMessage,
  upsertSummary,
} from './helpers';
import {
  activeSessionIdAtom,
  activeUserMessageIdsAtom,
  chatSessionSummaryAtomFamily,
  hasValidActiveChatAtom,
  isActiveChatAtomFamily,
} from './active-session';
import {
  messagesAtomFamily,
  isReplyStreamingOfMessageAtomFamily,
  removeSessionMessageAtom,
  replieIdOfMessageAtomFamily,
  replyOfMessageAtomFamily,
  sessionDetailAtomFamily,
  sessionUserMessageIdsAtomFamily,
  userMessageReplieIdsAtomFamily,
  userMessageTextAtomFamily,
} from './session-detail';
import { segmentOpenAtomFamily, toggleSegmentOpenAtomFamily } from './segment-open';
import { chatSessionsAtom, refetchChatsListAtom, selectChatAtom } from './session-list';
import { ApiError } from '@/api/client';

export {
  activeUserMessageIdsAtom,
  chatAbortControllerAtom,
  chatAuthorizationAtom,
  chatAuthorizationDecisionAtom,
  chatErrorAtom,
  chatHydratedAtom,
  chatInputAtom,
  chatIsSendingAtom,
  chatStreamingReplyIdAtom,
  chatSessionsAtom,
  isReplyStreamingOfMessageAtomFamily,
  replieIdOfMessageAtomFamily,
  userMessageReplieIdsAtomFamily,
  messagesAtomFamily,
  replyOfMessageAtomFamily,
  segmentOpenAtomFamily,
  sessionUserMessageIdsAtomFamily,
  toggleSegmentOpenAtomFamily,
  userMessageTextAtomFamily,
  activeSessionIdAtom,
  isActiveChatAtomFamily,
  chatSessionSummaryAtomFamily,
  hasValidActiveChatAtom,
  refetchChatsListAtom,
  selectChatAtom,
};

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

    set(sessionUserMessageIdsAtomFamily(sessionId), (prev) => prev?.map((id) => (id === fromUser ? toUser : id)) ?? []);
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

function rollbackOptimisticSend(set: Setter, targetSessionId: string, userId: string, assistantId: string): void {
  set(sessionUserMessageIdsAtomFamily(targetSessionId), (prev) => (prev ?? []).filter((id) => id !== userId));
  set(messagesAtomFamily(userId), undefined);
  set(messagesAtomFamily(assistantId), undefined);
  userMessageReplieIdsAtomFamily.remove(userId);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function handleSendChatMessageError(
  set: Setter,
  payload: {
    error: unknown;
    hasServerMessageIds: boolean;
    sessionId: string;
    userId: string;
    assistantId: string;
    trimmedInput: string;
  },
): void {
  const { error, hasServerMessageIds, sessionId, userId, assistantId, trimmedInput } = payload;
  if (hasServerMessageIds) return;

  if (!isAbortError(error)) {
    set(chatErrorAtom, error instanceof ApiError ? error.message : '请求失败，请检查 API 与网络。');
  }
  rollbackOptimisticSend(set, sessionId, userId, assistantId);
  set(chatInputAtom, trimmedInput);
}

export const hydrateChatStateAtom = atom(null, async (get, set) => {
  if (get(chatHydratedAtom)) return;
  set(chatErrorAtom, null);
  const list = await listAgentChats();
  let activeId = get(activeSessionIdAtom);
  let nextList = list;

  if (list.length === 0) {
    const created = await createAgentChat({ title: CHAT_DEFAULT_TITLE });
    nextList = [
      {
        id: created.id,
        title: created.title,
        created_at: created.created_at,
        updated_at: created.updated_at,
        message_count: created.messages.length,
      },
    ];
    activeId = created.id;
  } else if (!activeId || !list.some((i) => i.id === activeId)) {
    activeId = list[0].id;
  }
  set(chatSessionsAtom, nextList);
  set(activeSessionIdAtom, activeId);
  if (activeId) await set(sessionDetailAtomFamily(activeId));
  set(chatHydratedAtom, true);
});

export const createChatAtom = atom(null, async (get, set) => {
  const detail = await createAgentChat({ title: CHAT_DEFAULT_TITLE });
  set(chatSessionsAtom, (prev) => upsertSummary(prev, detail));
  await set(sessionDetailAtomFamily(detail.id));
  set(activeSessionIdAtom, detail.id);
});

export const renameChatAtom = atom(null, async (get, set, payload: { sessionId: string; title: string }) => {
  const detail = await renameAgentChat(payload.sessionId, {
    title: payload.title,
  });
  set(chatSessionsAtom, (prev) => upsertSummary(prev, detail));
  const activeId = get(activeSessionIdAtom);
  if (activeId === payload.sessionId) {
    set(activeSessionIdAtom, detail.id);
  }
});

export const archiveChatAtom = atom(null, async (get, set, sessionId: string) => {
  const sessions = get(chatSessionsAtom);
  await archiveAgentChat(sessionId);

  const nextSessions = sessions.filter((s) => s.id !== sessionId);
  set(chatSessionsAtom, nextSessions);
  set(removeSessionMessageAtom, sessionId);

  if (get(activeSessionIdAtom) !== sessionId) return;

  const fallback = nextSessions[0]?.id ?? null;
  set(activeSessionIdAtom, fallback);
  if (fallback) await set(sessionDetailAtomFamily(fallback));
});

export const stopChatMessageAtom = atom(null, (get, set) => {
  if (!get(chatIsSendingAtom)) return;
  get(chatAbortControllerAtom)?.abort();
  set(chatAbortControllerAtom, null);
});

export const sendChatMessageAtom = atom(null, async (get, set) => {
  const trimmed = get(chatInputAtom).trim();
  if (!trimmed || get(chatIsSendingAtom)) return;

  let targetSessionId = get(activeSessionIdAtom);
  if (!targetSessionId) {
    const created = await createAgentChat({ title: CHAT_DEFAULT_TITLE });
    set(chatSessionsAtom, (prev) => upsertSummary(prev, created));
    get(sessionDetailAtomFamily(created.id));
    set(activeSessionIdAtom, created.id);
    targetSessionId = created.id;
  }
  if (!targetSessionId) return;
  const sessionId = targetSessionId;

  const sessionSummary = get(chatSessionsAtom).find((s) => s.id === sessionId) ?? null;
  const shouldAutoTitle =
    !!sessionSummary &&
    (sessionSummary.title || '').trim() === CHAT_DEFAULT_TITLE &&
    (sessionSummary.message_count ?? 0) === 0;

  const provisionalUserId = crypto.randomUUID();
  const provisionalAssistantId = crypto.randomUUID();
  const userTurn: ChatMessagePublic & { role: 'user' } = {
    id: provisionalUserId,
    role: 'user',
    blocks: [{ kind: 'text', content: trimmed }],
  };
  let streamUserId = provisionalUserId;
  let streamAssistantId = provisionalAssistantId;
  let hasServerMessageIds = false;
  const abortController = new AbortController();

  set(chatErrorAtom, null);
  set(chatInputAtom, '');
  set(chatIsSendingAtom, true);
  set(chatAbortControllerAtom, abortController);
  set(chatStreamingReplyIdAtom, provisionalAssistantId);
  set(sessionUserMessageIdsAtomFamily(sessionId), (prev) => (prev ?? []).concat(userTurn.id));
  set(messagesAtomFamily(userTurn.id), userTurn);
  set(messagesAtomFamily(provisionalAssistantId), {
    id: provisionalAssistantId,
    role: 'assistant',
    blocks: [],
  });
  set(userMessageReplieIdsAtomFamily(userTurn.id), [provisionalAssistantId]);

  try {
    const payloadMessage = toApiMessage(userTurn, true);

    await postAgentChatStream(
      { session_id: sessionId, message: payloadMessage },
      {
        signal: abortController.signal,
        onMessageIds: (ids) => {
          if (!ids.user || !ids.assistant) return;
          hasServerMessageIds = true;
          set(remapPendingChatMessageIdsAtom, {
            sessionId,
            fromUser: streamUserId,
            toUser: ids.user,
            fromAssistant: streamAssistantId,
            toAssistant: ids.assistant,
          });
          streamUserId = ids.user;
          streamAssistantId = ids.assistant;
          set(chatStreamingReplyIdAtom, ids.assistant);
        },
        onDelta: (delta) => {
          set(messagesAtomFamily(streamAssistantId), (prev) => appendAssistantDelta(prev, delta));
        },
        onReasoning: (reasoning) => {
          set(messagesAtomFamily(streamAssistantId), (prev) => appendAssistantReasoning(prev, reasoning));
        },
        onToolStart: (payload) => {
          set(messagesAtomFamily(streamAssistantId), (prev) => applyToolStart(prev, payload));
        },
        onToolResult: (payload) => {
          set(messagesAtomFamily(streamAssistantId), (prev) =>
            patchToolInBlocks(prev, payload.id, {
              status: 'ok',
              result: payload.result,
            }),
          );
        },
        onToolError: (payload) => {
          set(messagesAtomFamily(streamAssistantId), (prev) =>
            patchToolInBlocks(prev, payload.id, {
              status: 'error',
              error: payload.error,
            }),
          );
        },
        onToolAuthorize: (payload) => {
          set(chatAuthorizationDecisionAtom, null);
          set(chatAuthorizationAtom, {
            sessionId,
            assistantMessageId: streamAssistantId,
            toolCallId: payload.id,
            request: payload.id ? { tool_call_id: payload.id } : {},
          });
        },
      },
    );

    if (shouldAutoTitle) {
      try {
        await renameAgentChat(sessionId, {
          title: summarizeFirstUserMessage(extractTextFromBlocks(userTurn.blocks)),
        });
      } catch {
        // ignore title failures; chat content is already persisted.
      }
    }
  } catch (e) {
    handleSendChatMessageError(set, {
      error: e,
      hasServerMessageIds,
      sessionId,
      userId: streamUserId,
      assistantId: streamAssistantId,
      trimmedInput: trimmed,
    });
  } finally {
    set(chatAbortControllerAtom, null);
    set(chatIsSendingAtom, false);
    set(chatStreamingReplyIdAtom, null);
  }
});

export const authorizeToolCallAtom = atom(
  null,
  async (
    get,
    set,
    payload: {
      decision: 'approve' | 'reject';
    },
  ) => {
    const auth = get(chatAuthorizationAtom);
    if (!auth) return;
    const { sessionId, assistantMessageId, toolCallId, request } = auth;
    set(chatAuthorizationDecisionAtom, {
      assistantMessageId,
      toolCallId,
      decision: payload.decision,
      request,
    });
    set(chatAuthorizationAtom, null);
    set(chatErrorAtom, null);
    try {
      await postAgentChatAuthorize({
        session_id: sessionId,
        assistant_message_id: assistantMessageId,
        decision: { type: payload.decision },
      });
    } catch (e) {
      if (!isAbortError(e)) {
        set(chatErrorAtom, e instanceof ApiError ? e.message : '授权请求失败，请检查 API 与网络。');
      }
    }
  },
);
