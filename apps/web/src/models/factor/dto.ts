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

/** GET /factors/default-source — bootstrap editor from server template. */
export interface FactorDefaultSourcePublic {
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
  mean_ic: Record<string, number>;
  mean_return_spread?: Record<string, number>;
  error?: string | null;
  /** Present when the run used a named evaluation profile (with or without workflow nodes). */
  evaluation_profile_id?: string | null;
  /** Workflow node id → output socket → value (e.g. period → scalar for IC/spread). */
  metric_results?: Record<string, unknown>;
}

export interface FactorEvaluationsSummaryPublic {
  aggregate: FactorEvaluationsAggregatePublic;
  rows: FactorEvaluationRowPublic[];
}
