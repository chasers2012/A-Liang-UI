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

export type SchedulerActiveJob = SchedulerJobPublic & {
  taskName?: string;
};

function dedupeJobsByQueuedAt(jobs: SchedulerJobPublic[], limit: number): SchedulerJobPublic[] {
  const byId = new Map<string, SchedulerJobPublic>();
  for (const job of jobs) {
    byId.set(job.id, job);
  }
  return [...byId.values()].sort((a, b) => b.queued_at.localeCompare(a.queued_at)).slice(0, limit);
}

export async function listActiveSchedulerJobs(pageSize = 10): Promise<SchedulerActiveJob[]> {
  const page = await listSchedulerJobs({
    status: [...ACTIVE_JOB_STATUSES],
    page: 1,
    pageSize,
  });
  const jobs = dedupeJobsByQueuedAt(page.items, pageSize);
  if (jobs.length === 0) return [];

  const tasks = await listSchedulerTasks();
  const taskNameById = Object.fromEntries(tasks.map((t) => [t.id, t.name]));
  return jobs.map((job) => ({
    ...job,
    taskName: job.task_id ? taskNameById[job.task_id] : undefined,
  }));
}
