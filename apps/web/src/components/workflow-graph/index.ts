import { NodeSummaryPublic } from '@/models/nodes/dto';
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

export { WorkflowNodeTypeList, type WorkflowNodeTypeListItem } from './workflow-node-type-list';

export function toWorkflowNodeTypes(catalog: NodeSummaryPublic[]): WorkflowNodeTypeDefinition[] {
  return catalog.map((c) => ({
    id: c.id,
    label: c.name,
    description: c.description,
    category: c.category ?? undefined,
    inputs: c.inputs,
    outputs: c.outputs,
  }));
}
