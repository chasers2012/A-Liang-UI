import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { sessionUserMessageIdsAtomFamily } from "./session-detail";
import { LAST_ACTIVE_KEY } from "./constants";
import { withAtomEffect } from "jotai-effect";
import { atomFamily } from "jotai-family";

export const activeUserMessageIdsAtom = atom<string[]>([]);

export const activeSessionIdAtom = withAtomEffect(
  atomWithStorage<string | null>(LAST_ACTIVE_KEY, null),
  (get, set) => {
    const next = get(activeSessionIdAtom);
    const ids = get(sessionUserMessageIdsAtomFamily(next));
    setTimeout(() => {
      set(activeUserMessageIdsAtom, () => {
        return ids;
      });
    }, 0);
  },
);

/**
 * 仅当该会话是否在「当前激活」之间切换时通知订阅者。
 * 用于 tab 项：避免整表订阅 `activeSessionIdAtom` 导致切换时 O(n) 重渲染。
 */
export const isActiveChatSessionAtomFamily = atomFamily((sessionId: string) =>
  atom((get) => get(activeSessionIdAtom) === sessionId),
);
