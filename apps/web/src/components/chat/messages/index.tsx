'use client';

import { memo } from 'react';
import { useAtomValue } from 'jotai';

import { activeUserMessageIdsAtom } from '@/models/chat';

import { ChatMessageCollapsible } from './chat-message-collapsible';

export const AiChatMessages = memo(function AiChatMessages() {
  const userMessageIds = useAtomValue(activeUserMessageIdsAtom);

  return (userMessageIds ?? []).map((mid) => <ChatMessageCollapsible key={mid} mid={mid} />);
});
