"use client";

import { memo, useMemo } from "react";
import { CheckCircle2, ChevronRight, Loader2, Wrench, XCircle } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ChatToolCallDisplay } from "@/models/chat/types";

function formatJson(v: unknown): string {
  if (v === undefined) return "";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function toolCallDisplayEqual(
  a: ChatToolCallDisplay,
  b: ChatToolCallDisplay,
): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.status === b.status &&
    a.args === b.args &&
    a.result === b.result &&
    a.error === b.error
  );
}

const StatusIcon = memo(function StatusIcon({ status }: { status: ChatToolCallDisplay['status'] }) {
  return status === "running" ? (
    <Loader2
      className="size-3.5 shrink-0 animate-spin text-muted-foreground"
      aria-hidden
    />
  ) : status === "ok" ? (
    <CheckCircle2
      className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
      aria-hidden
    />
  ) : (
    <XCircle className="size-3.5 shrink-0 text-destructive" aria-hidden />
  )
});

const ToolCallHeader = memo(function ToolCallHeader({ name, status }: { name: ChatToolCallDisplay['name'], status: ChatToolCallDisplay['status'] }) {
  return (
    <>
      <Wrench className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="font-mono text-foreground">{name || "(工具)"}</span>
      <span className="sr-only">工具调用状态：</span>
      <StatusIcon status={status} />
    </>
  )
});

export const ChatToolCallCard = memo(function ChatToolCallCard({ call }: { call: ChatToolCallDisplay }) {
  const { name, status, args, result, error } = call;
  const argsJson = useMemo(
    () => formatJson(args),
    [args],
  );
  const resultJson = useMemo(
    () => formatJson(result),
    [result],
  );


  const hasDetail = useMemo(() =>
    args !== undefined ||
    result !== undefined ||
    (status === "error" && error)
    , [args, result, status, error]);


  if (!hasDetail) {
    return (
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs font-medium last:mb-0">
        <ToolCallHeader name={name} status={status} />
      </div>
    );
  }

  return (
    <Collapsible
      defaultOpen={status === "running" || status === "error"}
      className="mb-2 rounded-md border border-border/60 bg-muted/30 text-left last:mb-0"
    >
      <CollapsibleTrigger
        className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-xs font-medium outline-none \
           hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 \
           [&[data-panel-open]_svg:first-child]:rotate-90"

      >
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform" />
        <ToolCallHeader name={name} status={status} />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-border/40 border-t px-3 py-2">
        {args !== undefined ? (
          <div className="mb-2">
            <span className="text-[11px] text-muted-foreground">参数</span>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-background/80 p-2 font-mono text-[11px] leading-relaxed">
              {argsJson}
            </pre>
          </div>
        ) : null}
        {status === "ok" && result !== undefined ? (
          <div>
            <span className="text-[11px] text-muted-foreground">结果</span>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-background/80 p-2 font-mono text-[11px] leading-relaxed">
              {resultJson}
            </pre>
          </div>
        ) : null}
        {status === "error" && error ? (
          <p className="text-[11px] leading-relaxed text-destructive">{error}</p>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}, (prev, next) => toolCallDisplayEqual(prev.call, next.call));
