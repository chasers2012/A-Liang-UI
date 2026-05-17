import type { NodeDetailPublic, NodeSummaryPublic } from '@/models/nodes/dto';
import { WorkflowNodeTypeDefinition } from './types';

export type { WorkflowGraphNode, WorkflowNodeTypeDefinition, WorkflowSocketDefinition } from './types';

export { parsePersistedWorkflowGraphPayload } from './reactflow/serialize';

export {
  WorkflowGraphCanvas,
  WorkflowGraphZoomToolbar,
  WORKFLOW_GRAPH_NODE_DRAG_MIME,
  type WorkflowGraphCanvasHandle,
  type WorkflowGraphCanvasProps,
} from './workflow-graph-canvas';

export {
  WorkflowGraphFitViewButton,
  WORKFLOW_GRAPH_DEFAULT_FIT_VIEW,
  type WorkflowGraphFitViewButtonProps,
} from './workflow-graph-fit-view-button';

export function toWorkflowNodeTypes(catalog: NodeSummaryPublic[]): WorkflowNodeTypeDefinition[] {
  return catalog.map((c) => ({
    id: c.id,
    label: c.name,
    description: c.desc,
    category: c.category ?? undefined,
    inputs: [],
    outputs: [],
  }));
}

export function toWorkflowNodeType(detail: NodeDetailPublic): WorkflowNodeTypeDefinition {
  return {
    id: detail.id,
    label: detail.name,
    description: detail.description || detail.desc,
    category: detail.category ?? undefined,
    inputs: detail.inputs ?? [],
    outputs: detail.outputs ?? [],
  };
}
