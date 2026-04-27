import { atom } from 'jotai';
import { ApiError } from '@/api/client';
import { startTransition } from 'react';
import type { ChatSummaryPublic } from '@/models/agent-llm/dto';
import { upsertSummary } from './helpers';
import { sessionDetailAtomFamily } from './session-detail';
import { activeSessionIdAtom } from './active-session';
import { chatErrorAtom } from './chat.atom';
import { chatSessionsAtom, refreshChatSessionsAtom } from '@/models/chat/base.atom';

export { chatSessionsAtom } from '@/models/chat/base.atom';

/** 从服务端重新拉取当前会话列表（例如归档恢复后同步首页侧栏）。 */
export const refetchChatsListAtom = atom(null, async (get, set) => {
  set(chatErrorAtom, null);
  try {
    set(refreshChatSessionsAtom);
    const list = get(chatSessionsAtom);

    const activeId = get(activeSessionIdAtom);
    if (activeId && !list.some((s) => s.id === activeId)) {
      const fallback = list[0]?.id ?? null;
      set(activeSessionIdAtom, fallback);
      if (fallback) set(sessionDetailAtomFamily(fallback));
    }
  } catch (e) {
    set(chatErrorAtom, e instanceof ApiError ? e.message : '刷新会话列表失败');
  }
});

export const selectChatAtom = atom(null, async (get, set, sessionId: string) => {
  set(activeSessionIdAtom, sessionId);
  startTransition(async () => {
    await set(sessionDetailAtomFamily(sessionId));
    const detail = get(sessionDetailAtomFamily(sessionId));
    if (detail) {
      set(chatSessionsAtom, (prev: ChatSummaryPublic[]) => upsertSummary(prev, detail));
    }
  });
});
