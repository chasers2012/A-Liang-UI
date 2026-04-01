import type { LGraph, LGraphNode } from "litegraph.js";

import { buildNodeDisplayData } from "../graph-model";
import { graphNodes } from "../litegraph";
import type {
  WorkflowGraphNode,
  WorkflowGraphSelectedNode,
  WorkflowNodeTypeDefinition,
  WorkflowStepProperties,
} from "../types";

export function findNodeByWorkflowId(
  graph: LGraph,
  workflowNodeId: string,
): LGraphNode | undefined {
  return graphNodes(graph).find(
    (n) =>
      (n.properties as WorkflowStepProperties).workflowNodeId === workflowNodeId,
  );
}

export function liteGraphNodeToSelectedNode(
  node: LGraphNode,
  catalog: Map<string, WorkflowNodeTypeDefinition>,
): WorkflowGraphSelectedNode | null {
  const p = node.properties as WorkflowStepProperties;
  if (!p.workflowNodeId || !p.backendType) return null;
  const wf: WorkflowGraphNode = {
    id: p.workflowNodeId,
    type: p.backendType,
    pos: [node.pos[0], node.pos[1]],
    params: { ...(p.params ?? {}) },
  };
  return {
    id: p.workflowNodeId,
    position: { x: node.pos[0], y: node.pos[1] },
    data: buildNodeDisplayData(wf, catalog),
  };
}
