import type { Edge, Node } from "reactflow";

import type {
  WorkflowNodeInputSpec,
  WorkflowNodeTypeDefinition,
  WorkflowSocketDefinition,
} from "../types";
import type { WorkflowGraphLink, WorkflowGraphPersisted } from "./types";
import {
  appendableHandleId,
  appendableSlotSortKey,
  normalizeAppendableHandle,
} from "./appendable-handle";

// UI-only boundary node ids (NOT persisted in workflow.nodes).
export const WORKFLOW_INPUT_NODE_ID = "workflow-input";
export const WORKFLOW_OUTPUT_NODE_ID = "workflow-output";

function appendableSocketNamesFromInputs(
  inputs: WorkflowNodeInputSpec[],
): Set<string> {
  const names = new Set<string>();
  for (const s of inputs) {
    if (s?.render_type === "appendable" && s.name) {
      names.add(s.name);
    }
  }
  return names;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object" && !Array.isArray(x);
}

function num(x: unknown, fallback = 0): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function str(x: unknown): string | undefined {
  return typeof x === "string" ? x : undefined;
}

function arrayOrEmpty<T>(x: unknown): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}

export const EMPTY_WORKFLOW: WorkflowGraphPersisted = {
  nodes: [],
  links: [],
  workflow_inputs: [],
  workflow_outputs: [],
  workflow_boundary_positions: {
    input: [-220, 0],
    output: [1100, 0],
  },
};

function buildEdgesFromLinks(persisted: WorkflowGraphPersisted): Edge[] {
  const appendableBasesByTargetNode = new Map<string, Set<string>>();
  for (const n of persisted.nodes) {
    const names = appendableSocketNamesFromInputs(
      arrayOrEmpty<WorkflowNodeInputSpec>(n.inputs),
    );
    if (names.size > 0) {
      appendableBasesByTargetNode.set(n.id, names);
    }
  }

  const edges: Edge[] = [];
  const workflowOutputSocketByName = new Map(
    arrayOrEmpty<WorkflowSocketDefinition>(persisted.workflow_outputs).map((s) => [
      s.name,
      s,
    ]),
  );
  const workflowOutputAppendableCount = new Map<string, number>();

  for (const l of persisted.links) {
    const toNodeId = l.to.kind === "node" ? l.to.node_id : WORKFLOW_OUTPUT_NODE_ID;
    const toSocket = l.to.socket;
    const fromNodeId = l.from.kind === "node" ? l.from.node_id : WORKFLOW_INPUT_NODE_ID;
    const fromSocket = l.from.socket;

    const bases = appendableBasesByTargetNode.get(toNodeId);
    if (bases?.has(toSocket)) {
      continue;
    }
    if (l.to.kind === "workflow_output") {
      const socket = workflowOutputSocketByName.get(toSocket);
      const isAppendable = socket?.render_type === "appendable";
      const nextCount = (workflowOutputAppendableCount.get(toSocket) ?? 0) + 1;
      workflowOutputAppendableCount.set(toSocket, nextCount);
      edges.push({
        id:
          l.id ??
          `${fromNodeId}:${fromSocket}->${toNodeId}:${toSocket}:${nextCount}`,
        source: fromNodeId,
        sourceHandle: fromSocket,
        target: toNodeId,
        targetHandle: isAppendable
          ? appendableHandleId(toSocket, nextCount)
          : toSocket,
        type: "default",
      });
      continue;
    }
    edges.push({
      id: l.id ?? `${fromNodeId}:${fromSocket}->${toNodeId}:${toSocket}`,
      source: fromNodeId,
      sourceHandle: fromSocket,
      target: toNodeId,
      targetHandle: toSocket,
      type: "default",
    });
  }

  return edges;
}

function buildAppendableEdgesFromParams(persisted: WorkflowGraphPersisted): Edge[] {
  const edges: Edge[] = [];
  for (const n of persisted.nodes) {
    const names = appendableSocketNamesFromInputs(
      arrayOrEmpty<WorkflowNodeInputSpec>(n.inputs),
    );
    if (names.size === 0) continue;
    const params = isRecord(n.params) ? n.params : {};
    for (const socketName of names) {
      const raw = params[socketName];
      if (!Array.isArray(raw)) continue;
      raw.forEach((item, index) => {
        if (!isRecord(item)) return;
        const fn = item.from_node;
        const fs = item.from_socket;
        if (typeof fn !== "string" || typeof fs !== "string") return;
        edges.push({
          id: `${fn}:${fs}->${n.id}:${socketName}:${index}`,
          source: fn,
          sourceHandle: fs,
          target: n.id,
          targetHandle: appendableHandleId(socketName, index + 1),
          type: "default",
        });
      });
    }
  }
  return edges;
}

