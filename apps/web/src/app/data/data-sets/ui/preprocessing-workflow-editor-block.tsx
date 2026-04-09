"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  listPreprocessorNodeTypes,
  type EvaluationNodeTypeCatalogItemPublic,
} from "@/lib/quant-agent-api";

import {
  WorkflowGraphCanvas,
  WORKFLOW_GRAPH_NODE_DRAG_MIME,
  type WorkflowGraphCanvasHandle,
  type WorkflowNodeTypeDefinition,
} from "@/components/workflow-graph";
import { WorkflowGraphPersisted } from "@/components/workflow-graph/reactflow/types";

function toWorkflowNodeTypes(
  catalog: EvaluationNodeTypeCatalogItemPublic[],
): WorkflowNodeTypeDefinition[] {
  return catalog.map((c) => ({
    type: c.type,
    label: c.label,
    description: c.description,
    category: c.category ?? undefined,
    inputs: c.inputs,
    outputs: c.outputs,
  }));
}

function toPlainTextPreview(input?: string, maxLength = 120): string {
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

export function PreprocessingWorkflowEditorBlock(props: {
  workflow: WorkflowGraphPersisted;
  canvasKey: number;
  canvasRef: RefObject<WorkflowGraphCanvasHandle | null>;
  className?: string;
}) {
  const { workflow, canvasKey, canvasRef, className } = props;

  const [catalog, setCatalog] = useState<EvaluationNodeTypeCatalogItemPublic[]>(
    [],
  );
  const [wfMetaLoading, setWfMetaLoading] = useState(true);
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    void listPreprocessorNodeTypes()
      .then(setCatalog)
      .catch(() => {
        // Ignore, UI falls back to empty sidebar.
      })
      .finally(() => setWfMetaLoading(false));
  }, []);

  const catalogGroups = useMemo(() => {
    const q = keyword.trim().toLocaleLowerCase("zh-CN");
    const groups = new Map<string, EvaluationNodeTypeCatalogItemPublic[]>();
    for (const item of catalog) {
      if (q) {
        const searchText = [
          item.label,
          item.description ?? "",
          item.category ?? "",
        ]
          .join(" ")
          .toLocaleLowerCase("zh-CN");
        if (!searchText.includes(q)) continue;
      }
      const key = item.category?.trim() || "其他";
      const arr = groups.get(key) ?? [];
      arr.push(item);
      groups.set(key, arr);
    }
    return Array.from(groups.entries())
      .map(([category, items]) => ({
        category,
        items: [...items].sort((a, b) =>
          a.label.localeCompare(b.label, "zh-Hans-CN"),
        ),
      }))
      .sort((a, b) => a.category.localeCompare(b.category, "zh-Hans-CN"));
  }, [catalog, keyword]);

  const nodeTypes = useMemo(
    () => toWorkflowNodeTypes(catalog),
    [catalog],
  );

  const filteredNodeCount = useMemo(
    () => catalogGroups.reduce((acc, g) => acc + g.items.length, 0),
    [catalogGroups],
  );

  return (
    <div className={cn("flex flex-col min-h-0 flex-1 gap-3", className)}>
      <Label className="">预处理工作流</Label>
      {wfMetaLoading ? (
        <p className="text-sm text-muted-foreground">加载节点类型…</p>
      ) : (
        <div className="flex min-h-0 flex-1 items-stretch gap-3 overflow-hidden">
          <aside className="h-full w-[300px] max-w-[30%] flex-col overflow-hidden rounded-md border border-border/70 bg-background md:flex">
            <div className="border-b border-border/70 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>节点列表</span>
                <span>{filteredNodeCount}</span>
              </div>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="搜索名称/描述"
                  className="h-8 pl-7 text-xs"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto relative p-2">
              <div className="space-y-3 overflow-hidden">
                {catalogGroups.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    {keyword ? "没有匹配节点" : "暂无节点"}
                  </p>
                ) : null}
                {catalogGroups.map((g) => (
                  <section key={g.category}>
                    <div className="sticky top-0 px-1 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground bg-background">
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
                          draggable
                          onClick={() => canvasRef.current?.addNode(it.type)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              canvasRef.current?.addNode(it.type);
                            }
                          }}
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              WORKFLOW_GRAPH_NODE_DRAG_MIME,
                              it.type,
                            );
                            e.dataTransfer.effectAllowed = "copy";
                          }}
                        >
                          <div className="truncate text-sm font-medium leading-5 text-foreground">
                            {it.label}
                          </div>
                          {it.description ? (
                            <p className="pl-2 pt-1 mt-0.5 text-[11px] leading-4 text-muted-foreground">
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
          <WorkflowGraphCanvas
            key={canvasKey}
            ref={canvasRef}
            nodeTypes={nodeTypes}
            initialGraph={workflow}
            className="h-full flex-1"
          />
        </div>
      )}
    </div>
  );
}

