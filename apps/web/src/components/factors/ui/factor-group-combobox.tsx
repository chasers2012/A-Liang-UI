"use client";

import { useEffect, useMemo, useState } from "react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { listFactors } from "@/lib/quant-agent-api";

const inputClassName = cn(
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent py-1 pr-9 pl-2.5 font-mono text-sm outline-none transition-colors",
  "text-foreground placeholder:text-muted-foreground",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  "dark:bg-input/30",
);

const itemClassName = cn(
  "cursor-default whitespace-normal wrap-break-word px-2.5 py-1.5 text-sm font-mono outline-none select-none",
  "data-[highlighted]:relative data-[highlighted]:z-0 data-[highlighted]:text-accent-foreground",
  "data-[highlighted]:before:absolute data-[highlighted]:before:inset-x-1 data-[highlighted]:before:inset-y-0.5 data-[highlighted]:before:z-[-1]",
  "data-[highlighted]:before:rounded-md data-[highlighted]:before:bg-accent",
);

export interface FactorGroupComboboxProps {
  id: string;
  value: string;
  onValueChange: (group: string) => void;
  className?: string;
}

export function FactorGroupCombobox({
  id,
  value,
  onValueChange,
  className,
}: FactorGroupComboboxProps) {
  const [knownGroups, setKnownGroups] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listFactors()
      .then((rows) => {
        if (cancelled) return;
        const next = new Set<string>();
        for (const r of rows) {
          const g = r.group?.trim();
          if (g) next.add(g);
        }
        setKnownGroups(
          [...next].sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
        );
      })
      .catch(() => {
        if (!cancelled) setKnownGroups([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => knownGroups, [knownGroups]);

  return (
    <Autocomplete.Root
      items={items}
      value={value}
      onValueChange={onValueChange}
      openOnInputClick
    >
      <Autocomplete.InputGroup
        className={cn("relative flex w-full items-stretch", className)}
      >
        <Autocomplete.Input
          id={id}
          placeholder="未分组"
          autoComplete="off"
          className={cn(inputClassName, "flex-1")}
        />
        <Autocomplete.Trigger
          type="button"
          className={cn(
            "absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md",
            "text-muted-foreground outline-none hover:bg-muted hover:text-foreground",
            "focus-visible:ring-2 focus-visible:ring-ring",
          )}
          aria-label="展开分组列表"
        >
          <ChevronDown className="size-4" aria-hidden />
        </Autocomplete.Trigger>
      </Autocomplete.InputGroup>

      <Autocomplete.Portal>
        <Autocomplete.Positioner
          className="z-50 outline-none"
          sideOffset={4}
          align="start"
        >
          <Autocomplete.Popup
            className={cn(
              "max-h-[min(16rem,var(--available-height))] min-w-[var(--anchor-width)] w-max max-w-[min(28rem,var(--available-width))]",
              "overflow-y-auto overscroll-contain rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md",
            )}
          >
            <Autocomplete.Empty className="px-2.5 py-2 text-sm text-muted-foreground">
              无匹配分组。可直接输入新名称，保存后作为新分组。
            </Autocomplete.Empty>
            <Autocomplete.List className="outline-none">
              {(group: string) => (
                <Autocomplete.Item
                  key={group}
                  value={group}
                  className={itemClassName}
                >
                  {group}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}
