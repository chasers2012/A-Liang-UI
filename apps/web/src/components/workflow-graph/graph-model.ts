import type { NodeParamModel } from "@/models/evaluation-metric/dto";

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

/**
 * 从 LiteGraph `graph.serialize()` JSON 中提取 `workflow_graph/step` 节点为 `WorkflowGraphNode[]`。
 */
function parseOneSerializedStepNode(
  n: unknown,
): WorkflowGraphNode | null {
  if (!n || typeof n !== "object") return null;
  const node = n as Record<string, unknown>;
  const props = node.properties;
  if (!props || typeof props !== "object") return null;
  const p = props as Record<string, unknown>;
  const wid = p.workflowNodeId;
  const bt = p.backendType;
  if (typeof wid !== "string" || typeof bt !== "string") return null;
  const pos = node.pos;
  const px = Array.isArray(pos) ? Number(pos[0]) : 0;
  const py = Array.isArray(pos) ? Number(pos[1]) : 0;
  const params = p.params;
  return {
    id: wid,
    type: bt,
    pos: [Number.isFinite(px) ? px : 0, Number.isFinite(py) ? py : 0],
    params:
      params && typeof params === "object" && !Array.isArray(params)
        ? (params as Record<string, unknown>)
        : {},
  };
}

export function parseWorkflowGraphNodesFromSerializedJson(
  json: string,
): WorkflowGraphNode[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const nodes = o.nodes;
  if (!Array.isArray(nodes)) return [];

  const out: WorkflowGraphNode[] = [];
  for (const n of nodes) {
    const one = parseOneSerializedStepNode(n);
    if (one) out.push(one);
  }
  return out;
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
    params: { ...(n.params ?? {}) } as Record<string, NodeParamModel>,
  };
}
