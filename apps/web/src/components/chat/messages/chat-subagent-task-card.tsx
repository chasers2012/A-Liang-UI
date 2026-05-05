'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, CheckCircle2, ChevronRight, Loader2, XCircle } from 'lucide-react';

import type { AssistantBlock, ChatToolCallDisplay } from '@/models/chat/types';
import { cn } from '@/lib/utils';
import { unescapeUnicode } from 'unescape-unicode';

import { ChatAssistantSingleBlock } from './chat-assistant-single-block';
import { AuthorizationPanel, getPersistedAuthorization } from './chat-tool-call-card';
import { buildAssistantRenderSequence, isSubagentTaskShell, parseTaskToolArgs } from './chat-subagent-task-blocks';

function formatJson(v: unknown): string {
  if (v === undefined) return '';
  try {
    let str = '';
    if (typeof v === 'string') {
      str = JSON.stringify(JSON.parse(v), null, 2);
    } else if (typeof v === 'number') {
      str = String(v);
    } else {
      str = JSON.stringify(v, null, 2);
    }
    return unescapeUnicode(str);
  } catch {
    return unescapeUnicode(String(v));
  }
}

const StatusIcon = memo(function StatusIcon({ status }: { status: ChatToolCallDisplay['status'] }) {
  return status === 'running' ? (
    <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
  ) : status === 'ok' ? (
    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
  ) : (
    <XCircle className="size-3.5 shrink-0 text-destructive" aria-hidden />
  );
});

export const ChatSubagentTaskCard = memo(function ChatSubagentTaskCard({
  call,
  sessionId,
  assistantMessageId,
  nestedBlocks,
  isSending,
}: {
  call: ChatToolCallDisplay;
  sessionId: string;
  assistantMessageId: string;
  nestedBlocks?: AssistantBlock[];
  isSending: boolean;
}) {
  const { status, args } = call;
  const isTaskFinished = status === 'ok' || status === 'error';
  const { description, subagentType } = useMemo(() => parseTaskToolArgs(args), [args]);
  const authorization = getPersistedAuthorization(call);
  const initRef = useRef(false);
  const [open, setOpen] = useState(false);

  const nestedSeq = useMemo(
    () => (nestedBlocks?.length ? buildAssistantRenderSequence(nestedBlocks) : []),
    [nestedBlocks],
  );

  useEffect(() => {
    if (initRef.current) {
      return;
    }
    initRef.current = true;
    setTimeout(() => {
      setOpen(status === 'running' || status === 'error');
    }, 0);
  });

  return (
    <div className="mb-2 rounded-md border border-violet-500/25 bg-violet-500/4 text-left last:mb-0 dark:border-violet-400/20 dark:bg-violet-950/25">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer flex-col items-stretch gap-2 px-3 py-2.5 text-left text-xs outline-none hover:bg-violet-500/6 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:hover:bg-violet-950/40"
      >
        <div className="flex flex-wrap items-center gap-2">
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
              open && 'rotate-90',
            )}
            aria-hidden
          />
          <Bot className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
          <span className="font-medium text-foreground">子代理任务</span>
          {subagentType ? (
            <span className="rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-px font-mono text-[10px] text-violet-700 dark:text-violet-300">
              {subagentType}
            </span>
          ) : null}
          <span className="sr-only">子代理任务状态：</span>
          <StatusIcon status={status} />
        </div>
        {description ? (
          <p className="line-clamp-4 pl-5 text-[13px] leading-relaxed text-foreground/90">{description}</p>
        ) : (
          <p className="pl-5 text-[11px] text-muted-foreground">（无任务描述）</p>
        )}
      </button>

      {open && nestedSeq.length > 0 ? (
        <div className="mx-2 mb-2 space-y-1 rounded-md px-6 py-2">
          {nestedSeq.map((item, idx) =>
            isSubagentTaskShell(item) ? (
              <ChatSubagentTaskCard
                key={item.taskBlock.call.id}
                call={item.taskBlock.call}
                nestedBlocks={item.nested}
                sessionId={sessionId}
                assistantMessageId={assistantMessageId}
                isSending={isSending}
              />
            ) : (
              <ChatAssistantSingleBlock
                key={item.kind === 'tool' ? item.call.id : `n-${idx}-${item.kind}`}
                block={item}
                isSending={isSending}
                isFinished={isTaskFinished}
                sessionId={sessionId}
                assistantMessageId={assistantMessageId}
              />
            ),
          )}
          {authorization ? (
            <AuthorizationPanel
              authorization={authorization}
              sessionId={sessionId}
              assistantMessageId={assistantMessageId}
              toolCallId={call.id}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