function parsePersistedNode(
  n: unknown,
): WorkflowGraphPersisted["nodes"][number] | null {
  if (!isRecord(n)) return null;
  const id = n.id;
  const type = n.type;
  if (typeof id !== "string" || typeof type !== "string") return null;
  const pos = n.pos;
  const px = Array.isArray(pos) ? num(pos[0]) : 0;
  const py = Array.isArray(pos) ? num(pos[1]) : 0;
  const params = n.params;
  return {
    id,
    type,
    label: str(n.label) ?? type,
    category: str(n.category),
    inputs: arrayOrEmpty<WorkflowNodeInputSpec>(n.inputs),
    outputs: arrayOrEmpty<WorkflowSocketDefinition>(n.outputs),
    pos: [px, py],
    params: isRecord(params) ? params : {},
  };
}

function parsePersistedLink(l: unknown): WorkflowGraphLink | null {
  if (!isRecord(l)) return null;
  const id = typeof l.id === "string" || l.id === null ? l.id : undefined;
  const from = parsePersistedEndpoint(l.from);
  const to = parsePersistedEndpoint(l.to);
  if (!from || !to) return null;
  if (from.kind === "workflow_output") return null;
  if (to.kind === "workflow_input") return null;
  return { id, from, to } as WorkflowGraphLink;
}

function parsePersistedEndpoint(
  raw: unknown,
):
  | { kind: "node"; node_id: string; socket: string }
  | { kind: "workflow_input"; socket: string }
  | { kind: "workflow_output"; socket: string }
  | null {
  if (!isRecord(raw)) return null;
  const kind = raw.kind;
  const socket = raw.socket;
  if (typeof kind !== "string" || typeof socket !== "string" || !socket) return null;
  if (kind === "workflow_input") return { kind: "workflow_input", socket };
  if (kind === "workflow_output") return { kind: "workflow_output", socket };
  if (kind !== "node") return null;
  const nodeId = raw.node_id;
  if (typeof nodeId !== "string" || !nodeId) return null;
  return { kind: "node", node_id: nodeId, socket };
}

export function parsePersistedWorkflowGraphPayload(
  raw: unknown,
): WorkflowGraphPersisted {
  if (!isRecord(raw)) return EMPTY_WORKFLOW;

  const nodes = arrayOrEmpty(raw.nodes)
    .map(parsePersistedNode)
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  const links = arrayOrEmpty(raw.links)
    .map(parsePersistedLink)
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const boundaryRaw = isRecord(raw.workflow_boundary_positions)
    ? raw.workflow_boundary_positions
    : null;
  const inputPosRaw = boundaryRaw ? boundaryRaw.input : null;
  const outputPosRaw = boundaryRaw ? boundaryRaw.output : null;
  const boundaryPositions = {
    input: [
      Array.isArray(inputPosRaw) ? num(inputPosRaw[0], -220) : -220,
      Array.isArray(inputPosRaw) ? num(inputPosRaw[1], 0) : 0,
    ] as [number, number],
    output: [
      Array.isArray(outputPosRaw) ? num(outputPosRaw[0], 1100) : 1100,
      Array.isArray(outputPosRaw) ? num(outputPosRaw[1], 0) : 0,
    ] as [number, number],
  };

  return {
    nodes,
    links,
    workflow_inputs: arrayOrEmpty<WorkflowSocketDefinition>(raw.workflow_inputs),
    workflow_outputs: arrayOrEmpty<WorkflowSocketDefinition>(raw.workflow_outputs),
    workflow_boundary_positions: boundaryPositions,
  };
}

