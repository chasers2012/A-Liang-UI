/** 评价方案（工作流图）与节点类型清单 DTO。 */

import { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';

/** 从工作流图序列化中解析出的工作流节点摘要（供结构消费方使用，如工具函数或校验）。 */
export interface WorkflowNodeDto {
  id: string;
  type: string;
  pos: [number, number];
  params: Record<string, unknown>;
}

export interface EvaluationProfilePublic {
  id: string;
  name: string;
  description: string;
  workflow: WorkflowGraphPersisted;
  created_at: string;
  updated_at: string;
}

/** 与后端 ``Socket.serialize()`` / ``NodeParam.serialize()`` 对齐的统一输入项。 */
export interface NodeTypeSocketPublic {
  name: string;
  required: boolean;
  value_type: string;
  label?: string;
  description?: string;
  default?: unknown;
  render_type?: string | null;
  options?: Array<string | number> | null;
  type?: string;
  minimum?: number | null;
  maximum?: number | null;
}

export interface WorkflowIOSpecPublic {
  workflow_inputs: NodeTypeSocketPublic[];
  workflow_outputs: NodeTypeSocketPublic[];
}
