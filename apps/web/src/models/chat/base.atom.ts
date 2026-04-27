import { atom } from 'jotai';

import { listAgentChats, listArchivedAgentChats } from '@/api/chat';
import { createRefreshableAsyncAtoms } from '@/lib/refreshable-async-atoms';
import { toAsyncValueStateAtom } from '@/lib/loadable';
import type { ChatArchivedSummaryPublic, ChatSummaryPublic } from '@/models/agent-llm/dto';
import { withAtomEffect } from 'jotai-effect';
import { activeSessionIdAtom } from './active-session';

const archivedSessionsAtoms = createRefreshableAsyncAtoms<ChatArchivedSummaryPublic[]>({
  initialValue: [],
  fetcher: async () => {
    return await listArchivedAgentChats();
  },
});

export const archivedSessionsAtom = archivedSessionsAtoms.valueAtom;
export const refreshArchivedSessionsAtom = archivedSessionsAtoms.refreshAtom;

const chatSessionsAtoms = createRefreshableAsyncAtoms<ChatSummaryPublic[]>({
  initialValue: [],
  fetcher: async () => {
    return await listAgentChats();
  },
});
export const asyncChatSessionsAtom = chatSessionsAtoms.asyncAtom;
export const chatSessionsAtom = withAtomEffect(chatSessionsAtoms.valueAtom, (get, set) => {
  const list = get(chatSessionsAtom);
  const activeId = get(activeSessionIdAtom);

  if (list.length === 0) {
    return;
  }
  if (activeId && !list.some((s) => s.id === activeId)) {
    const fallback = list[0]?.id ?? null;
    set(activeSessionIdAtom, fallback);
  }
});
export const chatSessionsLoadingAtom = chatSessionsAtoms.loadingAtom;
export const chatSessionsErrorAtom = chatSessionsAtoms.errorAtom;
export const refreshChatSessionsAtom = chatSessionsAtoms.refreshAtom;

export type ManagedSession = (ChatSummaryPublic | ChatArchivedSummaryPublic) & {
  is_archived: boolean;
  archived_at: string | null;
};

export const managedSessionsAsyncAtom = atom(async (get): Promise<ManagedSession[]> => {
  const [active, archived] = await Promise.all([get(chatSessionsAtom), get(archivedSessionsAtom)]);
  const activeSessions: ManagedSession[] = active.map((session) => ({
    ...session,
    is_archived: false,
    archived_at: null,
  }));
  const archivedSessions: ManagedSession[] = archived.map((session) => ({
    ...session,
    is_archived: true,
    archived_at: session.archived_at,
  }));
  return [...activeSessions, ...archivedSessions].sort((a, b) => {
    const aTs = new Date(a.archived_at ?? a.updated_at).getTime();
    const bTs = new Date(b.archived_at ?? b.updated_at).getTime();
    return bTs - aTs;
  });
});

export const managedSessionsAtom = toAsyncValueStateAtom(managedSessionsAsyncAtom);

export const refreshManagedSessionsAtom = atom(null, (_get, set) => {
  set(refreshChatSessionsAtom);
  set(refreshArchivedSessionsAtom);
});
