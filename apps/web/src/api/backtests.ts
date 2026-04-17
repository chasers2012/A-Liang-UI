import type { BacktestEquityResponse, BacktestRunPublic, BacktestTradesResponse } from '@/models/backtest/dto';
import { apiFetchJson } from './client';

export function runBacktest(body: unknown): Promise<BacktestRunPublic> {
  return apiFetchJson<BacktestRunPublic>('/backtests/run', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function listBacktests(params?: {
  strategyId?: string;
  status?: string;
  limit?: number;
}): Promise<BacktestRunPublic[]> {
  const qs = new URLSearchParams();
  if (params?.strategyId) qs.set('strategy_id', params.strategyId);
  if (params?.status) qs.set('status', params.status);
  if (params?.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString();
  return apiFetchJson<BacktestRunPublic[]>(`/backtests${suffix ? `?${suffix}` : ''}`);
}

export function getBacktest(runId: string): Promise<BacktestRunPublic> {
  return apiFetchJson<BacktestRunPublic>(`/backtests/${encodeURIComponent(runId)}`);
}

export function deleteBacktest(runId: string): Promise<void> {
  return apiFetchJson<void>(`/backtests/${encodeURIComponent(runId)}`, {
    method: 'DELETE',
  });
}

export function getBacktestEquity(runId: string): Promise<BacktestEquityResponse> {
  return apiFetchJson<BacktestEquityResponse>(`/backtests/${encodeURIComponent(runId)}/equity`);
}

export function getBacktestTrades(runId: string): Promise<BacktestTradesResponse> {
  return apiFetchJson<BacktestTradesResponse>(`/backtests/${encodeURIComponent(runId)}/trades`);
}
