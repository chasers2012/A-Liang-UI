"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FactorEditPageDescriptionProps {
  description: string;
  onDescriptionChange: (description: string) => void;
}

const bodyTypography =
  "text-sm leading-relaxed wrap-break-word whitespace-pre-wrap px-0 py-1";

export function FactorEditPageDescription({
  description,
  onDescriptionChange,
}: FactorEditPageDescriptionProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description);

  const commit = () => {
    if (draft !== description) onDescriptionChange(draft);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(description);
    setEditing(false);
  };

  if (editing) {
    const measureText = draft.length > 0 ? draft : "\u00a0";
    return (
      <span className="inline-block max-w-full min-w-0 align-top">
        <span className="relative inline-block w-max max-w-full min-w-56 align-top">
          <span
            className={cn(
              "invisible block min-w-0 select-none",
              bodyTypography,
              "pointer-events-none",
            )}
            aria-hidden
          >
            {measureText}
          </span>
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit()}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            className={cn(
              "absolute inset-0 box-border min-h-0 w-full resize-none",
              "border-0 border-b border-transparent bg-transparent shadow-none",
              bodyTypography,
              "text-foreground outline-none",
              "rounded-none focus-visible:border-primary focus-visible:ring-0",
            )}
            aria-label="因子描述"
          />
        </span>
      </span>
    );
  }

  const isEmpty = description.trim() === "";
  const displayText = isEmpty ? "（无描述）" : description;

  return (
    <span className="inline-block max-w-full min-w-0 align-top">
      <span
        className={cn(
          "inline-block w-max max-w-full min-w-0 align-top",
          bodyTypography,
          isEmpty ? "text-muted-foreground/70" : "text-muted-foreground",
        )}
      >
        {displayText}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="ml-0.5 inline-flex size-8 shrink-0 align-top text-muted-foreground hover:text-foreground"
        onClick={() => {
          setDraft(description);
          setEditing(true);
        }}
        aria-label="编辑描述"
      >
        <Pencil className="size-4" aria-hidden />
      </Button>
    </span>
  );
}
