"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  listPreprocessorNodeTypes,
  type EvaluationNodeTypeCatalogItemPublic,
} from "@/api";

import {
  WorkflowGraphCanvas,
  WorkflowNodeTypeList,
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

  useEffect(() => {
    void listPreprocessorNodeTypes()
      .then(setCatalog)
      .catch(() => {
        // Ignore, UI falls back to empty sidebar.
      })
      .finally(() => setWfMetaLoading(false));
  }, []);

  const nodeTypes = useMemo(
    () => toWorkflowNodeTypes(catalog),
    [catalog],
  );
  const listCatalog = useMemo(() => catalog, [catalog]);

  return (
    <div className={cn("flex h-full min-h-0 flex-1 flex-col gap-3", className)}>
      <Label className="">预处理工作流</Label>
      {wfMetaLoading ? (
        <p className="text-sm text-muted-foreground">加载节点类型…</p>
      ) : (
        <div className="flex h-full min-h-0 flex-1 items-stretch gap-3 overflow-hidden">
          <WorkflowNodeTypeList
            items={listCatalog}
            onSelectType={(type) => canvasRef.current?.addNode(type)}
          />
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

