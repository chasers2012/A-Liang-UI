/** 评价方案（工作流图）与节点类型目录 DTO。 */

import type { NodeParamModel } from "../evaluation-metric/dto";

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

export interface NodeTypeSocketPublic {
  name: string;
  required: boolean;
  value_type: string;
}

/** /evaluation-profiles/node-types 的目录项（节点定义 + 业务扩展字段）。 */
export interface EvaluationNodeTypeCatalogItemPublic {
  type: string;
  label: string;
  description: string;
  /** workflow.Node.category：前端用于分组/展示 */
  category: string;
  inputs: NodeTypeSocketPublic[];
  outputs: NodeTypeSocketPublic[];
  /** 来自 workflow.Node.parameters（用于 JSON/节点参数回显） */
  parameters?: NodeParamModel[];
  /** 来自后端额外计算：指标绑定/用户自定义的工作流参数 spec */
  workflow_parameters: NodeParamModel[];
  metric_id: string | null;
  socket_labels?: Record<string, string>;
  period_day_style_sockets?: string[];
}
