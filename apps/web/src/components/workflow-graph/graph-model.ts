import type {
  WorkflowGraphNode,
  WorkflowNodeDisplayData,
  WorkflowNodeTypeDefinition,
} from "./types";

export function catalogToMap(
  defs: WorkflowNodeTypeDefinition[],
): Map<string, WorkflowNodeTypeDefinition> {
  return new Map(defs.map((d) => [d.type, d]));
}

export function buildNodeDisplayData(
  n: WorkflowGraphNode,
  catalog: Map<string, WorkflowNodeTypeDefinition>,
): WorkflowNodeDisplayData {
  const def = catalog.get(n.type);
  return {
    backendType: n.type,
    label: def?.label ?? n.type,
    category: def?.category,
    inputs: def?.inputs ?? [],
    outputs: def?.outputs ?? [],
    params: { ...(n.params ?? {}) },
  };
}
