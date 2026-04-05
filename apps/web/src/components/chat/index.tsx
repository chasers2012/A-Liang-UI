"use client";

import { useEffect, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  activeLastAssistantLayoutSignatureAtom,
  activeUserMessageIdsAtom,
  chatErrorAtom,
  chatHydratedAtom,
  hydrateChatStateAtom,
} from "@/models/chat/session.atom";
import { AiChatComposer } from "@/components/chat/chat-composer";
import { AiChatMessages } from "@/components/chat/messages";
import { ChatSessionTabs } from "./tabs";

const scrollToBottom = (bottomTag: HTMLDivElement | null) => {
  if (!bottomTag) return;
  bottomTag.scrollIntoView({ behavior: "auto", block: 'nearest' });
};

export function HomeAiChat() {
  const errorText = useAtomValue(chatErrorAtom);
  const hydrated = useAtomValue(chatHydratedAtom);
  const userMessageIds = useAtomValue(activeUserMessageIdsAtom);
  const lastAssistantLayoutSig = useAtomValue(activeLastAssistantLayoutSignatureAtom);
  const hydrate = useSetAtom(hydrateChatStateAtom);
  const bottomRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    if (hydrated) return;
    void hydrate();
  }, [hydrate, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    scrollToBottom(bottomRef.current);
  }, [hydrated]);

  useEffect(() => {
    scrollToBottom(bottomRef.current);
  }, [userMessageIds, lastAssistantLayoutSig]);


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
