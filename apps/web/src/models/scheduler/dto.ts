export type SchedulerTriggerType = 'cron' | 'manual';

export type SchedulerJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'retrying' | 'cancelled';

export interface SchedulerTaskPublic {
  id: string;
  name: string;
  task_type: string;
  cron_expr: string | null;
  payload: Record<string, unknown>;
  enabled: boolean;
  max_retries: number;
  timeout_seconds: number;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SchedulerJobPublic {
  id: string;
  task_id: string | null;
  task_type: string;
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

export interface CreateSchedulerTaskRequest {
  name: string;
  task_type: string;
  cron_expr?: string | null;
  payload?: Record<string, unknown>;
  enabled?: boolean;
  max_retries?: number;
  timeout_seconds?: number;
}

export interface UpdateSchedulerTaskRequest {
  name?: string;
  task_type?: string;
  cron_expr?: string | null;
  payload?: Record<string, unknown>;
  enabled?: boolean;
  max_retries?: number;
  timeout_seconds?: number;
}
