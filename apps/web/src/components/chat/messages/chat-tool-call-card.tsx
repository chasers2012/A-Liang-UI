"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronRight, Loader2, Wrench, XCircle } from "lucide-react";


import type { ChatToolCallDisplay } from "@/models/chat/types";
import { cn } from "@/lib/utils";

function formatJson(v: unknown): string {
  if (v === undefined) return "";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
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

const ToolCallArgs = memo(function ToolCallArgs({ args }: { args: unknown }) {
  const argsJson = useMemo(
    () => formatJson(args),
    [args],
  );
  return (
    <pre className="mt-1 max-h-40 overflow-auto rounded bg-background/80 p-2 font-mono text-[11px] leading-relaxed">
      {argsJson}
    </pre>
  )
});

const ToolCallResult = memo(function ToolCallResult({ result }: { result: unknown }) {
  const resultJson = useMemo(
    () => formatJson(result),
    [result],
  );

  return (
    <pre className="mt-1 max-h-40 overflow-auto rounded bg-background/80 p-2 font-mono text-[11px] leading-relaxed">
      {resultJson}
    </pre>
  )
});

export function ChatToolCallCard({ call }: { call: ChatToolCallDisplay }) {
  const { name, status, args, result, error } = call;
  const initRef = useRef(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (initRef.current) {
      return;
    }
    initRef.current = true;
    setTimeout(() => {
      setOpen(status === "running" || status === "error");
    }, 0);
  });

  return (
    <div className="mb-2 rounded-md border border-border/60 bg-muted/30 text-left last:mb-0">
      <div
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-xs font-medium outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-90",
          )}
          aria-hidden
        />
        <ToolCallHeader name={name} status={status} />
      </div>
      {open && (
        <div className="border-border/40 border-t px-3 py-2">
          {args !== undefined ? (
            <div className="mb-2">
              <span className="text-[11px] text-muted-foreground">参数</span>
              <ToolCallArgs args={args} />
            </div>
          ) : null}
          {status === "ok" && result !== undefined ? (
            <div>
              <span className="text-[11px] text-muted-foreground">结果</span>
              <ToolCallResult result={result} />
            </div>
          ) : null}
          {status === "error" && error ? (
            <p className="text-[11px] leading-relaxed text-destructive">{error}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
