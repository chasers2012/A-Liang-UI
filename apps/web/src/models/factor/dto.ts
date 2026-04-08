/** 因子注册、评价汇总与历史记录 DTO。 */

export interface FactorSummaryPublic {
  id: string;
  name: string;
  group: string;
  description: string;
  max_window: number;
  dependencies: string[];
  source_path: string;
  created_at: string;
  updated_at: string;
}

export interface FactorDetailPublic extends FactorSummaryPublic {
  source: string;
}

export interface FactorEvaluationsAggregatePublic {
  total_factors: number;
  evaluated_count: number;
  unevaluated_count: number;
  primary_period: string;
  mean_ic_primary_avg: number | null;
}

export interface FactorEvaluationRowPublic {
  factor_id: string;
  name: string;
  has_evaluation: boolean;
  evaluated_at?: string | null;
  window?: { start?: string | null; end?: string | null } | null;
  stock_count?: number | null;
  error?: string | null;
  /**
   * Workflow collected results payload (来自后端 FactorEvaluationRowPublic#results).
   * 具体结构取决于工作流中 CollectResult 节点的输入/连线配置。
   */
  results?: unknown;

  // 以下字段目前主要用于展示聚合指标；后端可能不返回时请按需兼容。
  mean_ic?: Record<string, number>;
  mean_return_spread?: Record<string, number>;
  /** Present when the run used a named evaluation profile (with or without workflow nodes). */
  evaluation_profile_id?: string | null;
}

export interface FactorEvaluationsSummaryPublic {
  aggregate: FactorEvaluationsAggregatePublic;
  rows: FactorEvaluationRowPublic[];
}
