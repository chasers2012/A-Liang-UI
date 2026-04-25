import { atom } from 'jotai';

export const chatInputAtom = atom('');
export const chatIsSendingAtom = atom(false);
export const chatErrorAtom = atom<string | null>(null);
export const chatHydratedAtom = atom(false);
