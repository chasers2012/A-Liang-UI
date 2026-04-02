/** 评价方案（工作流图）与节点类型目录 DTO。 */

import type { NodeParamType } from "../evaluation-metric/dto";

/** LiteGraph `graph.serialize()` 的 JSON 字符串（持久化字段）。 */
export type EvaluationWorkflowGraphJson = string;

/** 从 LiteGraph 序列化中解析出的工作流节点摘要（供展示/工具函数）。 */
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
  data_set_id: string | null;
  workflow: EvaluationWorkflowGraphJson;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/** 与后端 ``Socket.serialize()`` / ``NodeParam.serialize()`` 对齐的统一输入项。 */
export interface NodeTypeSocketPublic {
  name: string;
  required: boolean;
  value_type: string;
  label?: string;
  default?: unknown;
  render_type?: string | null;
  options?: Array<string | number> | null;
  type?: NodeParamType;
  minimum?: number | null;
  maximum?: number | null;
}

/** /evaluation-profiles/node-types 的目录项（节点定义 + 业务扩展字段）。 */
export interface EvaluationNodeTypeCatalogItemPublic {
  type: string;
  label: string;
  description: string;
  /** workflow.Node.category：前端用于分组/展示 */
  category: string | null;
  inputs: NodeTypeSocketPublic[];
  outputs: NodeTypeSocketPublic[];
  metric_id?: string | null;
  socket_labels?: Record<string, string>;
  period_day_style_sockets?: string[];
}
