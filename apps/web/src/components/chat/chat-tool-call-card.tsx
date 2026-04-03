"use client";

import { CheckCircle2, ChevronRight, Loader2, Wrench, XCircle } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ChatToolCallDisplay } from "@/models/chat/types";

function formatJson(v: unknown): string {
  if (v === undefined) return "";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export function ChatToolCallCard({ call }: { call: ChatToolCallDisplay }) {
  const statusIcon =
    call.status === "running" ? (
      <Loader2
        className="size-3.5 shrink-0 animate-spin text-muted-foreground"
        aria-hidden
      />
    ) : call.status === "ok" ? (
      <CheckCircle2
        className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
        aria-hidden
      />
    ) : (
      <XCircle className="size-3.5 shrink-0 text-destructive" aria-hidden />
    );

  const hasDetail =
    call.args !== undefined ||
    call.result !== undefined ||
    (call.status === "error" && call.error);

  const headerRow = (
    <>
      <Wrench className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="font-mono text-foreground">{call.name || "(工具)"}</span>
      <span className="sr-only">工具调用状态：</span>
      {statusIcon}
    </>
  );

  if (!hasDetail) {
    return (
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs font-medium last:mb-0">
        {headerRow}
      </div>
    );
  }

  return (
    <Collapsible
      defaultOpen={call.status === "running" || call.status === "error"}
      className="mb-2 rounded-md border border-border/60 bg-muted/30 text-left last:mb-0"
    >
      <CollapsibleTrigger
        className={cn(
          "flex w-full flex-wrap items-center gap-2 px-3 py-2 text-xs font-medium outline-none",
          "hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "[&[data-panel-open]_svg:first-child]:rotate-90",
        )}
      >
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform" />
        {headerRow}
      </CollapsibleTrigger>
      <CollapsibleContent className="border-border/40 border-t px-3 py-2">
        {call.args !== undefined ? (
          <div className="mb-2">
            <span className="text-[11px] text-muted-foreground">参数</span>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-background/80 p-2 font-mono text-[11px] leading-relaxed">
              {formatJson(call.args)}
            </pre>
          </div>
        ) : null}
        {call.status === "ok" && call.result !== undefined ? (
          <div>
            <span className="text-[11px] text-muted-foreground">结果</span>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-background/80 p-2 font-mono text-[11px] leading-relaxed">
              {formatJson(call.result)}
            </pre>
          </div>
        ) : null}
        {call.status === "error" && call.error ? (
          <p className="text-[11px] leading-relaxed text-destructive">{call.error}</p>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
