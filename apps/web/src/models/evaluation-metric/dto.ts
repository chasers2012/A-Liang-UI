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

export type MetricWorkflowParamType = "number" | "boolean" | "enum";

/** 与后端 ``MetricWorkflowParamSpec`` 一致；用于工作流节点 ``evaluate`` 的额外 kwargs。 */
export interface MetricWorkflowParamSpec {
  key: string;
  label: string;
  type: MetricWorkflowParamType;
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
  created_at: string;
  updated_at: string;
  visualization?: MetricVisualizationSpec | null;
  builtin?: boolean;
  workflow_parameters?: MetricWorkflowParamSpec[];
}

export interface EvaluationMetricDetailPublic extends EvaluationMetricSummaryPublic {
  source: string;
}
