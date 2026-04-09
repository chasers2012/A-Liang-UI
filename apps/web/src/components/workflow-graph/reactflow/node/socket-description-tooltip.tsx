import { useState } from "react";

import { MarkdownContent } from "@/components/markdown/markdown-content";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

export function SocketDescriptionTooltip({ description }: { description: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        delay={0}
        closeOnClick={false}
        render={
          <button
            type="button"
            className="pointer-events-auto inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
            aria-label="socket description"
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
          >
            <HelpCircle className="h-2.5 w-2.5 pointer-events-none" />
          </button>
        }
      />
      <TooltipContent side="top" className="max-w-96">
        <MarkdownContent content={description} />
      </TooltipContent>
    </Tooltip>
  );
}
