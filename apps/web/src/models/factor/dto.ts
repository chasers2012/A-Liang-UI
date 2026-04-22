/** 因子注册、评价汇总与历史记录 DTO。 */

export interface FactorSummaryPublic {
  id: string;
  name: string;
  group: string;
  description: string;
  window: number;
  dependencies: string[];
  source_path: string;
  created_at: string;
  updated_at: string;
}

export interface FactorDetailPublic extends FactorSummaryPublic {
  source: string;
}

export interface FactorEvaluationRowPublic {
  /** Evaluation run primary key (not factor_id/profile_id). */
  id?: string | null;
  factor_id: string;
  name: string;
  has_evaluation: boolean;
  evaluated_at?: string | null;
  window?: { start?: string | null; end?: string | null } | null;
  instrument_count?: number | null;
  error?: string | null;
  /**
   * Workflow collected results payload (来自后端 FactorEvaluationRowPublic#results).
   * 具体结构取决于工作流 workflow_outputs.result 的连线配置。
   */
  results?: unknown;
  mean_ic?: Record<string, number>;
  mean_return_spread?: Record<string, number>;
  /** Present when the run used a named evaluation profile (with or without workflow nodes). */
  evaluation_profile_id?: string | null;
}
