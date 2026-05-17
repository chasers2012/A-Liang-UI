import { apiFetchJson } from './client';
import type { SchedulerJobListResponse, SchedulerJobLogPublic, SchedulerJobPublic } from '@/models/scheduler/dto';

export function listSchedulerJobs(params?: {
  taskId?: string;
  status?: string | string[];
  page?: number;
  pageSize?: number;
}): Promise<SchedulerJobListResponse> {
  const qs = new URLSearchParams();
  if (params?.taskId) qs.set('task_id', params.taskId);
  if (params?.status) {
    const status = Array.isArray(params.status) ? params.status.join(',') : params.status;
    qs.set('status', status);
  }
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

const ACTIVE_JOB_STATUSES = ['queued', 'running', 'retrying'] as const;

function dedupeJobsByQueuedAt(jobs: SchedulerJobPublic[], limit: number): SchedulerJobPublic[] {
  const byId = new Map<string, SchedulerJobPublic>();
  for (const job of jobs) {
    byId.set(job.id, job);
  }
  return [...byId.values()].sort((a, b) => b.queued_at.localeCompare(a.queued_at)).slice(0, limit);
}

export async function listActiveSchedulerJobs(pageSize = 10): Promise<SchedulerJobPublic[]> {
  const page = await listSchedulerJobs({
    status: [...ACTIVE_JOB_STATUSES],
    page: 1,
    pageSize,
  });
  return dedupeJobsByQueuedAt(page.items, pageSize);
}
