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
};

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
  const { from_node, from_socket, to_node, to_socket, id } = l;
  if (
    typeof from_node !== "string" ||
    typeof from_socket !== "string" ||
    typeof to_node !== "string" ||
    typeof to_socket !== "string"
  ) {
    return null;
  }
  return {
    id: typeof id === "string" || id === null ? id : undefined,
    from_node,
    from_socket,
    to_node,
    to_socket,
  };
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

  return {
    nodes,
    links,
  };
}

export function toReactFlowNodes(
  persisted: WorkflowGraphPersisted,
  catalog: Record<string, WorkflowNodeTypeDefinition>,
): Node[] {
  return persisted.nodes.map((n) => {
    const def = catalog[n.type];
    const persistedInputs = arrayOrEmpty<WorkflowNodeInputSpec>(n.inputs);
    const persistedOutputs = arrayOrEmpty<WorkflowSocketDefinition>(n.outputs);
    return {
      id: n.id,
      type: "workflowStep",
      position: { x: num(n.pos?.[0]), y: num(n.pos?.[1]) },
      data: {
        backendType: n.type,
        label: def?.label ?? n.label ?? n.type,
        // Prefer persisted sockets when available, so dynamic node sockets
        // (e.g. DataSetFramesInput per-datasource outputs) are preserved.
        inputs: persistedInputs.length > 0 ? persistedInputs : (def?.inputs ?? []),
        outputs:
          persistedOutputs.length > 0 ? persistedOutputs : (def?.outputs ?? []),
        params: { ...(n.params ?? {}) },
      },
    } satisfies Node;
  });
}

/**
 * 持久化 JSON 中不含 `__appendable__`：appendable 边仅从各节点 `params[socketName]`
 * 的连线列表按序还原 `targetHandle`；普通端口仍来自 `links`。
 */
export function toReactFlowEdges(persisted: WorkflowGraphPersisted): Edge[] {
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

  for (const l of persisted.links) {
    const bases = appendableBasesByTargetNode.get(l.to_node);
    if (bases?.has(l.to_socket)) {
      continue;
    }
    edges.push({
      id:
        l.id ?? `${l.from_node}:${l.from_socket}->${l.to_node}:${l.to_socket}`,
      source: l.from_node,
      sourceHandle: l.from_socket,
      target: l.to_node,
      targetHandle: l.to_socket,
      type: "default",
    });
  }

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

/** 画布边上的内部 handle（可含 `__appendable__`），仅用于排序写入 params */
type EdgeWireAcc = {
  internalTargetHandle: string;
  from_node: string;
  from_socket: string;
};

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
    const from_node = e.source;
    const to_node = e.target;
    if (!from_node || !to_node) continue;

    const targetNode = nodes.find((n) => n.id === to_node);
    const tdata = (targetNode?.data ?? {}) as Record<string, unknown>;
    const targetInputs = arrayOrEmpty<WorkflowNodeInputSpec>(tdata.inputs);
    const appendableNames = appendableSocketNamesFromInputs(targetInputs);

    const tgtRaw = e.targetHandle ?? "";
    const base = normalizeAppendableHandle(tgtRaw);

    const to_socket = appendableNames.has(base)
      ? base
      : normalizeAppendableHandle(tgtRaw);

    outLinks.push({
      id: e.id,
      from_node,
      from_socket: normalizeAppendableHandle(e.sourceHandle ?? ""),
      to_node,
      to_socket,
    });

    if (!appendableNames.has(base)) continue;

    let bySocket = appendableWiresByNode.get(to_node);
    if (!bySocket) {
      bySocket = new Map();
      appendableWiresByNode.set(to_node, bySocket);
    }
    const acc = bySocket.get(base) ?? [];
    acc.push({
      internalTargetHandle: tgtRaw || appendableHandleId(base, 1),
      from_node,
      from_socket: normalizeAppendableHandle(e.sourceHandle ?? ""),
    });
    bySocket.set(base, acc);
  }

  return { outLinks, appendableWiresByNode };
}

function persistedNodesWithAppendableParams(
  nodes: Node[],
  appendableWiresByNode: Map<string, Map<string, EdgeWireAcc[]>>,
): WorkflowGraphPersisted["nodes"] {
  return nodes.map((n) => {
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

  return {
    nodes: outNodes,
    links: outLinks,
  };
}
