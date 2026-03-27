"use client";

import { cn } from "@/lib/utils";

export function SocketTypeBadge({
  valueType,
  alignEnd,
  className,
}: {
  valueType: string;
  alignEnd?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full truncate rounded border border-border/50 bg-background/90 px-1 py-px font-mono text-xs leading-tight tracking-tight text-muted-foreground shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--foreground)_4%,transparent)]",
        alignEnd && "self-end",
        className,
      )}
      title={valueType}
    >
      {valueType}
    </span>
  );
}

export function IoBlockHeader({
  kind,
  compact,
}: {
  kind: "in" | "out";
  compact?: boolean;
}) {
  const isIn = kind === "in";
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 border-b border-border/80",
        compact ? "px-1.5 py-0.5" : "px-2 py-1",
        isIn
          ? "bg-sky-500/[0.06] dark:bg-sky-400/[0.08]"
          : "bg-emerald-500/[0.06] dark:bg-emerald-400/[0.08]",
      )}
    >
      <span
        className={cn(
          "shrink-0 rounded-full",
          compact ? "size-1" : "size-1.5",
          isIn
            ? "bg-sky-500/90 dark:bg-sky-400"
            : "bg-emerald-600/90 dark:bg-emerald-500",
        )}
        aria-hidden
      />
      <span className="text-xs font-semibold tracking-wide text-foreground/85">
        {isIn ? "输入" : "输出"}
      </span>
      {!compact ? (
        <span className="text-xs text-muted-foreground">
          {isIn ? "接入" : "接出"}
        </span>
      ) : null}
    </div>
  );
}
