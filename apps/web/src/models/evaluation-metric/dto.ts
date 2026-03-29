/** 评价指标（用户自定义 Python 指标）DTO。 */

export type MetricVisualizationMode =
  | "auto"
  | "bars"
  | "bars_diverging"
  | "table"
  | "json"
  | "scalar";

export interface MetricVisualizationSpec {
  mode: MetricVisualizationMode;
  period_day_keys: boolean;
}

export type NodeParamType = "number" | "boolean" | "enum" | "string";

/** 与后端 ``workflow.NodeParamModel``（JSON）一致；用于工作流节点 ``evaluate`` 的额外 kwargs。 */
export interface NodeParamModel {
  key: string;
  label: string;
  type: NodeParamType;
  default?: string | number | boolean | null;
  minimum?: number | null;
  maximum?: number | null;
  enum_values: string[];
}

export interface EvaluationMetricSummaryPublic {
  id: string;
  name: string;
  description: string;
  source_path: string;
  /** 工作流节点 ``type``，与 ``user_metric_<uuid>`` 或后端内置前缀一致。 */
  workflow_type_id: string;
  created_at: string;
  updated_at: string;
  visualization?: MetricVisualizationSpec | null;
  builtin?: boolean;
  workflow_parameters?: NodeParamModel[];
}

export interface EvaluationMetricDetailPublic extends EvaluationMetricSummaryPublic {
  source: string;
}
