"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { WORKFLOW_GRAPH_NODE_DRAG_MIME } from "./workflow-graph-canvas";

export type WorkflowNodeTypeListItem = {
  type: string;
  label: string;
  description?: string | null;
  category?: string | null;
};

function toPlainTextPreview(input?: string | null, maxLength = 120): string {
  if (!input) return "";
  const plain = input
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/[#_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength)}...`;
}

export function WorkflowNodeTypeList(props: {
  items: WorkflowNodeTypeListItem[];
  title?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  emptyFilteredText?: string;
  className?: string;
  onSelectType?: (type: string) => void;
  draggable?: boolean;
  dragMime?: string;
}) {
  const {
    items,
    title = "节点列表",
    searchPlaceholder = "搜索名称/描述",
    emptyText = "暂无节点",
    emptyFilteredText = "没有匹配节点",
    className,
    onSelectType,
    draggable = true,
    dragMime = WORKFLOW_GRAPH_NODE_DRAG_MIME,
  } = props;

  const [keyword, setKeyword] = useState("");

  const groups = useMemo(() => {
    const q = keyword.trim().toLocaleLowerCase("zh-CN");
    const grouped = new Map<string, WorkflowNodeTypeListItem[]>();
    for (const item of items) {
      if (q) {
        const searchText = [item.label, item.description ?? "", item.category ?? ""]
          .join(" ")
          .toLocaleLowerCase("zh-CN");
        if (!searchText.includes(q)) continue;
      }
      const key = item.category?.trim() || "其他";
      const arr = grouped.get(key) ?? [];
      arr.push(item);
      grouped.set(key, arr);
    }

    return Array.from(grouped.entries())
      .map(([category, arr]) => ({
        category,
        items: [...arr].sort((a, b) => a.label.localeCompare(b.label, "zh-Hans-CN")),
      }))
      .sort((a, b) => a.category.localeCompare(b.category, "zh-Hans-CN"));
  }, [items, keyword]);

  const filteredCount = useMemo(
    () => groups.reduce((acc, g) => acc + g.items.length, 0),
    [groups],
  );

  const isFiltered = keyword.trim().length > 0;
  const isEmpty = groups.length === 0;

  return (
    <aside
      className={cn(
        "h-full w-[300px] max-w-[30%] flex-col overflow-hidden rounded-md border border-border/70 bg-background md:flex",
        className,
      )}
    >
      <div className="border-b border-border/70 px-3 py-2">
        <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>{title}</span>
          <span>{filteredCount}</span>
        </div>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto p-2">
        <div className="space-y-3 overflow-hidden">
          {isEmpty ? (
            <p className="p-3 text-sm text-muted-foreground">
              {isFiltered ? emptyFilteredText : emptyText}
            </p>
          ) : null}

          {groups.map((g) => (
            <section key={g.category}>
              <div className="sticky top-0 bg-background px-1 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {g.category}
              </div>
              <ul className="space-y-2">
                {g.items.map((it) => (
                  <li
                    key={it.type}
                    className="cursor-pointer select-none rounded border border-border/40 bg-muted/30 px-2 py-2 hover:bg-muted/50"
                    title={it.type}
                    role="button"
                    tabIndex={0}
                    draggable={draggable}
                    onClick={() => onSelectType?.(it.type)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectType?.(it.type);
                      }
                    }}
                    onDragStart={(e) => {
                      if (!draggable) return;
                      e.dataTransfer.setData(dragMime, it.type);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                  >
                    <div className="truncate text-sm font-medium leading-5 text-foreground">
                      {it.label}
                    </div>
                    {it.description ? (
                      <p className="mt-0.5 pl-2 pt-1 text-[11px] leading-4 text-muted-foreground">
                        {toPlainTextPreview(it.description)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </aside>
  );
}

