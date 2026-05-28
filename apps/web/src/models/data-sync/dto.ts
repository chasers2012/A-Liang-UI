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

export type {
  SchedulerJobListResponse as DataSyncJobListResponse,
  SchedulerJobLogPublic as DataSyncJobLogPublic,
  SchedulerJobPublic as DataSyncJobPublic,
} from '@/models/scheduler/jobs/dto';

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
