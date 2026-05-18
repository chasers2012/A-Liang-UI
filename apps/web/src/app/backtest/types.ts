export interface StrategyDetailPanelData {
  workflow: unknown;
  updated_at: string;
}

export interface BacktestRunDetailViewData {
  id: string;
  status: string;
  strategy_id?: string | null;
  strategy_name?: string | null;
  data_set_name?: string | null;
  error?: string | null;
  results: unknown;
}
