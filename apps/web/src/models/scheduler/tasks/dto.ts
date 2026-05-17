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
