import type { StrategyNodeTypeCatalogItemPublic, StrategyPublic, WorkflowIOSpecPublic } from '@/models';
import { apiFetchJson } from './client';

export function listStrategies(): Promise<StrategyPublic[]> {
  return apiFetchJson<StrategyPublic[]>('/strategies');
}

export function getStrategy(id: string): Promise<StrategyPublic> {
  return apiFetchJson<StrategyPublic>(`/strategies/${encodeURIComponent(id)}`);
}

export function createStrategy(body: unknown): Promise<StrategyPublic> {
  return apiFetchJson<StrategyPublic>('/strategies', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function patchStrategy(id: string, body: unknown): Promise<StrategyPublic> {
  return apiFetchJson<StrategyPublic>(`/strategies/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteStrategy(id: string): Promise<void> {
  return apiFetchJson<void>(`/strategies/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function listStrategyNodeTypes(): Promise<StrategyNodeTypeCatalogItemPublic[]> {
  return apiFetchJson<StrategyNodeTypeCatalogItemPublic[]>('/strategies/node-types');
}

export function getStrategyWorkflowIO(): Promise<WorkflowIOSpecPublic> {
  return apiFetchJson<WorkflowIOSpecPublic>('/strategies/workflow-io');
}

export function getStrategyWorkflowTemplate(): Promise<Record<string, unknown>> {
  return apiFetchJson<Record<string, unknown>>('/strategies/workflow-template');
}

export function validateStrategy(id: string): Promise<{ ok: boolean; errors: string[] }> {
  return apiFetchJson<{ ok: boolean; errors: string[] }>(`/strategies/${encodeURIComponent(id)}/validate`, { method: 'POST' });
}

export function previewStrategy(id: string): Promise<{ ok: boolean; preview: Record<string, unknown> }> {
  return apiFetchJson<{ ok: boolean; preview: Record<string, unknown> }>(`/strategies/${encodeURIComponent(id)}/preview`, { method: 'POST' });
}
