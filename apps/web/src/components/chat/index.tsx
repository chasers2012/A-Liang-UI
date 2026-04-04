"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  activeLastAssistantLayoutSignatureAtom,
  activeUserMessageIdsAtom,
  chatErrorAtom,
  chatHydratedAtom,
  chatIsSendingAtom,
  hydrateChatStateAtom,
  openSegmentsAtom,
} from "@/models/chat/session.atom";
import { AiChatComposer } from "@/components/chat/chat-composer";
import { AiChatMessages } from "@/components/chat/chat-messages";
import { ChatSessionTabs } from "@/components/chat/chat-session-tabs";



export function HomeAiChat() {
  const errorText = useAtomValue(chatErrorAtom);
  const hydrated = useAtomValue(chatHydratedAtom);
  const userMessageIds = useAtomValue(activeUserMessageIdsAtom);
  const isSending = useAtomValue(chatIsSendingAtom);
  const lastAssistantLayoutSig = useAtomValue(activeLastAssistantLayoutSignatureAtom);
  const setOpenSegments = useSetAtom(openSegmentsAtom);
  const hydrate = useSetAtom(hydrateChatStateAtom);
  const bottomRef = useRef<HTMLDivElement>(null);


  const scrollToBottom = useCallback(() => {
    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({ behavior: "auto", block: 'nearest' });
  }, []);

  useEffect(() => {
    if (hydrated) return;
    void hydrate();
  }, [hydrate, hydrated]);

  useLayoutEffect(() => {
    if (!hydrated) return;
    scrollToBottom();
  }, [hydrated, isSending, userMessageIds, lastAssistantLayoutSig, scrollToBottom]);


  useEffect(() => {
    if (!userMessageIds.length) return;

    const latestIds = new Set(userMessageIds.slice(-5));
    setOpenSegments((prev) => {
      const next = { ...prev };
      for (const mid of userMessageIds) {
        next[mid] = latestIds.has(mid);
      }
      return next;
    });
    setTimeout(() => {
      scrollToBottom();
    }, 300);

  }, [scrollToBottom, setOpenSegments, userMessageIds]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <ChatSessionTabs />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className=" overflow-y-auto overflow-x-hidden h-full w-full">
          <div className="flex w-full min-w-0 flex-col gap-3 p-6 pl-9 ">
            <AiChatMessages />
            <div ref={bottomRef} className=" h-0 w-full" />
          </div>
        </div>
        {errorText ? (
          <p className="shrink-0 px-6 text-sm text-destructive" role="alert">
            {errorText}
          </p>
        ) : null}
        <div className="shrink-0 px-6 pb-6">
          <AiChatComposer />
        </div>
      </div>
    </div>
  );
}