export function toReactFlowNodes(
  persisted: WorkflowGraphPersisted,
  catalog: Record<string, WorkflowNodeTypeDefinition>,
  opts?: { readOnly?: boolean },
): Node[] {
  const readOnly = Boolean(opts?.readOnly);
  const inputBoundaryPos = persisted.workflow_boundary_positions?.input ?? [-220, 0];
  const outputBoundaryPos = persisted.workflow_boundary_positions?.output ?? [1100, 0];
  const flowNodes = persisted.nodes.map((n) => {
    const def = catalog[n.type];
    const persistedInputs = arrayOrEmpty<WorkflowNodeInputSpec>(n.inputs);
    const persistedOutputs = arrayOrEmpty<WorkflowSocketDefinition>(n.outputs);
    return {
      id: n.id,
      type: "workflowStep",
      position: { x: num(n.pos?.[0]), y: num(n.pos?.[1]) },
      deletable: true,
      data: {
        backendType: n.type,
        label: def?.label ?? n.label ?? n.type,
        // Prefer persisted sockets when available, so dynamic node sockets
        // (e.g. DataSetFramesInput per-datasource outputs) are preserved.
        inputs:
          persistedInputs.length > 0 ? persistedInputs : (def?.inputs ?? []),
        outputs:
          persistedOutputs.length > 0 ? persistedOutputs : (def?.outputs ?? []),
        params: { ...(n.params ?? {}) },
      },
    } satisfies Node;
  });
  return [
    {
      id: WORKFLOW_INPUT_NODE_ID,
      type: "workflowBoundary",
      position: { x: num(inputBoundaryPos[0], -220), y: num(inputBoundaryPos[1], 0) },
      deletable: false,
      draggable: !readOnly,
      selectable: true,
      data: {
        label: "输入",
        side: "input",
        sockets: arrayOrEmpty<WorkflowSocketDefinition>(persisted.workflow_inputs),
        inputs: [],
        outputs: arrayOrEmpty<WorkflowSocketDefinition>(persisted.workflow_inputs),
      },
    } satisfies Node,
    ...flowNodes,
    {
      id: WORKFLOW_OUTPUT_NODE_ID,
      type: "workflowBoundary",
      position: { x: num(outputBoundaryPos[0], 1100), y: num(outputBoundaryPos[1], 0) },
      deletable: false,
      draggable: !readOnly,
      selectable: true,
      data: {
        label: "输出",
        side: "output",
        sockets: arrayOrEmpty<WorkflowSocketDefinition>(persisted.workflow_outputs),
        inputs: arrayOrEmpty<WorkflowSocketDefinition>(persisted.workflow_outputs),
        outputs: [],
      },
    } satisfies Node,
  ];
}

/**
 * 持久化 JSON 中不含 `__appendable__`：appendable 边仅从各节点 `params[socketName]`
 * 的连线列表按序还原 `targetHandle`；普通端口仍来自 `links`。
 */
export function toReactFlowEdges(persisted: WorkflowGraphPersisted): Edge[] {
  return [...buildEdgesFromLinks(persisted), ...buildAppendableEdgesFromParams(persisted)];
}

/** 画布边上的内部 handle（可含 `__appendable__`），仅用于排序写入 params */
type EdgeWireAcc = {
  internalTargetHandle: string;
  from_node: string;
  from_socket: string;
};

function isBoundaryEdge(from_node: string, to_node: string): boolean {
  return from_node === WORKFLOW_INPUT_NODE_ID || to_node === WORKFLOW_OUTPUT_NODE_ID;
}

function appendableNamesForTargetNode(nodes: Node[], to_node: string): Set<string> {
  const targetNode = nodes.find((n) => n.id === to_node);
  const tdata = (targetNode?.data ?? {}) as Record<string, unknown>;
  const targetInputs = arrayOrEmpty<WorkflowNodeInputSpec>(tdata.inputs);
  return appendableSocketNamesFromInputs(targetInputs);
}

function pushBoundaryLink(outLinks: WorkflowGraphLink[], e: Edge) {
  const fromSocket = normalizeAppendableHandle(e.sourceHandle ?? "");
  const toSocket = normalizeAppendableHandle(e.targetHandle ?? "");
  outLinks.push({
    id: e.id,
    from:
      e.source === WORKFLOW_INPUT_NODE_ID
        ? { kind: "workflow_input", socket: fromSocket }
        : { kind: "node", node_id: e.source, socket: fromSocket },
    to:
      e.target === WORKFLOW_OUTPUT_NODE_ID
        ? { kind: "workflow_output", socket: toSocket }
        : { kind: "node", node_id: e.target, socket: toSocket },
  });
}

function pushNormalLink(outLinks: WorkflowGraphLink[], e: Edge, appendableNames: Set<string>) {
  const tgtRaw = e.targetHandle ?? "";
  const base = normalizeAppendableHandle(tgtRaw);
  const to_socket = appendableNames.has(base) ? base : normalizeAppendableHandle(tgtRaw);
  outLinks.push({
    id: e.id,
    from:
      e.source === WORKFLOW_INPUT_NODE_ID
        ? { kind: "workflow_input", socket: normalizeAppendableHandle(e.sourceHandle ?? "") }
        : { kind: "node", node_id: e.source, socket: normalizeAppendableHandle(e.sourceHandle ?? "") },
    to:
      e.target === WORKFLOW_OUTPUT_NODE_ID
        ? { kind: "workflow_output", socket: to_socket }
        : { kind: "node", node_id: e.target, socket: to_socket },
  });
}

function pushAppendableWireAccum(
  appendableWiresByNode: Map<string, Map<string, EdgeWireAcc[]>>,
  e: Edge,
  appendableNames: Set<string>,
) {
  const to_node = e.target;
  const tgtRaw = e.targetHandle ?? "";
  const base = normalizeAppendableHandle(tgtRaw);
  if (!appendableNames.has(base)) return;

  let bySocket = appendableWiresByNode.get(to_node);
  if (!bySocket) {
    bySocket = new Map();
    appendableWiresByNode.set(to_node, bySocket);
  }
  const acc = bySocket.get(base) ?? [];
  acc.push({
    internalTargetHandle: tgtRaw || appendableHandleId(base, 1),
    from_node: e.source,
    from_socket: normalizeAppendableHandle(e.sourceHandle ?? ""),
  });
  bySocket.set(base, acc);
}

