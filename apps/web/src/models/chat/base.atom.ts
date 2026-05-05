import { atom } from 'jotai';

import { listAgentChats, listArchivedAgentChats } from '@/api/chat';
import { createRefreshableAsyncAtoms } from '@/lib/refreshable-async-atoms';
import { toAsyncValueStateAtom } from '@/lib/loadable';
import type { ChatArchivedSummaryPublic, ChatSummaryPublic } from '@/models/agent-llm/dto';
import { withAtomEffect } from 'jotai-effect';
import { activeSessionIdAtom } from './active-session';

export const archivedSessionsAtoms = createRefreshableAsyncAtoms<ChatArchivedSummaryPublic[]>({
  initialValue: [],
  fetcher: async () => {
    return await listArchivedAgentChats();
  },
});

export const chatSessionsAtoms = createRefreshableAsyncAtoms<ChatSummaryPublic[]>({
  initialValue: [],
  fetcher: async () => {
    return await listAgentChats();
  },
});
export const chatSessionsAtom = withAtomEffect(chatSessionsAtoms.valueAtom, (get, set) => {
  const list = get(chatSessionsAtoms.valueAtom);
  const activeId = get(activeSessionIdAtom);

  if (list.length === 0) return;
  if (activeId && !list.some((s) => s.id === activeId)) {
    set(activeSessionIdAtom, list[0]?.id ?? null);
  }
});

export type ManagedSession = (ChatSummaryPublic | ChatArchivedSummaryPublic) & {
  is_archived: boolean;
  archived_at: string | null;
};

export const managedSessionsAsyncAtom = atom(async (get): Promise<ManagedSession[]> => {
  const [active, archived] = await Promise.all([get(chatSessionsAtom), get(archivedSessionsAtoms.valueAtom)]);
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
  return [...activeSessions, ...archivedSessions];
});

export const managedSessionsAtom = toAsyncValueStateAtom(managedSessionsAsyncAtom);

export const refreshManagedSessionsAtom = atom(null, (_get, set) => {
  console.log('refresh');
  set(chatSessionsAtoms.refreshAtom);
  set(archivedSessionsAtoms.refreshAtom);
});
