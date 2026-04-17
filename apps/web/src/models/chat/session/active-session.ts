import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { sessionUserMessageIdsAtomFamily } from './session-detail';
import { LAST_ACTIVE_KEY } from './constants';
import { withAtomEffect } from 'jotai-effect';
import { atomFamily } from 'jotai-family';
import type { ChatSummaryPublic } from '@/models/agent-llm/dto';
import { chatSessionsAtom } from './session-list';

export const activeUserMessageIdsAtom = atom<string[]>([]);

export const activeSessionIdAtom = withAtomEffect(atomWithStorage<string | null>(LAST_ACTIVE_KEY, null), (get, set) => {
  const next = get(activeSessionIdAtom);
  const ids = get(sessionUserMessageIdsAtomFamily(next));
  setTimeout(() => {
    set(activeUserMessageIdsAtom, () => {
      return ids;
    });
  }, 0);
});

/**
 * 仅当该会话是否在「当前激活」之间切换时通知订阅者。
 * 用于 tab 项：避免整表订阅 `activeSessionIdAtom` 导致切换时 O(n) 重渲染。
 */
export const isActiveChatAtomFamily = atomFamily((sessionId: string) =>
  atom((get) => get(activeSessionIdAtom) === sessionId),
);

/** 按 id 在会话列表中解析摘要；空 id 为 null（供与 activeSessionIdAtom 组合使用） */
export const chatSessionSummaryAtomFamily = atomFamily((sessionId: string | null) =>
  atom((get): ChatSummaryPublic | undefined => {
    const sessions = get(chatSessionsAtom);
    if (!sessionId) return;
    return sessions.find((s) => s.id === sessionId);
  }),
);

/** 当前激活 id 是否对应列表中的会话；仅在有无有效激活之间变化，切换 tab 时通常保持 true 不触发订阅者更新 */
export const hasValidActiveChatAtom = atom((get) => {
  const id = get(activeSessionIdAtom);
  const sessions = get(chatSessionsAtom);
  return sessions.find((s) => s.id === id);
});
