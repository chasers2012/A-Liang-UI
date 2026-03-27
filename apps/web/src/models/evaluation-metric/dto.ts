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

export interface EvaluationMetricSummaryPublic {
  id: string;
  name: string;
  description: string;
  source_path: string;
  created_at: string;
  updated_at: string;
  visualization?: MetricVisualizationSpec | null;
  builtin?: boolean;
}

export interface EvaluationMetricDetailPublic extends EvaluationMetricSummaryPublic {
  source: string;
}
