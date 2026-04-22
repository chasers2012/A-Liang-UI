import type { EvaluationProfilePublic, WorkflowIOSpecPublic } from '@/models/evaluation-profile/dto';
import { apiFetchJson } from './client';

export function listEvaluationProfiles(): Promise<EvaluationProfilePublic[]> {
  return apiFetchJson<EvaluationProfilePublic[]>('/evaluation/profile');
}

export function getEvaluationProfile(id: string): Promise<EvaluationProfilePublic> {
  return apiFetchJson<EvaluationProfilePublic>(`/evaluation/profile/${encodeURIComponent(id)}`);
}

export function createEvaluationProfile(body: unknown): Promise<EvaluationProfilePublic> {
  return apiFetchJson<EvaluationProfilePublic>('/evaluation/profile', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function patchEvaluationProfile(id: string, body: unknown): Promise<EvaluationProfilePublic> {
  return apiFetchJson<EvaluationProfilePublic>(`/evaluation/profile/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function getEvaluationWorkflowIO(): Promise<WorkflowIOSpecPublic> {
  return apiFetchJson<WorkflowIOSpecPublic>('/evaluation/profile/workflow-io');
}

export function getEvaluationWorkflowTemplate(): Promise<Record<string, unknown>> {
  return apiFetchJson<Record<string, unknown>>('/evaluation/profile/workflow-template');
}
