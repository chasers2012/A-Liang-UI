'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';

import { listDataSyncJobLogs, listDataSyncJobs } from '@/api/data-sync';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/reui/badge';
import { CONNECTION, eventBus, type EventHandler } from '@/api/events';
import {
  DATASOURCE_SYNC_TASK_TYPE,
  type DataSyncJobLogPublic,
  type DataSyncJobPublic,
  type DataSyncJobStatus,
} from '@/models/data-sync/dto';
import { schedulerJobTaskId, schedulerJobTaskType, type SchedulerJobPublic } from '@/models/scheduler/jobs/dto';
import { panelActiveTabAtom, recordsRefreshEpochAtom, selectedIdAtom } from '@/models/data-sync/panel.atom';
import { cn } from '@/lib/utils';

const EVENT_REFRESH_DEBOUNCE_MS = 200;

const PAGE_SIZE = 20;

function toLocalTime(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

const STATUS_LABEL: Record<DataSyncJobStatus, string> = {
  queued: '排队中',
  running: '运行中',
  succeeded: '成功',
  failed: '失败',
  retrying: '重试中',
  cancelled: '已取消',
};

function statusBadgeVariant(status: DataSyncJobStatus): 'default' | 'destructive' | 'secondary' | 'outline' {
  if (status === 'succeeded') return 'default';
  if (status === 'failed') return 'destructive';
  if (status === 'running' || status === 'retrying') return 'outline';
  return 'secondary';
}

function formatSyncResultSummary(result: unknown): string {
  if (result == null || typeof result !== 'object') return '—';
  const r = result as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof r.rows_read === 'number') parts.push(`读取 ${r.rows_read} 行`);
  if (typeof r.rows_written === 'number') parts.push(`写入 ${r.rows_written} 行`);
  if (typeof r.watermark_date === 'string' && r.watermark_date.trim()) {
    parts.push(`目标已至 ${r.watermark_date}`);
  }
  return parts.length ? parts.join(' · ') : '—';
}

function formatTriggerType(v: string): string {
  if (v === 'manual') return '手动';
  if (v === 'cron') return '定时';
  return v;
}

