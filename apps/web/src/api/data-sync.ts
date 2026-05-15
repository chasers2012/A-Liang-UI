import { apiFetchJson } from './client';
import type {
  CreateDataSyncTaskRequest,
  DataSyncJobListResponse,
  DataSyncJobLogPublic,
  DataSyncJobPublic,
  DataSyncTaskPublic,
  UpdateDataSyncTaskRequest,
} from '@/models/data-sync/dto';

export function listDataSyncTasks(enabled?: boolean): Promise<DataSyncTaskPublic[]> {
  const qs = new URLSearchParams();
  if (enabled != null) qs.set('enabled', String(enabled));
  const suffix = qs.toString();
  return apiFetchJson<DataSyncTaskPublic[]>(`/data-sync/tasks${suffix ? `?${suffix}` : ''}`);
}

export function getDataSyncTask(taskId: string): Promise<DataSyncTaskPublic> {
  return apiFetchJson<DataSyncTaskPublic>(`/data-sync/tasks/${encodeURIComponent(taskId)}`);
}

export function createDataSyncTask(body: CreateDataSyncTaskRequest): Promise<DataSyncTaskPublic> {
  return apiFetchJson<DataSyncTaskPublic>('/data-sync/tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateDataSyncTask(taskId: string, body: UpdateDataSyncTaskRequest): Promise<DataSyncTaskPublic> {
  return apiFetchJson<DataSyncTaskPublic>(`/data-sync/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteDataSyncTask(taskId: string): Promise<void> {
  return apiFetchJson<void>(`/data-sync/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
  });
}

export function triggerDataSyncTask(taskId: string, payload?: Record<string, unknown>): Promise<DataSyncJobPublic> {
  return apiFetchJson<DataSyncJobPublic>(`/data-sync/tasks/${encodeURIComponent(taskId)}/trigger`, {
    method: 'POST',
    body: JSON.stringify({ payload: payload ?? {} }),
  });
}

export function listDataSyncJobs(params: {
  taskId: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<DataSyncJobListResponse> {
  const qs = new URLSearchParams();
  qs.set('task_id', params.taskId);
  if (params.status) qs.set('status', params.status);
  if (params.page != null) qs.set('page', String(params.page));
  if (params.pageSize != null) qs.set('page_size', String(params.pageSize));
  return apiFetchJson<DataSyncJobListResponse>(`/data-sync/jobs?${qs.toString()}`);
}

export function cancelDataSyncJob(jobId: string): Promise<DataSyncJobPublic> {
  return apiFetchJson<DataSyncJobPublic>(`/data-sync/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
  });
}

export function listDataSyncJobLogs(jobId: string, limit?: number): Promise<DataSyncJobLogPublic[]> {
  const qs = new URLSearchParams();
  if (limit != null) qs.set('limit', String(limit));
  const suffix = qs.toString();
  return apiFetchJson<DataSyncJobLogPublic[]>(
    `/data-sync/jobs/${encodeURIComponent(jobId)}/logs${suffix ? `?${suffix}` : ''}`,
  );
}
