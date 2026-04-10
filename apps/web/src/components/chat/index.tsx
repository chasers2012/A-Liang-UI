"use client";

import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {

  chatErrorAtom,
  chatHydratedAtom,
  hydrateChatStateAtom,
} from "@/models/chat/session";
import { AiChatComposer } from "@/components/chat/chat-composer";
import { AiChatMessages } from "@/components/chat/messages";
import { ChatTabs } from "./tabs";
import { GeneratingIndicator } from "./messages/generating-indicator";
import { AiChartThemeProvider } from "./messages/ai-chat-markdown";
import { MarkdownWarmup } from "./messages/markdown-warmup";


function ChatError() {
  const errorText = useAtomValue(chatErrorAtom);
  if (!errorText) {
    return null
  }
  return <p className="shrink-0 px-6 text-sm text-destructive" role="alert">
    {errorText}
  </p>
}


function HydrateChatState() {
  const hydrated = useAtomValue(chatHydratedAtom);
  const hydrate = useSetAtom(hydrateChatStateAtom);
  useEffect(() => {
    if (hydrated) return;
    void hydrate();
  }, [hydrate, hydrated]);
  return null;
}

export function HomeAiChat() {


  return (
    <div className="flex flex-1 flex-col overflow-hidden w-full h-full">
      <HydrateChatState />
      <ChatTabs />
      <div className="flex flex-1 flex-col gap-3 overflow-hidden">
        <div className="overflow-x-hidden overflow-y-auto w-full relative flex-1">
          <div className="h-3 w-full sticky top-0 left-0 right-0 z-11 bg-background"></div>
          <div id="chat-messages-container" className="w-full flex flex-col gap-3 pb-3 pl-9 pr-3">
            <AiChartThemeProvider>
              <div className="hidden">
                <MarkdownWarmup />
              </div>
              <AiChatMessages />
            </AiChartThemeProvider>
            <GeneratingIndicator />
          </div>
        </div>
        <ChatError />
        <div className="h-fit px-6 pb-6">
          <AiChatComposer />
        </div>
      </div>
    </div>
  );
}
