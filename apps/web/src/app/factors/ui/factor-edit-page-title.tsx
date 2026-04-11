"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface FactorEditPageTitleProps {
  name: string;
  onNameChange: (name: string) => void;
  /** 无障碍名称，默认「因子名称」 */
  nameAriaLabel?: string;
}

export function FactorEditPageTitle({
  name,
  onNameChange,
  nameAriaLabel = "因子名称",
}: FactorEditPageTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  const commit = () => {
    const t = draft.trim();
    if (t === "") {
      setDraft(name);
      setEditing(false);
      return;
    }
    if (t !== name) onNameChange(t);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(name);
    setEditing(false);
  };

  const titleTypography =
    "text-2xl font-semibold tracking-tight md:text-3xl";

  /** 与 Input 同字号字重，用于测量编辑态宽度 */
  const measureTypography = cn(
    "col-start-1 row-start-1 whitespace-pre px-0 py-0.5",
    titleTypography,
    "pointer-events-none select-none",
  );

  if (editing) {
    const measureText = draft.length > 0 ? draft : "\u00a0";
    return (
      <span className="inline-flex w-max max-w-full min-w-0 items-center gap-0.5">
        <span
          className={cn(
            "inline-grid min-w-40 max-w-full grid-cols-1",
            "w-[min(100%,max-content)]",
          )}
        >
          <span className={cn(measureTypography, "invisible")} aria-hidden>
            {measureText}
          </span>
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            className={cn(
              "col-start-1 row-start-1 h-auto min-h-0 w-full min-w-0 max-w-full",
              "border-0 border-b border-transparent bg-transparent px-0 py-0.5 shadow-none",
              titleTypography,
              "rounded-none focus-visible:border-primary focus-visible:ring-0",
            )}
            aria-label={nameAriaLabel}
          />
        </span>
      </span>
    );
  }

  const displayText = name.trim() !== "" ? name : "（未命名）";

  return (
    <span className="inline-flex w-max max-w-full min-w-0 items-center gap-0.5">
      <span className="min-w-0 truncate">{displayText}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => {
          setDraft(name);
          setEditing(true);
        }}
        aria-label="编辑名称"
      >
        <Pencil className="size-4" aria-hidden />
      </Button>
    </span>
  );
}
