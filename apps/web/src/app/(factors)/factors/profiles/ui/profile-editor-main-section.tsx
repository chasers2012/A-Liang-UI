"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WORKFLOW_GRAPH_NODE_DRAG_MIME } from "@/components/workflow-graph";
import {
  listEvaluationNodeTypes,
  type EvaluationNodeTypeCatalogItemPublic,
} from "@/lib/quant-agent-api";
import type { EvaluationWorkflowGraphJson } from "@/models/evaluation-profile/dto";

import {
  EvaluationWorkflowCanvas,
  type EvaluationWorkflowCanvasHandle,
} from "./evaluation-workflow-canvas";

export function ProfileWorkflowEditorBlock(props: {
  workflowJson: string;
  onWorkflowJson: (v: string) => void;
  workflowJsonFieldId: string;
  workflowEditMode: "canvas" | "json";
  onWorkflowMode: (next: "canvas" | "json") => void;
  canvasKey: number;
  canvasRef: RefObject<EvaluationWorkflowCanvasHandle | null>;
  initialWorkflow: EvaluationWorkflowGraphJson;
}) {
  const {
    workflowJson,
    onWorkflowJson,
    workflowJsonFieldId,
    workflowEditMode,
    onWorkflowMode,
    canvasKey,
    canvasRef,
    initialWorkflow,
  } = props;

  const [catalog, setCatalog] = useState<EvaluationNodeTypeCatalogItemPublic[]>([]);
  const [wfMetaLoading, setWfMetaLoading] = useState(true);

  useEffect(() => {
    void listEvaluationNodeTypes()
      .then(setCatalog)
      .catch(() => {})
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="shrink-0">工作流</Label>
        <div className="flex gap-1">
          <Button
            type="button"
            variant={workflowEditMode === "canvas" ? "default" : "outline"}
            size="sm"
            disabled={wfMetaLoading}
            onClick={() => onWorkflowMode("canvas")}
          >
            画布
          </Button>
          <Button
            type="button"
            variant={workflowEditMode === "json" ? "default" : "outline"}
            size="sm"
            onClick={() => onWorkflowMode("json")}
          >
            JSON
          </Button>
        </div>
      </div>
      {wfMetaLoading ? (
        <p className="text-sm text-muted-foreground">
          加载节点类型…
        </p>
      ) : workflowEditMode === "canvas" ? (
        <div className="flex gap-3">
          <aside className="hidden w-[220px] shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted/10 md:block">
            <div className="border-b border-border/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              节点列表
            </div>
            <div className="max-h-[min(560px,72vh)] overflow-auto p-2">
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
                            <div className="truncate font-mono text-[10px] leading-4 text-muted-foreground">
                              {it.type}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </aside>
          <EvaluationWorkflowCanvas
            key={canvasKey}
            ref={canvasRef}
            catalog={catalog}
            initialWorkflow={initialWorkflow}
            className="flex-1"
          />
        </div>
      ) : (
        <>
          <Label htmlFor={workflowJsonFieldId} className="sr-only">
            工作流 JSON
          </Label>
          <Textarea
            id={workflowJsonFieldId}
            className="min-h-48 font-mono text-xs"
            value={workflowJson}
            onChange={(e) => onWorkflowJson(e.target.value)}
            spellCheck={false}
          />
        </>
      )}
    </div>
  );
}
