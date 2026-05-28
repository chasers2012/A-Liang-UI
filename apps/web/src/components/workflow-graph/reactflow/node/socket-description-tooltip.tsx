import { useMemo, useState } from 'react';

import { MarkdownContent } from '@/components/markdown/markdown-content';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { HelpCircle } from 'lucide-react';

/** 超过该字符数（trim 后）使用较宽的 Tooltip，避免长文挤在窄气泡里。 */
const DESCRIPTION_WIDE_MAX_WIDTH_THRESHOLD = 200;

export function SocketDescriptionTooltip({ description }: { description: string }) {
  const [open, setOpen] = useState(false);

  const useWideTooltip = useMemo(() => description.trim().length > DESCRIPTION_WIDE_MAX_WIDTH_THRESHOLD, [description]);

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        closeOnClick={false}
        render={
          <span
            className="cursor-default pointer-events-auto inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
            aria-label="socket description"
          >
            <HelpCircle className="h-2.5 w-2.5 pointer-events-none" />
          </span>
        }
      />
      <TooltipContent side="top" className={cn('min-w-0', useWideTooltip ? 'max-w-[min(50vw,42rem)]' : 'max-w-xs')}>
        <MarkdownContent content={description} isFinished />
      </TooltipContent>
    </Tooltip>
  );
}
