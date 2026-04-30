'use client';

import { memo, type MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Check, ChevronDown, ChevronUp, PencilLine, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { activeSessionIdAtom, chatIsSendingAtom, resendChatMessageAtom } from '@/models/chat';
import { cn } from '@/lib/utils';

export const ChatMessageUserContent = memo(function ChatMessageUserContent({
  mid,
  text,
}: {
  mid: string;
  text: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [draftText, setDraftText] = useState(text);
  const [isTextOverflowing, setIsTextOverflowing] = useState(false);
  const sessionId = useAtomValue(activeSessionIdAtom);
  const isChatSending = useAtomValue(chatIsSendingAtom);
  const resend = useSetAtom(resendChatMessageAtom);
  const measureContainerRef = useRef<HTMLDivElement>(null);
  const fullMeasureRef = useRef<HTMLParagraphElement>(null);
  const clampMeasureRef = useRef<HTMLParagraphElement>(null);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current == null) return;
    window.clearTimeout(openTimerRef.current);
    openTimerRef.current = null;
  }, []);
  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current == null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);
  const openActionPopover = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    if (isEditing) {
      setIsActionOpen(true);
      return;
    }
    openTimerRef.current = window.setTimeout(() => {
      setIsActionOpen(true);
      openTimerRef.current = null;
    }, 300);
  }, [clearCloseTimer, clearOpenTimer, isEditing]);
  const closeActionPopover = useCallback(() => {
    if (isEditing) return;
    clearOpenTimer();
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setIsActionOpen(false);
      closeTimerRef.current = null;
    }, 300);
  }, [clearCloseTimer, clearOpenTimer, isEditing]);

  const handleStartEdit = useCallback(
    (ev: MouseEvent<HTMLButtonElement>) => {
      ev.stopPropagation();
      clearOpenTimer();
      clearCloseTimer();
      setIsActionOpen(true);
      setDraftText(text);
      setIsEditing(true);
    },
    [clearCloseTimer, clearOpenTimer, text],
  );

  const handleCancelEdit = useCallback(
    (ev: MouseEvent<HTMLButtonElement>) => {
      ev.stopPropagation();
      setDraftText(text);
      setIsEditing(false);
      setIsActionOpen(false);
    },
    [text],
  );

  const handleResendEdited: (ev: MouseEvent<HTMLButtonElement>) => void = useCallback(
    (ev: MouseEvent<HTMLButtonElement>) => {
      ev.stopPropagation();
      const trimmed = draftText.trim();
      if (!sessionId || !trimmed || isChatSending) return;
      void resend({ sessionId, replaceFromMessageId: mid, text: trimmed });
      setIsEditing(false);
      setIsActionOpen(false);
    },
    [draftText, isChatSending, mid, resend, sessionId],
  );

  const disableResend = !sessionId || !draftText.trim() || isChatSending;
  const checkTextOverflow = useCallback(() => {
    const fullHeight = fullMeasureRef.current?.getBoundingClientRect().height ?? 0;
    const clampHeight = clampMeasureRef.current?.getBoundingClientRect().height ?? 0;
    setIsTextOverflowing(fullHeight - clampHeight > 1);
  }, []);

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      checkTextOverflow();
    });
    return () => cancelAnimationFrame(rafId);
  }, [checkTextOverflow, text]);

  useEffect(() => {
    if (!measureContainerRef.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => checkTextOverflow());
    observer.observe(measureContainerRef.current);
    return () => observer.disconnect();
  }, [checkTextOverflow]);
  useEffect(
    () => () => {
      if (openTimerRef.current != null) {
        window.clearTimeout(openTimerRef.current);
      }
      if (closeTimerRef.current != null) {
        window.clearTimeout(closeTimerRef.current);
      }
    },
    [],
  );
  return (
    <Popover
      open={isActionOpen}
      onOpenChange={(nextOpen) => {
        if (isEditing && !nextOpen) return;
        setIsActionOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <div
          className="group-hover/trigger:bg-muted/70 flex min-w-0 flex-1 overflow-hidden rounded-lg border border-border/70 bg-muted/50 text-sm leading-relaxed text-foreground z-20"
          onMouseEnter={openActionPopover}
          onMouseLeave={closeActionPopover}
        >
          <span className="w-1 shrink-0 bg-primary" aria-hidden />
          <div ref={measureContainerRef} className="relative min-w-0 flex-1 px-3 py-2">
            <span className="sr-only">你：</span>
            {isEditing ? (
              <div className="space-y-2" onClick={(ev) => ev.stopPropagation()}>
                <Textarea
                  rows={3}
                  value={draftText}
                  onChange={(ev) => setDraftText(ev.target.value)}
                  onClick={(ev) => ev.stopPropagation()}
                  onKeyDown={(ev) => {
                    if (ev.key !== 'Enter' || ev.shiftKey) return;
                    ev.preventDefault();
                    const trimmed = draftText.trim();
                    if (!sessionId || !trimmed || isChatSending) return;
                    void resend({ sessionId, replaceFromMessageId: mid, text: trimmed });
                    setIsEditing(false);
                    setIsActionOpen(false);
                  }}
                  className="min-h-0 min-w-0 resize-none border-0 bg-transparent px-0 py-0 text-sm leading-relaxed shadow-none focus-visible:ring-0"
                />
              </div>
            ) : (
              <>
                {isTextOverflowing && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 z-10 h-7 px-2"
                    aria-label={isExpanded ? '收起消息' : '展开消息'}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setIsExpanded((prev) => !prev);
                    }}
                  >
                    {isExpanded ? (
                      <ChevronUp className="size-3.5" aria-hidden />
                    ) : (
                      <ChevronDown className="size-3.5" aria-hidden />
                    )}
                  </Button>
                )}
                <p
                  className={cn('whitespace-pre-wrap wrap-break-word', {
                    'line-clamp-3': !isExpanded,
                    'pr-6': isTextOverflowing,
                  })}
                >
                  {text}
                </p>
                <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-0" aria-hidden>
                  <p ref={fullMeasureRef} className="whitespace-pre-wrap wrap-break-word">
                    {text}
                  </p>
                  <p ref={clampMeasureRef} className="line-clamp-3 whitespace-pre-wrap wrap-break-word">
                    {text}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-auto p-0"
        onMouseEnter={openActionPopover}
        onMouseLeave={closeActionPopover}
      >
        <ButtonGroup className="p-0" onClick={(ev) => ev.stopPropagation()}>
          {isEditing ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="取消编辑"
                onClick={handleCancelEdit}
                disabled={isChatSending}
              >
                <X className="size-3.5" aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="default"
                aria-label="重新发送"
                onClick={handleResendEdited}
                disabled={disableResend}
              >
                <Check className="size-3.5" aria-hidden />
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="重新编辑消息"
              onClick={handleStartEdit}
              disabled={isChatSending}
            >
              <PencilLine className="size-3.5" aria-hidden />
            </Button>
          )}
        </ButtonGroup>
      </PopoverContent>
    </Popover>
  );
});
