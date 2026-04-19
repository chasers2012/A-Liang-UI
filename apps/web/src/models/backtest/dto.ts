/** 回测运行 DTO（与后端 `/backtests` 契约一致）。 */

export type BacktestRunStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

export interface BacktestRunSummary {
  id: string;
  strategy_id: string;
  data_set_id: string;
  status: BacktestRunStatus;
  queued_at: string;
  start_at: string | null;
  end_at: string | null;
  error: string | null;
}

export interface BacktestRunDetail extends BacktestRunSummary {
  results: unknown;
}

export interface BacktestEquityResponse {
  run_id: string;
  equity_curve: Array<Record<string, unknown>>;
}

export interface BacktestTradesResponse {
  run_id: string;
  trades: Array<Record<string, unknown>>;
}
