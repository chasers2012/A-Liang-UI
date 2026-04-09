import type { WorkflowGraphPersisted } from "@/components/workflow-graph/reactflow/types";
import type { WorkflowSocketDefinition } from "@/components/workflow-graph/types";

export const PREPROCESSING_DATAFRAME_VALUE_TYPE = "raw_frames";
export const SYSTEM_PREPROCESSING_NODE_TYPES = new Set<string>([]);

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
  return out;
}

function removeInvalidWorkflowInputLinks(
  links: WorkflowGraphPersisted["links"],
  allowedInputSockets: Set<string>,
): WorkflowGraphPersisted["links"] {
  return links.filter((link) => {
    if (link.from.kind !== "workflow_input") return true;
    return allowedInputSockets.has(link.from.socket);
  });
}

function hasWorkflowBoundaryDirectLink(
  links: WorkflowGraphPersisted["links"],
): boolean {
  return links.some(
    (link) =>
      link.from.kind === "workflow_input" &&
      link.to.kind === "workflow_output",
  );
}

function appendMissingBoundaryDirectLinks(
  links: WorkflowGraphPersisted["links"],
  inputSocketNames: Set<string>,
  outputSocketName: string,
): WorkflowGraphPersisted["links"] {
  if (!outputSocketName) return links;
  if (hasWorkflowBoundaryDirectLink(links)) return links;
  const out = [...links];
  for (const socketName of inputSocketNames) {
    out.push({
      id: `auto:${socketName}->workflow-output:${outputSocketName}`,
      from: { kind: "workflow_input", socket: socketName },
      to: {
        kind: "workflow_output",
        socket: outputSocketName,
      },
    });
  }
  return out;
}

export function syncSystemPreprocessingWorkflow(
  workflow: WorkflowGraphPersisted,
  datasourceIds: string[],
  datasourceNameById: Record<string, string>,
  workflowTemplate?: WorkflowGraphPersisted | null,
): WorkflowGraphPersisted {
  const datasourceInputs = buildFramesInputOutputs(datasourceIds, datasourceNameById);
  const templateInputs = workflowTemplate?.workflow_inputs ?? [];
  const templateOutputs = workflowTemplate?.workflow_outputs ?? [];
  const desiredInputs =
    datasourceInputs.length > 0
      ? datasourceInputs
      : (templateInputs.length > 0 ? templateInputs : workflow.workflow_inputs);
  const desiredInputSocketNames = new Set(desiredInputs.map((x) => x.name));
  const currentInputs = workflow.workflow_inputs;
  const currentOutputs = workflow.workflow_outputs;
  const nextOutputs =
    currentOutputs.length > 0
      ? currentOutputs
      : (templateOutputs.length > 0 ? templateOutputs : workflow.workflow_outputs);
  const targetOutputSocketName = nextOutputs[0]?.name ?? "";
  const sameInputs = JSON.stringify(currentInputs) === JSON.stringify(desiredInputs);
  const validLinks = removeInvalidWorkflowInputLinks(
    workflow.links,
    desiredInputSocketNames,
  );
  const autoPatchedLinks = appendMissingBoundaryDirectLinks(
    validLinks,
    desiredInputSocketNames,
    targetOutputSocketName,
  );
  const sameLinks = JSON.stringify(autoPatchedLinks) === JSON.stringify(workflow.links);
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
    workflow_outputs: nextOutputs,
    links: autoPatchedLinks,
  };
}
