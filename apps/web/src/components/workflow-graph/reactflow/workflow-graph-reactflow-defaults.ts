import type { NodeTypes } from 'reactflow';

import { WorkflowBoundaryNode, WorkflowStepNode } from './node/nodes';

/** 模块级稳定引用，避免 React Flow #002（nodeTypes 每轮渲染新建对象）。 */
export const WORKFLOW_GRAPH_RF_NODE_TYPES: NodeTypes = {
  workflowStep: WorkflowStepNode,
  workflowBoundary: WorkflowBoundaryNode,
};

export const WORKFLOW_GRAPH_RF_PRO_OPTIONS = { hideAttribution: true } as const;
