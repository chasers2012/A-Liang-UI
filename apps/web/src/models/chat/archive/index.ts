import { atom } from "jotai";

import {
  ApiError,
  listArchivedAgentChats,
  purgeArchivedAgentChat,
  restoreAgentChat,
} from "@/lib/quant-agent-api";
import {
  refetchChatsListAtom,
  selectChatAtom,
} from "@/models/chat/session";

import {
  archiveConfirmDeleteAtom,
  archiveDeletingIdAtom,
  archiveErrorAtom,
  archivedSessionsAtom,
  archiveRestoringIdAtom,
} from "./atoms.base";

export {
  archiveConfirmDeleteAtom,
  archiveDeletingIdAtom,
  archiveErrorAtom,
  archivedSessionsAtom,
  archiveRestoringIdAtom,
};

export const loadArchivedSessionsAtom = atom(null, async (_get, set) => {
  set(archiveErrorAtom, null);
  try {
    const list = await listArchivedAgentChats();
    set(archivedSessionsAtom, list);
  } catch (e) {
    set(archivedSessionsAtom, []);
    set(
      archiveErrorAtom,
      e instanceof ApiError ? e.message : "加载已归档会话失败，请检查网络与 API。",
    );
  }
});

export const restoreArchivedSessionAtom = atom(
  null,
  async (_get, set, sessionId: string) => {
    set(archiveRestoringIdAtom, sessionId);
    set(archiveErrorAtom, null);
    try {
      await restoreAgentChat(sessionId);
      await set(refetchChatsListAtom);
      await set(selectChatAtom, sessionId);
      set(archivedSessionsAtom, (prev) =>
        prev ? prev.filter((session) => session.id !== sessionId) : prev,
      );
      return { ok: true as const };
    } catch (e) {
      set(
        archiveErrorAtom,
        e instanceof ApiError ? e.message : "恢复会话失败，请稍后重试。",
      );
      return { ok: false as const };
    } finally {
      set(archiveRestoringIdAtom, null);
    }
  },
);

export const purgeArchivedSessionAtom = atom(
  null,
  async (_get, set, sessionId: string) => {
    set(archiveDeletingIdAtom, sessionId);
    set(archiveErrorAtom, null);
    try {
      await purgeArchivedAgentChat(sessionId);
      set(archivedSessionsAtom, (prev) =>
        prev ? prev.filter((session) => session.id !== sessionId) : prev,
      );
      set(archiveConfirmDeleteAtom, null);
    } catch (e) {
      set(
        archiveErrorAtom,
        e instanceof ApiError ? e.message : "删除会话失败，请稍后重试。",
      );
    } finally {
      set(archiveDeletingIdAtom, null);
    }
  },
);
