import type {
  WorkflowGraphSelectedNode,
  WorkflowNodeDisplayData,
} from "@/components/workflow-graph";

import type { NodeParamModel } from "@/models/evaluation-metric/dto";

import type {
  EvaluationNodeTypeCatalogItemPublic,
  WorkflowNodeDto,
} from "@/lib/quant-agent-api";

export type EvalWorkflowNodeData = WorkflowNodeDisplayData;

export type EvalWorkflowCanvasNode = WorkflowGraphSelectedNode;

export function enrichNodeData(
  n: WorkflowNodeDto,
  catalog: Map<string, EvaluationNodeTypeCatalogItemPublic>,
): EvalWorkflowNodeData {
  const def = catalog.get(n.type);
  return {
    backendType: n.type,
    label: def?.label ?? n.type,
    category: def?.category,
    inputs: def?.inputs ?? [],
    outputs: def?.outputs ?? [],
    params: { ...(n.params ?? {}) } as Record<string, NodeParamModel>,
  };
}

export function catalogToMap(
  defs: EvaluationNodeTypeCatalogItemPublic[],
): Map<string, EvaluationNodeTypeCatalogItemPublic> {
  return new Map(defs.map((d) => [d.type, d]));
}
