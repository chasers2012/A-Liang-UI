import type { Edge, Node } from "@xyflow/react";

import type {
  EvaluationWorkflowDto,
  NodeTypeDefinitionPublic,
  WorkflowLinkDto,
  WorkflowNodeDto,
} from "@/lib/quant-agent-api";

export const EVAL_WORKFLOW_NODE_TYPE = "evalWorkflowNode" as const;

export type EvalWorkflowNodeData = {
  backendType: string;
  label: string;
  inputs: { name: string; required: boolean; value_type: string }[];
  outputs: { name: string; required: boolean; value_type: string }[];
  params: Record<string, unknown>;
};

export function enrichNodeData(
  n: WorkflowNodeDto,
  catalog: Map<string, NodeTypeDefinitionPublic>,
): EvalWorkflowNodeData {
  const def = catalog.get(n.type);
  return {
    backendType: n.type,
    label: def?.label ?? n.type,
    inputs: def?.inputs ?? [],
    outputs: def?.outputs ?? [],
    params: { ...(n.params ?? {}) },
  };
}

export function workflowToNodesEdges(
  workflow: EvaluationWorkflowDto,
  catalog: Map<string, NodeTypeDefinitionPublic>,
): { nodes: Node<EvalWorkflowNodeData>[]; edges: Edge[] } {
  const nodes: Node<EvalWorkflowNodeData>[] = (workflow.nodes ?? []).map(
    (n) => ({
      id: n.id,
      type: EVAL_WORKFLOW_NODE_TYPE,
      position: { x: n.pos[0], y: n.pos[1] },
      data: enrichNodeData(n, catalog),
    }),
  );
  const edges: Edge[] = (workflow.links ?? []).map((l, i) => ({
    id:
      l.id && !String(l.id).startsWith("xy-edge__")
        ? String(l.id)
        : `e-${l.from_node}-${l.from_socket}-${l.to_node}-${l.to_socket}-${i}`,
    source: l.from_node,
    target: l.to_node,
    sourceHandle: l.from_socket,
    targetHandle: l.to_socket,
  }));
  return { nodes, edges };
}

export function nodesEdgesToWorkflow(
  nodes: Node<EvalWorkflowNodeData>[],
  edges: Edge[],
  viewport: { x: number; y: number; zoom: number } | null,
): EvaluationWorkflowDto {
  const wNodes: WorkflowNodeDto[] = nodes.map((n) => ({
    id: n.id,
    type: n.data.backendType,
    pos: [n.position.x, n.position.y],
    params: { ...n.data.params },
  }));
  const wLinks: WorkflowLinkDto[] = edges.map((e) => ({
    id: e.id.startsWith("e-") ? undefined : e.id,
    from_node: e.source,
    from_socket: e.sourceHandle ?? "",
    to_node: e.target,
    to_socket: e.targetHandle ?? "",
  }));
  return {
    nodes: wNodes,
    links: wLinks,
    viewport: viewport
      ? { x: viewport.x, y: viewport.y, zoom: viewport.zoom }
      : null,
  };
}

export function catalogToMap(
  defs: NodeTypeDefinitionPublic[],
): Map<string, NodeTypeDefinitionPublic> {
  return new Map(defs.map((d) => [d.type, d]));
}
