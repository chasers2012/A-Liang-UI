"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

import {
  EMPTY_LITEGRAPH_GRAPH_JSON,
  WorkflowGraphCanvas,
  WorkflowGraphZoomToolbar,
  type WorkflowGraphCanvasHandle,
  type WorkflowNodeTypeDefinition,
} from "@/components/workflow-graph";
import { cn } from "@/lib/utils";
import type { EvaluationNodeTypeCatalogItemPublic } from "@/lib/quant-agent-api";

export type EvaluationWorkflowCanvasHandle = {
  /** LiteGraph `graph.serialize()` JSON 字符串。 */
  getWorkflow: () => string;
  importWorkflow: (json: string) => void;
};

export type EvaluationWorkflowCanvasProps = {
  catalog: EvaluationNodeTypeCatalogItemPublic[];
  /** LiteGraph 序列化 JSON 字符串。 */
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
    () => (initialWorkflow.trim() ? initialWorkflow : EMPTY_LITEGRAPH_GRAPH_JSON),
    [initialWorkflow],
  );

  const getWorkflow = useCallback((): string => {
    return innerRef.current?.getGraphJson() ?? EMPTY_LITEGRAPH_GRAPH_JSON;
  }, []);

  const importWorkflow = useCallback((json: string) => {
    innerRef.current?.importGraphJson(json);
  }, []);

  useImperativeHandle(ref, () => ({ getWorkflow, importWorkflow }), [
    getWorkflow,
    importWorkflow,
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
