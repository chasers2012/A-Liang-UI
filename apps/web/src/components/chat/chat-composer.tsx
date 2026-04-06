"use client";

import { memo, useId } from "react";
import { ArrowUp, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { chatInputAtom, chatIsSendingAtom, sendChatMessageAtom } from "@/models/chat/session";
import { useAtom, useAtomValue, useSetAtom } from "jotai";


export const AiChatComposer = memo(function AiChatComposer() {
  const formId = useId();
  const [input, setInput] = useAtom(chatInputAtom);
  const isSending = useAtomValue(chatIsSendingAtom);
  const send = useSetAtom(sendChatMessageAtom);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={formId} className="sr-only">
        输入消息
      </label>
      <div className="flex items-start gap-2">
        <Button
          type="button"
          size="icon"
          aria-label="发送"
          onClick={() => void send()}
          disabled={isSending || !input.trim()}
        >
          {isSending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ArrowUp className="size-4" aria-hidden />
          )}
        </Button>
        <Textarea
          id={formId}
          rows={3}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          value={input}
          disabled={isSending}
          onChange={(ev) => setInput(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key !== "Enter" || ev.shiftKey) return;
            ev.preventDefault();
            void send();
          }}
          className="min-h-18 min-w-0 flex-1 resize-y"
        />
      </div>
    </div>
  );
});
