import type { FactorDetailPublic, FactorParamSpecPublic, FactorSummaryPublic } from '@/models/factor/dto';
import { apiFetchJson } from './client';

export function listFactors(): Promise<FactorSummaryPublic[]> {
  return apiFetchJson<FactorSummaryPublic[]>('/factors');
}

export function getFactor(id: string): Promise<FactorDetailPublic> {
  return apiFetchJson<FactorDetailPublic>(`/factors/${encodeURIComponent(id)}`);
}

export function getFactorParamSpecs(id: string): Promise<FactorParamSpecPublic[]> {
  return apiFetchJson<FactorParamSpecPublic[]>(`/factors/${encodeURIComponent(id)}/param-specs`);
}

export function getFactorTemplate(): Promise<string> {
  return apiFetchJson<string>(`/factors/template`);
}

export function createFactor(body: unknown): Promise<FactorDetailPublic> {
  return apiFetchJson<FactorDetailPublic>('/factors', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function patchFactor(id: string, body: unknown): Promise<FactorDetailPublic> {
  return apiFetchJson<FactorDetailPublic>(`/factors/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteFactor(id: string): Promise<void> {
  return apiFetchJson<void>(`/factors/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
