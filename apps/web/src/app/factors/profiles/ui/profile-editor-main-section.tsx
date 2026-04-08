"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "@/components/markdown/markdown-content";
import {
  listEvaluationNodeTypes,
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

export function ProfileWorkflowEditorBlock(props: {
  workflow: WorkflowGraphPersisted;
  canvasKey: number;
  canvasRef: RefObject<WorkflowGraphCanvasHandle | null>;
  className?: string;
}) {
  const { workflow, canvasKey, canvasRef, className } = props;

  const [catalog, setCatalog] = useState<EvaluationNodeTypeCatalogItemPublic[]>([]);
  const [wfMetaLoading, setWfMetaLoading] = useState(true);

  useEffect(() => {
    void listEvaluationNodeTypes()
      .then(setCatalog)
      .catch(() => { })
      .finally(() => setWfMetaLoading(false));
  }, []);

  const catalogGroups = useMemo(() => {
    const groups = new Map<string, EvaluationNodeTypeCatalogItemPublic[]>();
    for (const item of catalog) {
      const key = item.category?.trim() || "其他";
      const arr = groups.get(key) ?? [];
      arr.push(item);
      groups.set(key, arr);
    }
    return Array.from(groups.entries())
      .map(([category, items]) => ({
        category,
        items: [...items].sort((a, b) => a.label.localeCompare(b.label, "zh-Hans-CN")),
      }))
      .sort((a, b) => a.category.localeCompare(b.category, "zh-Hans-CN"));
  }, [catalog]);

  const nodeTypes = useMemo(() => toWorkflowNodeTypes(catalog), [catalog]);

  return (
    <div className={cn("flex flex-col min-h-0 flex-1 gap-3", className)}>
      <Label className="">工作流</Label>
      {wfMetaLoading ? (
        <p className="text-sm text-muted-foreground">加载节点类型…</p>
      ) : (
        <div className="flex min-h-0 flex-1 items-stretch gap-3 overflow-hidden">
          <aside className="h-full w-[300px] max-w-[30%] flex-col overflow-hidden rounded-md border border-border/70 bg-muted/10 md:flex">
            <div className=" border-b border-border/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              节点列表
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {catalogGroups.length === 0 ? (
                <p className="px-1 py-1 text-sm text-muted-foreground">暂无节点</p>
              ) : (
                <div className="space-y-3">
                  {catalogGroups.map((g) => (
                    <section key={g.category} className="space-y-1">
                      <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {g.category}
                      </div>
                      <ul className="space-y-1">
                        {g.items.map((it) => (
                          <li
                            key={it.type}
                            className="cursor-pointer select-none rounded border border-border/40 bg-background/70 px-2 py-1 hover:bg-background"
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
                              e.dataTransfer.setData(WORKFLOW_GRAPH_NODE_DRAG_MIME, it.type);
                              e.dataTransfer.effectAllowed = "copy";
                            }}
                          >
                            <div className="text-xs font-medium leading-5 text-foreground">
                              {it.label}
                            </div>
                            {it.description ? (
                              <MarkdownContent
                                content={it.description}
                                className="mt-0.5 text-[11px] text-muted-foreground"
                              />
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
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
