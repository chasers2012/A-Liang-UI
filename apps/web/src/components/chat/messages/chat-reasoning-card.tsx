'use client';

import { memo, useState } from 'react';
import { Brain, ChevronRight } from 'lucide-react';

import { AiChatMarkdown } from './ai-chat-markdown';
import { cn } from '@/lib/utils';

export const ChatReasoningCard = memo(function ChatReasoningCard({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  if (!content.trim()) return null;

  return (
    <div className="mb-2 rounded-md border border-border/60 bg-muted/20 text-left last:mb-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium outline-none hover:bg-muted/50"
      >
        <ChevronRight
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-90',
          )}
          aria-hidden
        />
        <Brain className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-muted-foreground">思考过程</span>
      </button>
      {open ? (
        <div className="border-border/40 border-t px-3 py-2">
          <AiChatMarkdown content={content} />
        </div>
      ) : null}
    </div>
  );
});
