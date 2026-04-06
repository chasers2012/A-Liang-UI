import { atom } from "jotai";

import type { AgentChatSessionArchivedSummaryPublic } from "@/models";

export const archivedSessionsAtom = atom<
  AgentChatSessionArchivedSummaryPublic[] | null
>(null);

export const archiveErrorAtom = atom<string | null>(null);

export const archiveRestoringIdAtom = atom<string | null>(null);

export const archiveDeletingIdAtom = atom<string | null>(null);

export const archiveConfirmDeleteAtom = atom<AgentChatSessionArchivedSummaryPublic | null>(
  null,
);
