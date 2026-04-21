import type {
  BacktestEquityResponse,
  BacktestRunDetail,
  BacktestRunSummary,
  BacktestTradesResponse,
  BacktestNodeOutputResponse,
  BacktestNodeCsvPageResponse,
} from '@/models/backtest/dto';
import { apiFetchJson } from './client';

export function runBacktest(body: unknown): Promise<BacktestRunSummary> {
  return apiFetchJson<BacktestRunSummary>('/backtests/run', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function listBacktests(params?: {
  strategyId?: string;
  status?: string;
  limit?: number;
}): Promise<BacktestRunSummary[]> {
  const qs = new URLSearchParams();
  if (params?.strategyId) qs.set('strategy_id', params.strategyId);
  if (params?.status) qs.set('status', params.status);
  if (params?.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString();
  return apiFetchJson<BacktestRunSummary[]>(`/backtests${suffix ? `?${suffix}` : ''}`);
}

export function getBacktest(runId: string): Promise<BacktestRunDetail> {
  return apiFetchJson<BacktestRunDetail>(`/backtests/${encodeURIComponent(runId)}`);
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

export function getBacktestNodeOutput(runId: string, nodeId: string): Promise<BacktestNodeOutputResponse> {
  return apiFetchJson<BacktestNodeOutputResponse>(
    `/backtests/${encodeURIComponent(runId)}/nodes/${encodeURIComponent(nodeId)}/output`,
  );
}

export function getBacktestNodeCsvPage(params: {
  runId: string;
  nodeId: string;
  file: string;
  page: number;
  pageSize: number;
}): Promise<BacktestNodeCsvPageResponse> {
  const qs = new URLSearchParams();
  qs.set('file', params.file);
  qs.set('page', String(params.page));
  qs.set('page_size', String(params.pageSize));
  return apiFetchJson<BacktestNodeCsvPageResponse>(
    `/backtests/${encodeURIComponent(params.runId)}/nodes/${encodeURIComponent(params.nodeId)}/output/page?${qs.toString()}`,
  );
}
