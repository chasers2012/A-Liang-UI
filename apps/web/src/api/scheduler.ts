import { apiFetchJson } from './client';
import type {
  CreateSchedulerTaskRequest,
  SchedulerJobListResponse,
  SchedulerJobLogPublic,
  SchedulerJobPublic,
  SchedulerTaskPublic,
  UpdateSchedulerTaskRequest,
} from '@/models/scheduler/dto';

export function listSchedulerTasks(enabled?: boolean): Promise<SchedulerTaskPublic[]> {
  const qs = new URLSearchParams();
  if (enabled != null) qs.set('enabled', String(enabled));
  const suffix = qs.toString();
  return apiFetchJson<SchedulerTaskPublic[]>(`/scheduler/tasks${suffix ? `?${suffix}` : ''}`);
}

export function createSchedulerTask(body: CreateSchedulerTaskRequest): Promise<SchedulerTaskPublic> {
  return apiFetchJson<SchedulerTaskPublic>('/scheduler/tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateSchedulerTask(taskId: string, body: UpdateSchedulerTaskRequest): Promise<SchedulerTaskPublic> {
  return apiFetchJson<SchedulerTaskPublic>(`/scheduler/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteSchedulerTask(taskId: string): Promise<void> {
  return apiFetchJson<void>(`/scheduler/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
  });
}

export function triggerSchedulerTask(taskId: string, payload?: Record<string, unknown>): Promise<SchedulerJobPublic> {
  return apiFetchJson<SchedulerJobPublic>(`/scheduler/tasks/${encodeURIComponent(taskId)}/trigger`, {
    method: 'POST',
    body: JSON.stringify({ payload: payload ?? {} }),
  });
}

export function listSchedulerJobs(params?: {
  taskId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<SchedulerJobListResponse> {
  const qs = new URLSearchParams();
  if (params?.taskId) qs.set('task_id', params.taskId);
  if (params?.status) qs.set('status', params.status);
  if (params?.page != null) qs.set('page', String(params.page));
  if (params?.pageSize != null) qs.set('page_size', String(params.pageSize));
  const suffix = qs.toString();
  return apiFetchJson<SchedulerJobListResponse>(`/scheduler/jobs${suffix ? `?${suffix}` : ''}`);
}

export function cancelSchedulerJob(jobId: string): Promise<SchedulerJobPublic> {
  return apiFetchJson<SchedulerJobPublic>(`/scheduler/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
  });
}

export function listSchedulerJobLogs(jobId: string, limit?: number): Promise<SchedulerJobLogPublic[]> {
  const qs = new URLSearchParams();
  if (limit != null) qs.set('limit', String(limit));
  const suffix = qs.toString();
  return apiFetchJson<SchedulerJobLogPublic[]>(
    `/scheduler/jobs/${encodeURIComponent(jobId)}/logs${suffix ? `?${suffix}` : ''}`,
  );
}