export function DataSyncRecordsTab() {
  const taskId = useAtomValue(selectedIdAtom);
  const refreshEpoch = useAtomValue(recordsRefreshEpochAtom);
  const active = useAtomValue(panelActiveTabAtom) === 'records';
  const bumpRefreshEpoch = useSetAtom(recordsRefreshEpochAtom);
  const [jobs, setJobs] = useState<DataSyncJobPublic[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [logsByJobId, setLogsByJobId] = useState<Record<string, DataSyncJobLogPublic[]>>({});
  const [logsLoadingId, setLogsLoadingId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadJobs = useCallback(async () => {
    if (!taskId) {
      setJobs([]);
      setTotal(0);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await listDataSyncJobs({ taskId, page, pageSize: PAGE_SIZE });
      setJobs(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [taskId, page]);

  useEffect(() => {
    if (!active || !taskId) return;
    void loadJobs();
  }, [active, taskId, page, refreshEpoch, loadJobs]);

  useEffect(() => {
    setPage(1);
    setExpandedJobId(null);
    setLogsByJobId({});
  }, [taskId]);

  const refreshTimerRef = useRef<number | null>(null);
  const scheduleRecordsRefresh = useCallback(() => {
    if (refreshTimerRef.current !== null) return;
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      bumpRefreshEpoch((n) => n + 1);
    }, EVENT_REFRESH_DEBOUNCE_MS);
  }, [bumpRefreshEpoch]);

  useEffect(() => {
    if (!active || !taskId) return;
    const onJob: EventHandler<SchedulerJobPublic> = (payload) => {
      if (schedulerJobTaskType(payload) !== DATASOURCE_SYNC_TASK_TYPE) return;
      if (schedulerJobTaskId(payload) !== taskId) return;
      scheduleRecordsRefresh();
    };
    const offTopic = eventBus.on('scheduler.job.updated', onJob);
    const offConnected = eventBus.on(CONNECTION.CONNECTED, (connectCount: number) => {
      if (connectCount > 1) scheduleRecordsRefresh();
    });
    return () => {
      offTopic();
      offConnected();
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [active, taskId, scheduleRecordsRefresh]);

  const toggleLogs = async (jobId: string) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      return;
    }
    setExpandedJobId(jobId);
    if (logsByJobId[jobId]) return;
    setLogsLoadingId(jobId);
    try {
      const logs = await listDataSyncJobLogs(jobId, 50);
      setLogsByJobId((prev) => ({ ...prev, [jobId]: logs }));
    } catch (e) {
      setLogsByJobId((prev) => ({ ...prev, [jobId]: [] }));
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLogsLoadingId(null);
    }
  };

  if (taskId == null) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <span className="text-xs text-muted-foreground">共 {total} 条记录</span>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading && jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : !jobs.length ? (
        <p className="text-sm text-muted-foreground">暂无同步记录，可点击「触发」执行一次同步。</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">状态</TableHead>
                <TableHead>触发</TableHead>
                <TableHead>排队时间</TableHead>
                <TableHead>完成时间</TableHead>
                <TableHead>结果摘要</TableHead>
                <TableHead className="w-[72px] text-right">详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => {
                const expanded = expandedJobId === job.id;
                const logs = logsByJobId[job.id];
                return (
                  <Fragment key={job.id}>
                    <TableRow>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(job.status)} size="sm">
                          {STATUS_LABEL[job.status] ?? job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatTriggerType(job.trigger_type)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{toLocalTime(job.queued_at)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{toLocalTime(job.finished_at)}</TableCell>
                      <TableCell className="max-w-[240px] truncate text-sm" title={formatSyncResultSummary(job.result)}>
                        {job.status === 'failed' && job.last_error
                          ? job.last_error
                          : formatSyncResultSummary(job.result)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => void toggleLogs(job.id)}
                        >
                          {expanded ? '收起' : '展开'}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expanded ? (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={6} className="py-3">
                          <div className="space-y-3 text-xs">
                            <div className="grid gap-1 sm:grid-cols-2">
                              <p>
                                <span className="text-muted-foreground">作业 ID：</span>
                                <span className="font-mono">{job.id}</span>
                              </p>
                              <p>
                                <span className="text-muted-foreground">重试：</span>
                                {job.attempt}/{job.max_retries}
                              </p>
                              <p>
                                <span className="text-muted-foreground">开始：</span>
                                {toLocalTime(job.started_at)}
                              </p>
                              {job.last_error ? (
                                <p className="text-destructive sm:col-span-2">{job.last_error}</p>
                              ) : null}
                            </div>
                            {job.result != null ? (
                              <pre className="max-h-40 overflow-auto rounded-md bg-background p-2 font-mono text-[11px] leading-relaxed">
                                {JSON.stringify(job.result, null, 2)}
                              </pre>
                            ) : null}
                            <div>
                              <p className="mb-1 font-medium text-muted-foreground">运行日志</p>
                              {logsLoadingId === job.id ? (
                                <p className="text-muted-foreground">加载日志…</p>
                              ) : !logs?.length ? (
                                <p className="text-muted-foreground">暂无日志</p>
                              ) : (
                                <ul className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-border/50 bg-background p-2">
                                  {logs.map((log) => (
                                    <li key={log.id} className="font-mono">
                                      <span className="text-muted-foreground">{toLocalTime(log.created_at)}</span>{' '}
                                      <span className="text-foreground">{log.event}</span>
                                      {log.message ? (
                                        <span className="text-muted-foreground"> — {log.message}</span>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 ? (
        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                aria-disabled={page <= 1 || loading}
                className={cn(page <= 1 || loading ? 'pointer-events-none opacity-50' : undefined)}
                onClick={(e) => {
                  e.preventDefault();
                  if (page <= 1 || loading) return;
                  setPage((p) => p - 1);
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive>
                {page} / {totalPages}
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                aria-disabled={page >= totalPages || loading}
                className={cn(page >= totalPages || loading ? 'pointer-events-none opacity-50' : undefined)}
                onClick={(e) => {
                  e.preventDefault();
                  if (page >= totalPages || loading) return;
                  setPage((p) => p + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  );
}
