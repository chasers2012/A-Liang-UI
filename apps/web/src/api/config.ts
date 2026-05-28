import type { ConfigSpecsResponse, ConfigValuesResponse } from '@/models/config/dto';
import { apiFetchJson } from './client';

export function getConfigSpecs(): Promise<ConfigSpecsResponse> {
  return apiFetchJson<ConfigSpecsResponse>('/config/specs');
}

export function getConfig(moduleKey: string): Promise<ConfigValuesResponse> {
  return apiFetchJson<ConfigValuesResponse>(`/config/${encodeURIComponent(moduleKey)}`);
}

export function putConfig(moduleKey: string, values: Record<string, unknown>): Promise<ConfigValuesResponse> {
  return apiFetchJson<ConfigValuesResponse>(`/config/${encodeURIComponent(moduleKey)}`, {
    method: 'PUT',
    body: JSON.stringify(values),
  });
}
