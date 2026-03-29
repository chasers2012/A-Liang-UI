import type {
  WorkflowGraphSelectedNode,
  WorkflowNodeDisplayData,
} from "@/components/workflow-graph";

import type {
  NodeTypeDefinitionPublic,
  WorkflowNodeDto,
} from "@/lib/quant-agent-api";

export type EvalWorkflowNodeData = WorkflowNodeDisplayData;

export type EvalWorkflowCanvasNode = WorkflowGraphSelectedNode;

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

export function catalogToMap(
  defs: NodeTypeDefinitionPublic[],
): Map<string, NodeTypeDefinitionPublic> {
  return new Map(defs.map((d) => [d.type, d]));
}
