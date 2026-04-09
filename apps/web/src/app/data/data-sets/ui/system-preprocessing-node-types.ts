import type { WorkflowGraphPersisted } from "@/components/workflow-graph/reactflow/types";
import type { WorkflowSocketDefinition } from "@/components/workflow-graph/types";

export const DATA_SET_FRAMES_INPUT_NODE_TYPE =
  "factor.preprocessing_workflow_nodes.DataSetFramesInput";

export const COLLECT_FRAMES_NODE_TYPE =
  "factor.preprocessing_workflow_nodes.CollectFrames";

export const SYSTEM_PREPROCESSING_NODE_CATEGORY = "data_set_preprocess";
export const PREPROCESSING_DATAFRAME_VALUE_TYPE = "dataframe";
export const COLLECT_FRAMES_INPUT_SOCKET = "dataframe";

const FRAMES_INPUT_NODE_ID_BASE = "frames_input";
const COLLECT_FRAMES_NODE_ID_BASE = "collect_frames";

export const SYSTEM_PREPROCESSING_NODE_TYPES = new Set<string>([
  DATA_SET_FRAMES_INPUT_NODE_TYPE,
  COLLECT_FRAMES_NODE_TYPE,
]);

function nextAvailableNodeId(preferred: string, takenIds: Set<string>): string {
  if (!takenIds.has(preferred)) return preferred;
  let idx = 1;
  while (true) {
    const candidate = `${preferred}_${idx}`;
    if (!takenIds.has(candidate)) return candidate;
    idx += 1;
  }
}

export function ensureSystemPreprocessingNodes(
  workflow: WorkflowGraphPersisted,
): WorkflowGraphPersisted {
  const nodes = [...(workflow.nodes ?? [])];
  const links = [...(workflow.links ?? [])];
  const takenIds = new Set(
    nodes
      .map((node) => (typeof node.id === "string" ? node.id.trim() : ""))
      .filter(Boolean),
  );
  const hasFramesInput = nodes.some(
    (node) => node.type === DATA_SET_FRAMES_INPUT_NODE_TYPE,
  );
  const hasCollectFrames = nodes.some(
    (node) => node.type === COLLECT_FRAMES_NODE_TYPE,
  );

  if (!hasFramesInput) {
    const id = nextAvailableNodeId(FRAMES_INPUT_NODE_ID_BASE, takenIds);
    takenIds.add(id);
    nodes.push({
      id,
      type: DATA_SET_FRAMES_INPUT_NODE_TYPE,
      label: "原始 frames 输入",
      category: SYSTEM_PREPROCESSING_NODE_CATEGORY,
      inputs: [],
      outputs: [],
      pos: [0, 0],
      params: {},
    });
  }
  if (!hasCollectFrames) {
    const id = nextAvailableNodeId(COLLECT_FRAMES_NODE_ID_BASE, takenIds);
    nodes.push({
      id,
      type: COLLECT_FRAMES_NODE_TYPE,
      label: "预处理结果收集",
      category: SYSTEM_PREPROCESSING_NODE_CATEGORY,
      inputs: [],
      outputs: [],
      pos: [360, 0],
      params: {},
    });
  }

  if (nodes.length === (workflow.nodes ?? []).length) return workflow;
  return { ...workflow, nodes, links };
}

export function buildFramesInputOutputs(
  datasourceIds: string[],
  datasourceNameById: Record<string, string>,
): WorkflowSocketDefinition[] {
  const out: WorkflowSocketDefinition[] = [];
  for (const dsId of datasourceIds) {
    const displayName = datasourceNameById[dsId]?.trim() || dsId;
    out.push({
      name: dsId,
      required: false,
      value_type: PREPROCESSING_DATAFRAME_VALUE_TYPE,
      label: displayName,
      description: `仅包含数据源 ${displayName} 的原始 frames 映射。`,
    });
  }
  return out;
}

export function syncSystemPreprocessingWorkflow(
  workflow: WorkflowGraphPersisted,
  datasourceIds: string[],
  datasourceNameById: Record<string, string>,
): WorkflowGraphPersisted {
  const ensuredWorkflow = ensureSystemPreprocessingNodes(workflow);
  const desiredOutputs = buildFramesInputOutputs(datasourceIds, datasourceNameById);
  const desiredSocketNames = new Set(desiredOutputs.map((x) => x.name));
  const currentFramesInputNode = ensuredWorkflow.nodes.find(
    (n) => n.type === DATA_SET_FRAMES_INPUT_NODE_TYPE,
  );
  const framesInputNodeId = currentFramesInputNode?.id;
  if (!framesInputNodeId) return ensuredWorkflow;
  let hasChange = false;
  const nodes = ensuredWorkflow.nodes.map((node) => {
    if (node.type !== DATA_SET_FRAMES_INPUT_NODE_TYPE) return node;
    const current = JSON.stringify(node.outputs ?? []);
    const next = JSON.stringify(desiredOutputs);
    if (current === next) return node;
    hasChange = true;
    return { ...node, outputs: desiredOutputs };
  });

  const validLinks = ensuredWorkflow.links
    .map((link) => {
      if (link.from_node !== framesInputNodeId) return link;
      if (desiredSocketNames.has(link.from_socket)) return link;
      return null;
    })
    .filter((x): x is WorkflowGraphPersisted["links"][number] => {
      const keep = x !== null;
      if (!keep) hasChange = true;
      return keep;
    });
  let links = validLinks;

  const collectNode = [...nodes]
    .reverse()
    .find((n) => n.type === COLLECT_FRAMES_NODE_TYPE);
  if (collectNode && datasourceIds.length > 0) {
    const existingDirectLinkSockets = new Set(
      links
        .filter(
          (l) =>
            l.from_node === framesInputNodeId &&
            l.to_node === collectNode.id &&
            l.to_socket === COLLECT_FRAMES_INPUT_SOCKET,
        )
        .map((l) => l.from_socket),
    );
    const defaultLinks = datasourceIds
      .filter((dsId) => !existingDirectLinkSockets.has(dsId))
      .map((dsId) => ({
        from_node: framesInputNodeId,
        from_socket: dsId,
        to_node: collectNode.id,
        to_socket: COLLECT_FRAMES_INPUT_SOCKET,
        id: null,
      }));
    if (defaultLinks.length > 0) {
      hasChange = true;
      links = [...links, ...defaultLinks];
    }
  }

  // CollectFrames uses appendable input; ReactFlow restores those edges from
  // node.params.dataframe (not from links), so keep params in sync with links.
  const nodesWithCollectParams = nodes.map((node) => {
    if (!collectNode || node.id !== collectNode.id) return node;
    const framesWires = links
      .filter(
        (l) =>
          l.to_node === collectNode.id &&
          l.to_socket === COLLECT_FRAMES_INPUT_SOCKET,
      )
      .map((l) => ({
        from_node: l.from_node,
        from_socket: l.from_socket,
      }));
    const nodeParams = node.params ?? {};
    const prevFramesWires = Array.isArray(nodeParams[COLLECT_FRAMES_INPUT_SOCKET])
      ? nodeParams[COLLECT_FRAMES_INPUT_SOCKET]
      : [];
    if (JSON.stringify(prevFramesWires) === JSON.stringify(framesWires)) {
      return node;
    }
    hasChange = true;
    return {
      ...node,
      params: {
        ...nodeParams,
        [COLLECT_FRAMES_INPUT_SOCKET]: framesWires,
      },
    };
  });

  if (!hasChange) return ensuredWorkflow;
  return { ...ensuredWorkflow, nodes: nodesWithCollectParams, links };
}
