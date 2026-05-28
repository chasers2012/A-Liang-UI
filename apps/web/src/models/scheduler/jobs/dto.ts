export type SchedulerTriggerType = 'cron' | 'manual';

export type SchedulerJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'retrying' | 'cancelled';

export interface SchedulerJobTaskPublic {
  id: string;
  name: string;
  task_type: string;
  enabled: boolean;
}

export interface SchedulerJobPublic {
  id: string;
  task: SchedulerJobTaskPublic | null;
  /** One-off jobs only; scheduled jobs use `task.task_type`. */
  task_type?: string;
  trigger_type: SchedulerTriggerType;
  status: SchedulerJobStatus;
  attempt: number;
  max_retries: number;
  queued_at: string;
  started_at: string | null;
  finished_at: string | null;
  next_run_at: string | null;
  dedupe_key: string | null;
  worker_id: string | null;
  timeout_seconds: number;
  payload: Record<string, unknown>;
  result: unknown;
  last_error: string | null;
}

export function schedulerJobTaskId(job: SchedulerJobPublic): string | null {
  return job.task?.id ?? null;
}

export function schedulerJobTaskName(job: SchedulerJobPublic): string {
  const name = job.task?.name?.trim();
  if (name) return name;
  const taskType = schedulerJobTaskType(job);
  return taskType === '-' ? '-' : taskType;
}

export function schedulerJobTaskType(job: SchedulerJobPublic): string {
  return job.task?.task_type ?? job.task_type ?? '-';
}

export interface SchedulerJobListResponse {
  items: SchedulerJobPublic[];
  total: number;
  page: number;
  page_size: number;
}

export interface SchedulerJobLogPublic {
  id: string;
  job_id: string;
  event: string;
  message: string | null;
  extra: Record<string, unknown>;
  created_at: string;
}
