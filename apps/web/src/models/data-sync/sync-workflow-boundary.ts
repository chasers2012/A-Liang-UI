import {
  buildFramesInputOutputs,
  PREPROCESSING_DATAFRAME_VALUE_TYPE,
} from '@/app/data/data-sets/components/panel/system-preprocessing-node-types';
import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import type { WorkflowSocketDefinition } from '@/components/workflow-graph/types';

function removeInvalidWorkflowInputLinks(
  links: WorkflowGraphPersisted['links'],
  allowedInputSockets: Set<string>,
): WorkflowGraphPersisted['links'] {
  return links.filter((link) => {
    if (link.from.kind !== 'workflow_input') return true;
    return allowedInputSockets.has(link.from.socket);
  });
}

function removeInvalidWorkflowOutputLinks(
  links: WorkflowGraphPersisted['links'],
  allowedOutputSockets: Set<string>,
): WorkflowGraphPersisted['links'] {
  return links.filter((link) => {
    if (link.to.kind !== 'workflow_output') return true;
    return allowedOutputSockets.has(link.to.socket);
  });
}

/** 单源单目标时，未连线的输入自动直连到唯一输出（透传）。 */
function appendSingleSourceTargetPassthrough(
  links: WorkflowGraphPersisted['links'],
  sourceSocketNames: Set<string>,
  targetSocketNames: Set<string>,
): WorkflowGraphPersisted['links'] {
  if (sourceSocketNames.size !== 1 || targetSocketNames.size !== 1) return links;
  const inputSocket = [...sourceSocketNames][0];
  const outputSocket = [...targetSocketNames][0];
  if (!inputSocket || !outputSocket) return links;

  const outputAlreadyConnected = links.some(
    (link) => link.to.kind === 'workflow_output' && link.to.socket === outputSocket,
  );
  if (outputAlreadyConnected) return links;

  const hasOutgoingFromInput = links.some(
    (link) => link.from.kind === 'workflow_input' && link.from.socket === inputSocket,
  );
  if (hasOutgoingFromInput) return links;

  return [
    ...links,
    {
      id: `auto:${inputSocket}->workflow-output:${outputSocket}`,
      from: { kind: 'workflow_input', socket: inputSocket },
      to: { kind: 'workflow_output', socket: outputSocket },
    },
  ];
}

function buildSourceInputs(
  sourceIds: string[],
  datasourceNameById: Record<string, string>,
): WorkflowSocketDefinition[] {
  return buildFramesInputOutputs(sourceIds, datasourceNameById).map((s) => ({
    ...s,
    description: `源数据源「${s.label}」加载的 DataFrame。`,
  }));
}

function buildTargetOutputs(
  targetIds: string[],
  datasourceNameById: Record<string, string>,
): WorkflowSocketDefinition[] {
  return buildFramesInputOutputs(targetIds, datasourceNameById).map((s) => ({
    ...s,
    required: true,
    description: `将写入目标数据源「${s.label}」的 DataFrame。`,
  }));
}

/** 将工作流边界与任务配置中的源/目标数据源列表对齐（与数据集预处理边界同步类似）。 */
export function syncWorkflowBoundary(
  workflow: WorkflowGraphPersisted,
  sourceIds: string[],
  targetIds: string[],
  datasourceNameById: Record<string, string>,
): WorkflowGraphPersisted {
  const desiredInputs = buildSourceInputs(sourceIds, datasourceNameById);
  const desiredOutputs = buildTargetOutputs(targetIds, datasourceNameById);
  const desiredInputNames = new Set(desiredInputs.map((x) => x.name));
  const desiredOutputNames = new Set(desiredOutputs.map((x) => x.name));

  const validLinks = removeInvalidWorkflowOutputLinks(
    removeInvalidWorkflowInputLinks(workflow.links, desiredInputNames),
    desiredOutputNames,
  );
  const nextLinks = appendSingleSourceTargetPassthrough(validLinks, desiredInputNames, desiredOutputNames);

  const sameInputs = JSON.stringify(workflow.workflow_inputs) === JSON.stringify(desiredInputs);
  const sameOutputs = JSON.stringify(workflow.workflow_outputs) === JSON.stringify(desiredOutputs);
  const sameLinks = JSON.stringify(nextLinks) === JSON.stringify(workflow.links);
  if (sameInputs && sameOutputs && sameLinks) {
    return workflow;
  }

  return {
    ...workflow,
    workflow_inputs: desiredInputs,
    workflow_outputs: desiredOutputs,
    links: nextLinks,
  };
}

export { PREPROCESSING_DATAFRAME_VALUE_TYPE };
