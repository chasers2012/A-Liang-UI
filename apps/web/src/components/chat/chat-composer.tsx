'use client';

import { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowUp, LoaderCircle, Square } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { chatInputAtom, chatIsSendingAtom, sendChatMessageAtom, stopChatMessageAtom } from '@/models/chat';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

const STOP_LOCK_MS = 300;

export const AiChatComposer = memo(function AiChatComposer() {
  const formId = useId();
  const [input, setInput] = useAtom(chatInputAtom);
  const isSending = useAtomValue(chatIsSendingAtom);
  const send = useSetAtom(sendChatMessageAtom);
  const stop = useSetAtom(stopChatMessageAtom);
  const [stopLocked, setStopLocked] = useState(false);
  const stopUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (stopUnlockTimerRef.current) {
        clearTimeout(stopUnlockTimerRef.current);
      }
    };
  }, []);

  const handleComposerButtonClick = useCallback(() => {
    if (isSending) {
      stop();
      return;
    }
    if (stopUnlockTimerRef.current) {
      clearTimeout(stopUnlockTimerRef.current);
    }
    setStopLocked(true);
    stopUnlockTimerRef.current = setTimeout(() => {
      setStopLocked(false);
      stopUnlockTimerRef.current = null;
    }, STOP_LOCK_MS);
    void send();
  }, [isSending, send, stop]);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={formId} className="sr-only">
        输入消息
      </label>
      <div className="flex items-start gap-2">
        <Button
          type="button"
          size="icon"
          aria-label={isSending ? '停止生成' : '发送'}
          onClick={handleComposerButtonClick}
          disabled={(!isSending && !input.trim()) || (isSending && stopLocked)}
        >
          {isSending ? (
            stopLocked ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Square className="size-4 fill-current" aria-hidden />
            )
          ) : (
            <ArrowUp className="size-4" aria-hidden />
          )}
        </Button>
        <Textarea
          id={formId}
          rows={3}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          value={input}
          onChange={(ev) => setInput(ev.target.value)}
          onKeyDown={(ev) => {
            if (isSending) return;
            if (ev.key !== 'Enter' || ev.shiftKey) return;
            ev.preventDefault();
            void send();
          }}
          className="min-h-18 min-w-0 flex-1 resize-y max-h-64"
        />
      </div>
    </div>
  );
});
