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

function readPos(pos: unknown): [number, number] {
  const px = Array.isArray(pos) ? Number(pos[0]) : 0;
  const py = Array.isArray(pos) ? Number(pos[1]) : 0;
  return [Number.isFinite(px) ? px : 0, Number.isFinite(py) ? py : 0];
}

function normalizeParams(params: unknown): Record<string, unknown> {
  return params && typeof params === "object" && !Array.isArray(params)
    ? (params as Record<string, unknown>)
    : {};
}

function parseAsNewWorkflowNode(
  node: Record<string, unknown>,
): WorkflowGraphNode | null {
  const id = node.id;
  const type = node.type;
  if (typeof id !== "string" || typeof type !== "string") return null;
  return {
    id,
    type,
    pos: readPos(node.pos),
    params: normalizeParams(node.params),
  };
}

function parseAsLiteGraphNode(
  node: Record<string, unknown>,
): WorkflowGraphNode | null {
  const props = node.properties;
  if (!props || typeof props !== "object") return null;
  const p = props as Record<string, unknown>;
  const wid = p.workflowNodeId;
  const bt = p.backendType;
  if (typeof wid !== "string" || typeof bt !== "string") return null;
  return {
    id: wid,
    type: bt,
    pos: readPos(node.pos),
    params: normalizeParams(p.params),
  };
}

/**
 * 从工作流图 JSON 中提取节点为 `WorkflowGraphNode[]`。
 *
 * 兼容两种历史形态：
 * - 新 schema：`{ nodes: [{id,type,pos,params?}], links: [...] }`
 * - 旧 LiteGraph：`graph.serialize()`，节点信息在 `nodes[].properties.workflowNodeId/backendType/params` 中
 */
function parseOneSerializedStepNode(
  n: unknown,
): WorkflowGraphNode | null {
  if (!n || typeof n !== "object") return null;
  const node = n as Record<string, unknown>;
  return parseAsNewWorkflowNode(node) ?? parseAsLiteGraphNode(node);
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
    params: { ...(n.params ?? {}) },
  };
}
