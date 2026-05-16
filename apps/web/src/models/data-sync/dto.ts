export const DATASOURCE_SYNC_TASK_TYPE = 'datasource.sync';

export interface DataSyncDatasourceRef {
  id: string;
  name: string;
  type: string;
}

export type DataSyncJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'retrying' | 'cancelled';

export type DataSyncTriggerType = 'cron' | 'manual';

export interface DataSyncTaskPublic {
  id: string;
  name: string;
  task_type: typeof DATASOURCE_SYNC_TASK_TYPE | string;
  cron_expr: string | null;
  payload: Record<string, unknown>;
  enabled: boolean;
  max_retries: number;
  timeout_seconds: number;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
  source_datasource_refs?: DataSyncDatasourceRef[];
  target_datasource_refs?: DataSyncDatasourceRef[];
}

export interface DataSyncJobPublic {
  id: string;
  task_id: string | null;
  task_type: string;
  trigger_type: DataSyncTriggerType;
  status: DataSyncJobStatus;
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

export interface DataSyncJobListResponse {
  items: DataSyncJobPublic[];
  total: number;
  page: number;
  page_size: number;
}

export interface DataSyncJobLogPublic {
  id: string;
  job_id: string;
  event: string;
  message: string | null;
  extra: Record<string, unknown>;
  created_at: string;
}

export interface CreateDataSyncTaskRequest {
  name: string;
  cron_expr?: string | null;
  payload?: Record<string, unknown>;
  enabled?: boolean;
  max_retries?: number;
  timeout_seconds?: number;
}

export interface UpdateDataSyncTaskRequest {
  name?: string;
  cron_expr?: string | null;
  payload?: Record<string, unknown>;
  enabled?: boolean;
  max_retries?: number;
  timeout_seconds?: number;
}
