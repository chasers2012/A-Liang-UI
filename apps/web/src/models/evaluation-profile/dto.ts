/** 评价方案（工作流 + Alphalens prepare）与节点类型目录 DTO。 */

import type { MetricWorkflowParamSpec } from "../evaluation-metric/dto";

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

export interface EvaluationProfilePrepareDto {
  forward_return_periods: number[];
  quantiles: number | null;
  long_short: boolean;
  max_loss: number;
}

export interface EvaluationProfilePublic {
  id: string;
  name: string;
  description: string;
  data_set_id: string | null;
  prepare: EvaluationProfilePrepareDto;
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

export interface NodeTypeDefinitionPublic {
  type: string;
  label: string;
  description: string;
  inputs: NodeTypeSocketPublic[];
  outputs: NodeTypeSocketPublic[];
  workflow_parameters: MetricWorkflowParamSpec[];
  user_defined: boolean;
  metric_id: string | null;
}
