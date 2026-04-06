import { atom } from "jotai";
import type { AgentChatSessionSummaryPublic } from "@/models";

export const chatSessionsAtom = atom<AgentChatSessionSummaryPublic[]>([]);
export const chatInputAtom = atom("");
export const chatIsSendingAtom = atom(false);
export const chatErrorAtom = atom<string | null>(null);
export const chatHydratedAtom = atom(false);
