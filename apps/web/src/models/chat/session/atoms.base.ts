import { atom } from 'jotai';

export const chatInputAtom = atom('');
export const chatIsSendingAtom = atom(false);
export const chatStreamingReplyIdAtom = atom<string | null>(null);

export type ChatAuthorizationState = null | {
  sessionId: string;
  assistantMessageId: string;
  toolCallId?: string;
  request: unknown;
};

export const chatAuthorizationAtom = atom<ChatAuthorizationState>(null);
export type ChatAuthorizationDecisionState = null | {
  assistantMessageId: string;
  toolCallId?: string;
  decision: 'approve' | 'reject';
  request: unknown;
};
export const chatAuthorizationDecisionAtom = atom<ChatAuthorizationDecisionState>(null);
export const chatAbortControllerAtom = atom<AbortController | null>(null);
export const chatErrorAtom = atom<string | null>(null);
