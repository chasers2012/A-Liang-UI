/** 评价方案（工作流图）与节点类型目录 DTO。 */

import type { NodeParamModel } from "../evaluation-metric/dto";

export interface WorkflowNodeDto {
  id: string;
  type: string;
  pos: [number, number];
  params: Record<string, unknown>;
}

export interface WorkflowLinkDto {
  id?: string | null;
  from_node: string;
  from_socket: string;
  to_node: string;
  to_socket: string;
}

export interface EvaluationWorkflowDto {
  nodes: WorkflowNodeDto[];
  links: WorkflowLinkDto[];
  viewport?: { x: number; y: number; zoom: number } | null;
}

export interface EvaluationProfilePublic {
  id: string;
  name: string;
  description: string;
  data_set_id: string | null;
  workflow: EvaluationWorkflowDto;
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
