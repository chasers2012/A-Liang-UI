/** 评价指标（用户自定义 Python 指标）DTO。 */

export type NodeParamType = "number" | "boolean" | "string";

/** 与后端 ``workflow.NodeParamModel``（JSON）一致；用于工作流节点 ``evaluate`` 的额外 kwargs。 */
export interface NodeParamModel {
  key: string;
  label: string;
  type: NodeParamType;
  default?: string | number | boolean | null;
  minimum?: number | null;
  maximum?: number | null;
}

export interface EvaluationMetricSummaryPublic {
  id: string;
  name: string;
  description: string;
  source_path: string;
  /** 评价指标节点 id（与后端路由参数 `metric_id` 一致）。 */
  created_at: string;
  updated_at: string;
  workflow_parameters?: NodeParamModel[];
}

export interface EvaluationMetricDetailPublic extends EvaluationMetricSummaryPublic {
  source: string;
}
