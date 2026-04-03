import type { WorkflowGraphNode, WorkflowNodeTypeDefinition } from "./types";

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
    label: type,
    inputs: [],
    outputs: [],
    pos: readPos(node.pos),
    params: normalizeParams(node.params),
  };
}

/**
 * 从工作流图 JSON 中提取节点为 `WorkflowGraphNode[]`。
 *
 * 仅支持当前 schema：`{ nodes: [{id,type,pos,params?}], links: [...] }`
 */
function parseOneSerializedStepNode(n: unknown): WorkflowGraphNode | null {
  if (!n || typeof n !== "object") return null;
  const node = n as Record<string, unknown>;
  return parseAsNewWorkflowNode(node);
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
