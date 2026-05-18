/** 回测运行 DTO（与后端 `/backtests` 契约一致）。 */

/** Scheduler one-off task type for a single backtest run. */
export const BACKTEST_RUN_TASK_TYPE = 'backtest.run';

export type BacktestRunStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

export interface BacktestRunSummary {
  id: string;
  strategy_id: string;
  strategy_name: string | null;
  data_set_id: string;
  data_set_name: string | null;
  status: BacktestRunStatus;
  queued_at: string;
  start_at: string | null;
  end_at: string | null;
  error: string | null;
}

export interface BacktestRunDetail extends BacktestRunSummary {
  results: unknown;
}

export interface BacktestRunListResponse {
  items: BacktestRunSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface BacktestEquityResponse {
  run_id: string;
  equity_curve: Array<Record<string, unknown>>;
}

export interface BacktestTradesResponse {
  run_id: string;
  trades: Array<Record<string, unknown>>;
}

export interface BacktestNodeOutputFile {
  name: string;
  kind: 'json' | 'text' | 'csv';
  content: unknown;
}

export interface BacktestNodeOutputResponse {
  run_id: string;
  node_id: string;
  files: BacktestNodeOutputFile[];
}

export interface BacktestNodeCsvPageResponse {
  run_id: string;
  node_id: string;
  file: string;
  kind: 'csv' | 'missing';
  headers: string[];
  rows: string[][];
  pagination: {
    page: number;
    page_size: number;
    total_rows: number;
    total_pages: number;
  };
}
