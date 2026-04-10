import { atom } from "jotai";

import type { AgentChatArchivedSummaryPublic } from "@/models";

export const archivedSessionsAtom = atom<
  AgentChatArchivedSummaryPublic[] | null
>(null);

export const archiveErrorAtom = atom<string | null>(null);

export const archiveRestoringIdAtom = atom<string | null>(null);

export const archiveDeletingIdAtom = atom<string | null>(null);

export const archiveConfirmDeleteAtom = atom<AgentChatArchivedSummaryPublic | null>(
  null,
);
