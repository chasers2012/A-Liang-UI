import { atom } from 'jotai';

export const chatInputAtom = atom('');
export const chatIsSendingAtom = atom(false);
export const chatStreamingReplyIdAtom = atom<string | null>(null);
export const chatAbortControllerAtom = atom<AbortController | null>(null);
export const chatErrorAtom = atom<string | null>(null);
