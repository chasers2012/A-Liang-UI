"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

import {
  WorkflowGraphCanvas,
  type WorkflowGraphCanvasHandle,
  type WorkflowGraphState,
  type WorkflowNodeTypeDefinition,
} from "@/components/workflow-graph";
import { cn } from "@/lib/utils";
import type {
  EvaluationWorkflowDto,
  EvaluationNodeTypeCatalogItemPublic,
} from "@/lib/quant-agent-api";

import { EvaluationWorkflowNodeInspectorPanel } from "./evaluation-workflow-node-inspector-panel";

export type EvaluationWorkflowCanvasHandle = {
  getWorkflow: () => EvaluationWorkflowDto;
  importWorkflow: (w: EvaluationWorkflowDto) => void;
};

export type EvaluationWorkflowCanvasProps = {
  catalog: EvaluationNodeTypeCatalogItemPublic[];
  initialWorkflow: EvaluationWorkflowDto;
  readOnly?: boolean;
  className?: string;
};

function toWorkflowNodeTypes(
  catalog: EvaluationNodeTypeCatalogItemPublic[],
): WorkflowNodeTypeDefinition[] {
  return catalog.map((c) => ({
    type: c.type,
    label: c.label,
    inputs: c.inputs,
    outputs: c.outputs,
  }));
}

function evaluationDtoToGraphState(w: EvaluationWorkflowDto): WorkflowGraphState {
  return {
    nodes: w.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      pos: n.pos,
      params: { ...(n.params ?? {}) },
    })),
    links: (w.links ?? []).map((l) => ({
      id: l.id ?? undefined,
      from_node: l.from_node,
      from_socket: l.from_socket,
      to_node: l.to_node,
      to_socket: l.to_socket,
    })),
    viewport: w.viewport ?? null,
  };
}

function graphStateToEvaluationDto(g: WorkflowGraphState): EvaluationWorkflowDto {
  return {
    nodes: g.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      pos: n.pos,
      params: { ...(n.params ?? {}) },
    })),
    links: g.links.map((l) => ({
      id: l.id,
      from_node: l.from_node,
      from_socket: l.from_socket,
      to_node: l.to_node,
      to_socket: l.to_socket,
    })),
    viewport: g.viewport,
  };
}

const EMPTY_WORKFLOW: EvaluationWorkflowDto = {
  nodes: [],
  links: [],
  viewport: null,
};

const EvaluationWorkflowCanvasInner = forwardRef<
  EvaluationWorkflowCanvasHandle,
  EvaluationWorkflowCanvasProps
>(function EvaluationWorkflowCanvasInner(
  { catalog, initialWorkflow, readOnly = false, className },
  ref,
) {
  const innerRef = useRef<WorkflowGraphCanvasHandle>(null);
  const nodeTypes = useMemo(() => toWorkflowNodeTypes(catalog), [catalog]);
  const initialGraph = useMemo(
    () => evaluationDtoToGraphState(initialWorkflow),
    [initialWorkflow],
  );

  const getWorkflow = useCallback((): EvaluationWorkflowDto => {
    const g = innerRef.current?.getGraph();
    if (!g) return EMPTY_WORKFLOW;
    return graphStateToEvaluationDto(g);
  }, []);

  const importWorkflow = useCallback((w: EvaluationWorkflowDto) => {
    innerRef.current?.importGraph(evaluationDtoToGraphState(w));
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
      initialGraph={initialGraph}
      readOnly={readOnly}
      renderInspector={(ctx) => {

        return (
          <EvaluationWorkflowNodeInspectorPanel
            readOnly={ctx.readOnly}
            node={ctx.selectedNode}
            onParamChange={ctx.patchNodeParam}
            onDeleteNode={ctx.deleteSelectedNode}
          />
        );
      }}
    />
  );
});

export const EvaluationWorkflowCanvas = forwardRef<
  EvaluationWorkflowCanvasHandle,
  EvaluationWorkflowCanvasProps
>(function EvaluationWorkflowCanvas(props, ref) {
  return <EvaluationWorkflowCanvasInner {...props} ref={ref} />;
});
