"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

import {
  EMPTY_WORKFLOW_GRAPH_JSON,
  WorkflowGraphCanvas,
  WorkflowGraphZoomToolbar,
  type WorkflowGraphCanvasHandle,
  type WorkflowNodeTypeDefinition,
} from "@/components/workflow-graph";
import { cn } from "@/lib/utils";
import type { EvaluationNodeTypeCatalogItemPublic } from "@/lib/quant-agent-api";

export type EvaluationWorkflowCanvasHandle = {
  /** 工作流图 JSON 字符串（schema: `{nodes,links,viewport}`）。 */
  getWorkflow: () => string;
  importWorkflow: (json: string) => void;
  addNode: (typeKey: string) => void;
};

export type EvaluationWorkflowCanvasProps = {
  catalog: EvaluationNodeTypeCatalogItemPublic[];
  /** 工作流图 JSON 字符串（schema: `{nodes,links,viewport}`）。 */
  initialWorkflow: string;
  readOnly?: boolean;
  className?: string;
};

function toWorkflowNodeTypes(
  catalog: EvaluationNodeTypeCatalogItemPublic[],
): WorkflowNodeTypeDefinition[] {
  return catalog.map((c) => ({
    type: c.type,
    label: c.label,
    category: c.category,
    inputs: c.inputs,
    outputs: c.outputs,
  }));
}

export const EvaluationWorkflowCanvas = forwardRef<
  EvaluationWorkflowCanvasHandle,
  EvaluationWorkflowCanvasProps
>(function EvaluationWorkflowCanvas(
  { catalog, initialWorkflow, readOnly = false, className },
  ref,
) {
  const innerRef = useRef<WorkflowGraphCanvasHandle>(null);
  const nodeTypes = useMemo(() => toWorkflowNodeTypes(catalog), [catalog]);
  const initialGraphJson = useMemo(
    () => (initialWorkflow.trim() ? initialWorkflow : EMPTY_WORKFLOW_GRAPH_JSON),
    [initialWorkflow],
  );

  const getWorkflow = useCallback((): string => {
    return innerRef.current?.getGraphJson() ?? EMPTY_WORKFLOW_GRAPH_JSON;
  }, []);

  const importWorkflow = useCallback((json: string) => {
    innerRef.current?.importGraphJson(json);
  }, []);

  const addNode = useCallback((typeKey: string) => {
    innerRef.current?.addNode(typeKey);
  }, []);

  useImperativeHandle(ref, () => ({ getWorkflow, importWorkflow, addNode }), [
    getWorkflow,
    importWorkflow,
    addNode,
  ]);

  return (
    <WorkflowGraphCanvas
      ref={innerRef}
      className={cn("h-[min(560px,72vh)] min-h-[320px]", className)}
      nodeTypes={nodeTypes}
      initialGraphJson={initialGraphJson}
      readOnly={readOnly}
    >
      <WorkflowGraphZoomToolbar />
    </WorkflowGraphCanvas>
  );
});
