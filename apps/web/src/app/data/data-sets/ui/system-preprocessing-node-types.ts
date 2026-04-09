import type { WorkflowGraphPersisted } from "@/components/workflow-graph/reactflow/types";
import type { WorkflowSocketDefinition } from "@/components/workflow-graph/types";

export const PREPROCESSING_DATAFRAME_VALUE_TYPE = "raw_frames";
export const SYSTEM_PREPROCESSING_NODE_TYPES = new Set<string>([]);

export const PREPROCESSING_WORKFLOW_DEFAULT_INPUTS: WorkflowSocketDefinition[] = [
  {
    name: "frames",
    required: true,
    value_type: PREPROCESSING_DATAFRAME_VALUE_TYPE,
    label: "原始 frames",
    description: "由数据集加载原始数据后提供给预处理工作流。",
    render_type: "socket",
  },
];
export const PREPROCESSING_WORKFLOW_DEFAULT_OUTPUTS: WorkflowSocketDefinition[] = [
  {
    name: "frames",
    required: true,
    value_type: PREPROCESSING_DATAFRAME_VALUE_TYPE,
    label: "预处理结果",
    description: "预处理工作流输出的 frames 映射。",
    render_type: "appendable",
  },
];

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
      description: `仅包含数据源 ${displayName} 的原始 frames。`,
      render_type: "socket",
    });
  }
  return out.length > 0 ? out : PREPROCESSING_WORKFLOW_DEFAULT_INPUTS;
}

export function syncSystemPreprocessingWorkflow(
  workflow: WorkflowGraphPersisted,
  datasourceIds: string[],
  datasourceNameById: Record<string, string>,
): WorkflowGraphPersisted {
  const desiredInputs = buildFramesInputOutputs(
    datasourceIds,
    datasourceNameById,
  );
  const desiredInputSocketNames = new Set(desiredInputs.map((x) => x.name));
  const currentInputs = workflow.workflow_inputs;
  const currentOutputs = workflow.workflow_outputs;
  const sameInputs = JSON.stringify(currentInputs) === JSON.stringify(desiredInputs);
  const validLinks = workflow.links.filter((link) => {
    if (link.from.kind !== "workflow_input") return true;
    return desiredInputSocketNames.has(link.from.socket);
  });
  const sameLinks = JSON.stringify(validLinks) === JSON.stringify(workflow.links);
  if (
    sameInputs &&
    sameLinks &&
    currentOutputs.length > 0
  ) {
    return workflow;
  }
  return {
    ...workflow,
    workflow_inputs: desiredInputs,
    workflow_outputs:
      currentOutputs.length > 0
        ? currentOutputs
        : PREPROCESSING_WORKFLOW_DEFAULT_OUTPUTS,
    links: validLinks,
  };
}
