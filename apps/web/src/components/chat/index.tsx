"use client";

import { useEffect, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";

import { ScrollArea } from "@/components/ui/scroll-area";
import {
  activeChatMessagesAtom,
  chatErrorAtom,
  chatHydratedAtom,
  chatInputAtom,
  chatIsSendingAtom,
  hydrateChatStateAtom,
  sendChatMessageAtom,
} from "@/models/chat/session.atom";
import { AiChatComposer } from "@/components/chat/chat-composer";
import { AiChatMessages } from "@/components/chat/chat-messages";
import { ChatSessionTabs } from "@/components/chat/chat-session-tabs";

export function HomeAiChat() {
  const listRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useAtom(chatInputAtom);
  const messages = useAtomValue(activeChatMessagesAtom);
  const isSending = useAtomValue(chatIsSendingAtom);
  const errorText = useAtomValue(chatErrorAtom);
  const hydrated = useAtomValue(chatHydratedAtom);
  const hydrate = useSetAtom(hydrateChatStateAtom);
  const send = useSetAtom(sendChatMessageAtom);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isSending]);

  useEffect(() => {
    if (hydrated) return;
    void hydrate();
  }, [hydrate, hydrated]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <ChatSessionTabs isBusy={isSending} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
        <ScrollArea
          viewportRef={listRef}
          className="min-h-0 flex-1 pt-2"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          <div className="flex w-full min-w-0 flex-col gap-3 p-6 pl-9">
            <AiChatMessages
              messages={messages}
              isSending={isSending}
            />
          </div>
        </ScrollArea>
        {errorText ? (
          <p className="shrink-0 px-6 text-sm text-destructive" role="alert">
            {errorText}
          </p>
        ) : null}
        <div className="shrink-0 px-6 pb-6">
          <AiChatComposer
            input={input}
            isSending={isSending}
            onInputChange={setInput}
            onSend={() => void send()}
          />
        </div>
      </div>
    </div>
  );
}
