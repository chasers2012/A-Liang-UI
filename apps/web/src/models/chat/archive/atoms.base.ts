import { atom } from "jotai";

import type { ChatArchivedSummaryPublic } from "@/models";

export const archivedSessionsAtom = atom<
  ChatArchivedSummaryPublic[] | null
>(null);

export const archiveErrorAtom = atom<string | null>(null);

export const archiveRestoringIdAtom = atom<string | null>(null);

export const archiveDeletingIdAtom = atom<string | null>(null);

export const archiveConfirmDeleteAtom = atom<ChatArchivedSummaryPublic | null>(
  null,
);