function sortAppendableWireAccum(
  appendableWiresByNode: Map<string, Map<string, EdgeWireAcc[]>>,
) {
  for (const bySocket of appendableWiresByNode.values()) {
    for (const acc of bySocket.values()) {
      acc.sort(
        (a, b) =>
          appendableSlotSortKey(a.internalTargetHandle) -
          appendableSlotSortKey(b.internalTargetHandle),
      );
    }
  }
}

function linksAndAppendableWireAccumFromEdges(
  nodes: Node[],
  edges: Edge[],
): {
  outLinks: WorkflowGraphLink[];
  appendableWiresByNode: Map<string, Map<string, EdgeWireAcc[]>>;
} {
  const appendableWiresByNode = new Map<string, Map<string, EdgeWireAcc[]>>();
  const outLinks: WorkflowGraphLink[] = [];

  for (const e of edges) {
    if (!e.source || !e.target) continue;

    if (isBoundaryEdge(e.source, e.target)) {
      pushBoundaryLink(outLinks, e);
      continue;
    }

    const appendableNames = appendableNamesForTargetNode(nodes, e.target);
    pushNormalLink(outLinks, e, appendableNames);
    pushAppendableWireAccum(appendableWiresByNode, e, appendableNames);
  }

  return { outLinks, appendableWiresByNode };
}

function persistedNodesWithAppendableParams(
  nodes: Node[],
  appendableWiresByNode: Map<string, Map<string, EdgeWireAcc[]>>,
): WorkflowGraphPersisted["nodes"] {
  return nodes
    .filter((n) => n.id !== WORKFLOW_INPUT_NODE_ID && n.id !== WORKFLOW_OUTPUT_NODE_ID)
    .map((n) => {
    const data = (n.data ?? {}) as Record<string, unknown>;
    const backendType =
      typeof data.backendType === "string" ? data.backendType : "node";
    const rawParams = isRecord(data.params) ? { ...data.params } : {};
    const inputs = arrayOrEmpty<WorkflowNodeInputSpec>(data.inputs);
    const appendableNames = appendableSocketNamesFromInputs(inputs);
    for (const name of appendableNames) {
      delete rawParams[name];
    }

    const bySocket = appendableWiresByNode.get(n.id);
    if (bySocket && bySocket.size > 0) {
      for (const [socketBase, acc] of bySocket) {
        rawParams[socketBase] = acc.map(({ from_node, from_socket }) => ({
          from_node,
          from_socket,
        }));
      }
    }

    return {
      id: n.id,
      type: backendType,
      label: str(data.label) ?? backendType,
      category: str(data.category),
      inputs: arrayOrEmpty<WorkflowNodeInputSpec>(data.inputs),
      outputs: arrayOrEmpty<WorkflowSocketDefinition>(data.outputs),
      pos: [n.position.x, n.position.y],
      params: rawParams,
    };
    });
}

export function toPersistedWorkflowGraph(
  nodes: Node[],
  edges: Edge[],
): WorkflowGraphPersisted {
  const { outLinks, appendableWiresByNode } =
    linksAndAppendableWireAccumFromEdges(nodes, edges);
  sortAppendableWireAccum(appendableWiresByNode);
  const outNodes = persistedNodesWithAppendableParams(
    nodes,
    appendableWiresByNode,
  );

  const inputBoundaryNode = nodes.find((n) => n.id === WORKFLOW_INPUT_NODE_ID);
  const outputBoundaryNode = nodes.find((n) => n.id === WORKFLOW_OUTPUT_NODE_ID);

  return {
    nodes: outNodes,
    links: outLinks,
    workflow_inputs: arrayOrEmpty<WorkflowSocketDefinition>(
      ((nodes.find((n) => n.id === WORKFLOW_INPUT_NODE_ID)?.data ?? {}) as Record<string, unknown>)
        .outputs,
    ),
    workflow_outputs: arrayOrEmpty<WorkflowSocketDefinition>(
      ((nodes.find((n) => n.id === WORKFLOW_OUTPUT_NODE_ID)?.data ?? {}) as Record<string, unknown>)
        .inputs,
    ),
    workflow_boundary_positions: {
      input: [
        num(inputBoundaryNode?.position?.x, -220),
        num(inputBoundaryNode?.position?.y, 0),
      ],
      output: [
        num(outputBoundaryNode?.position?.x, 1100),
        num(outputBoundaryNode?.position?.y, 0),
      ],
    },
  };
}
