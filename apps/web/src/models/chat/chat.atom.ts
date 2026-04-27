import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

export const chatInputAtom = atom('');
export const chatIsSendingAtom = atom(false);
export const isSessionGeneratingAtomFamily = atomFamily(() => atom(false));
export const chatStreamingReplyIdAtom = atom<string | null>(null);
export const chatAbortControllerAtom = atom<AbortController | null>(null);
export const chatErrorAtom = atom<string | null>(null);
